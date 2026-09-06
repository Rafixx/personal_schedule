# API completa de Apps Script — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sustituir el spike de `apps-script/Codigo.gs` por la API completa (lectura y escritura de las 6 pestañas), migrar los datos existentes de la hoja al esquema nuevo, y verificar cada acción end-to-end contra la hoja real de Rafa.

**Architecture:** Un único script `apps-script/Codigo.gs` con enrutado por `action`. `doGet` no requiere token (lecturas abiertas al enlace); `doPost` exige `{action, token, payload}` con `Content-Type: text/plain` (confirmado en el plan anterior) y token comparado contra `PropertiesService`. Todas las escrituras bajo `LockService`. Un helper genérico (`sheetToObjects_`) mapea cualquier pestaña a objetos usando sus cabeceras reales, así que las lecturas no dependen de que la migración ya se haya ejecutado.

**Tech Stack:** Google Apps Script (`SpreadsheetApp`, `ContentService`, `LockService`, `PropertiesService`).

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md` (esta plan añade la acción `admin.migrate`, no documentada originalmente — se actualiza en la Task 2).

## Global Constraints

- POST siempre con `Content-Type: text/plain;charset=utf-8` (confirmado por el spike; ver spec).
- Ids los asigna el servidor (`max(id)+1`). El cliente nunca genera ids.
- Los avisos de reglas/temporada nunca bloquean — no aplica a este plan (es responsabilidad del dominio en el frontend), pero la API no debe imponer ninguna validación que impida guardar un plan.set fuera de temporada o que rompa una regla.
- Ningún secreto (token) se commitea. El valor de `API_TOKEN` vive solo en Script Properties de Apps Script y, más adelante, en `.env.local` del frontend.
- **Contrato de `plato.upsert`:** el cliente debe enviar siempre `activo` explícito al editar un plato existente. Si se omite, el servidor asume `true` — omitirlo en una edición reactivaría por accidente un plato borrado. Anotado aquí para que el plan del frontend (formulario de catálogo) lo respete.

---

### Task 1: Escribir la API completa en `Codigo.gs`

**Files:**
- Modify: `apps-script/Codigo.gs` (sustituye el contenido del spike)

**Interfaces:**
- Consumes: nada (es la base)
- Produces — contrato exacto que consumirá el plan del frontend:
  - `GET ?action=bootstrap` → `{ok:true, platos:[...], ingredientes:[...], ingredientesPlatos:[...], reglas:[...], proveedores:[...]}`. Cada objeto trae además `_row` (uso interno del servidor; el frontend debe ignorarlo).
  - `GET ?action=plan&desde=YYYY-MM-DD&hasta=YYYY-MM-DD` → `{ok:true, entries:[{id,fecha,turno,id_plato,notas,_row}]}`
  - `POST {action, token, payload}` → éxito `{ok:true, result:<ver tabla>}`, error `{ok:false, error:"..."}`.

  | action | payload | result |
  |---|---|---|
  | `plan.set` | `{fecha, turno, id_plato, notas?}` | `{id}` |
  | `plan.delete` | `{fecha, turno}` | `{deleted}` |
  | `plan.move` | `{from:{fecha,turno}, to:{fecha,turno}}` | `{ok:true}` |
  | `plato.upsert` | `{id_plato?, nombre, temporada, etiquetas, notas?, activo?}` | `{id_plato}` |
  | `plato.delete` | `{id_plato}` | `{deleted}` |
  | `ingrediente.upsert` | `{id_ingrediente?, nombre, proveedor?, unidad_base?, temporada?, kcal_100?, prot_100?, carb_100?, grasa_100?}` | `{id_ingrediente}` |
  | `ingrediente.delete` | `{id_ingrediente}` | `{deleted}` |
  | `platoIngredientes.replace` | `{id_plato, ingredientes:[{id_ingrediente,cantidad,unidad}]}` | `{id_plato, count}` |
  | `regla.upsert` | `{id?, etiqueta, tipo, valor, activa?}` | `{id}` |
  | `regla.delete` | `{id}` | `{deleted}` |
  | `admin.migrate` | `{}` | `{activoBackfilled, nombresCorregidos, cantidadesNormalizadas, unidadesNormalizadas, filasIngredientesPlatosEliminadas}` |

- [x] **Step 1: Reemplazar el contenido completo de `apps-script/Codigo.gs`**

```javascript
/**
 * API del planificador de menú familiar sobre Google Sheets.
 * Lectura vía doGet, escritura vía doPost con token compartido.
 * Cada escritura corre bajo LockService para evitar carreras entre
 * peticiones simultáneas desde varios dispositivos.
 */

var SHEET_NAMES = {
  PLATOS: 'platos',
  INGREDIENTES: 'ingredientes',
  INGREDIENTES_PLATOS: 'ingredientes_platos',
  PLAN: 'plan',
  REGLAS: 'reglas',
  PROVEEDORES: 'proveedores'
}

var SCHEMA = {
  platos: ['id_plato', 'nombre', 'temporada', 'etiquetas', 'notas', 'activo'],
  ingredientes: [
    'id_ingrediente', 'nombre', 'proveedor', 'unidad_base', 'temporada',
    'kcal_100', 'prot_100', 'carb_100', 'grasa_100'
  ],
  ingredientes_platos: ['id', 'id_plato', 'id_ingrediente', 'cantidad', 'unidad'],
  plan: ['id', 'fecha', 'turno', 'id_plato', 'notas'],
  reglas: ['id', 'etiqueta', 'tipo', 'valor', 'activa'],
  proveedores: ['nombre', 'orden']
}

// ---------- Helpers de hoja ----------

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(name)
  if (!sheet) sheet = ss.insertSheet(name)
  return sheet
}

function ensureSchema_() {
  Object.keys(SCHEMA).forEach(function (name) {
    var sheet = getSheet_(name)
    var headers = SCHEMA[name]
    var currentRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    var matches = headers.every(function (h, i) { return currentRow[i] === h })
    if (!matches) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    }
  })
  var planSheet = getSheet_(SHEET_NAMES.PLAN)
  var fechaCol = SCHEMA.plan.indexOf('fecha') + 1
  var maxRows = Math.max(planSheet.getMaxRows() - 1, 1)
  planSheet.getRange(2, fechaCol, maxRows, 1).setNumberFormat('@')
}

function sheetToObjects_(name) {
  var sheet = getSheet_(name)
  var values = sheet.getDataRange().getValues()
  if (values.length < 2) return []
  var headers = values[0]
  var objects = []
  for (var i = 1; i < values.length; i++) {
    var row = values[i]
    var isBlank = row.every(function (cell) { return cell === '' || cell === null })
    if (isBlank) continue
    var obj = {}
    headers.forEach(function (h, j) { obj[h] = row[j] })
    obj._row = i + 1
    objects.push(obj)
  }
  return objects
}

function nextId_(name, idColumn) {
  var objects = sheetToObjects_(name)
  var maxId = objects.reduce(function (max, obj) {
    var id = Number(obj[idColumn])
    return isNaN(id) ? max : Math.max(max, id)
  }, 0)
  return maxId + 1
}

function findRow_(name, predicate) {
  var objects = sheetToObjects_(name)
  for (var i = 0; i < objects.length; i++) {
    if (predicate(objects[i])) return objects[i]
  }
  return null
}

function writeRow_(name, headers, rowIndex, values) {
  getSheet_(name).getRange(rowIndex, 1, 1, headers.length).setValues([values])
}

function appendRow_(name, values) {
  getSheet_(name).appendRow(values)
}

function deleteRow_(name, rowIndex) {
  getSheet_(name).deleteRow(rowIndex)
}

function normalizeFecha_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  }
  return String(value)
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}

function getToken_() {
  return PropertiesService.getScriptProperties().getProperty('API_TOKEN')
}

// ---------- Lectura ----------

function doGet(e) {
  ensureSchema_()
  var action = e && e.parameter ? e.parameter.action : null
  try {
    if (action === 'bootstrap') return jsonOutput_(bootstrapResponse_())
    if (action === 'plan') {
      return jsonOutput_({ ok: true, entries: getPlan_(e.parameter.desde, e.parameter.hasta) })
    }
    return jsonOutput_({ ok: false, error: 'acción GET desconocida: ' + action })
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) })
  }
}

function bootstrapResponse_() {
  return {
    ok: true,
    platos: sheetToObjects_(SHEET_NAMES.PLATOS),
    ingredientes: sheetToObjects_(SHEET_NAMES.INGREDIENTES),
    ingredientesPlatos: sheetToObjects_(SHEET_NAMES.INGREDIENTES_PLATOS),
    reglas: sheetToObjects_(SHEET_NAMES.REGLAS),
    proveedores: sheetToObjects_(SHEET_NAMES.PROVEEDORES)
  }
}

function getPlan_(desde, hasta) {
  return sheetToObjects_(SHEET_NAMES.PLAN)
    .map(function (entry) {
      entry.fecha = normalizeFecha_(entry.fecha)
      return entry
    })
    .filter(function (entry) { return entry.fecha >= desde && entry.fecha <= hasta })
}

// ---------- Escritura ----------

function doPost(e) {
  var body
  try {
    body = JSON.parse(e.postData.contents)
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'body no es JSON válido' })
  }
  if (body.token !== getToken_()) {
    return jsonOutput_({ ok: false, error: 'token inválido' })
  }
  ensureSchema_()
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    var result = routeAction_(body.action, body.payload || {})
    return jsonOutput_({ ok: true, result: result })
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) })
  } finally {
    lock.releaseLock()
  }
}

function routeAction_(action, payload) {
  var handlers = {
    'plan.set': planSet_,
    'plan.delete': planDelete_,
    'plan.move': planMove_,
    'plato.upsert': platoUpsert_,
    'plato.delete': platoDelete_,
    'ingrediente.upsert': ingredienteUpsert_,
    'ingrediente.delete': ingredienteDelete_,
    'platoIngredientes.replace': platoIngredientesReplace_,
    'regla.upsert': reglaUpsert_,
    'regla.delete': reglaDelete_,
    'admin.migrate': adminMigrate_
  }
  var handler = handlers[action]
  if (!handler) throw new Error('acción POST desconocida: ' + action)
  return handler(payload)
}

function planSet_(payload) {
  var existing = findRow_(SHEET_NAMES.PLAN, function (row) {
    return normalizeFecha_(row.fecha) === payload.fecha && row.turno === payload.turno
  })
  var notas = payload.notas || ''
  if (existing) {
    writeRow_(SHEET_NAMES.PLAN, SCHEMA.plan, existing._row,
      [existing.id, payload.fecha, payload.turno, payload.id_plato, notas])
    return { id: existing.id }
  }
  var id = nextId_(SHEET_NAMES.PLAN, 'id')
  appendRow_(SHEET_NAMES.PLAN, [id, payload.fecha, payload.turno, payload.id_plato, notas])
  return { id: id }
}

function planDelete_(payload) {
  var existing = findRow_(SHEET_NAMES.PLAN, function (row) {
    return normalizeFecha_(row.fecha) === payload.fecha && row.turno === payload.turno
  })
  if (existing) deleteRow_(SHEET_NAMES.PLAN, existing._row)
  return { deleted: !!existing }
}

function planMove_(payload) {
  var from = payload.from
  var to = payload.to
  var fromEntry = findRow_(SHEET_NAMES.PLAN, function (row) {
    return normalizeFecha_(row.fecha) === from.fecha && row.turno === from.turno
  })
  var toEntry = findRow_(SHEET_NAMES.PLAN, function (row) {
    return normalizeFecha_(row.fecha) === to.fecha && row.turno === to.turno
  })
  if (fromEntry) planSet_({ fecha: to.fecha, turno: to.turno, id_plato: fromEntry.id_plato, notas: fromEntry.notas })
  else planDelete_(to)
  if (toEntry) planSet_({ fecha: from.fecha, turno: from.turno, id_plato: toEntry.id_plato, notas: toEntry.notas })
  else planDelete_(from)
  return { ok: true }
}

function platoUpsert_(payload) {
  var activo = payload.activo === false ? false : true
  var row = [payload.id_plato, payload.nombre, payload.temporada, payload.etiquetas, payload.notas || '', activo]
  if (payload.id_plato) {
    var existing = findRow_(SHEET_NAMES.PLATOS, function (r) { return String(r.id_plato) === String(payload.id_plato) })
    if (!existing) throw new Error('plato no encontrado: ' + payload.id_plato)
    writeRow_(SHEET_NAMES.PLATOS, SCHEMA.platos, existing._row, row)
    return { id_plato: payload.id_plato }
  }
  var id = nextId_(SHEET_NAMES.PLATOS, 'id_plato')
  row[0] = id
  appendRow_(SHEET_NAMES.PLATOS, row)
  return { id_plato: id }
}

function platoDelete_(payload) {
  var existing = findRow_(SHEET_NAMES.PLATOS, function (r) { return String(r.id_plato) === String(payload.id_plato) })
  if (!existing) return { deleted: false }
  writeRow_(SHEET_NAMES.PLATOS, SCHEMA.platos, existing._row,
    [existing.id_plato, existing.nombre, existing.temporada, existing.etiquetas, existing.notas, false])
  return { deleted: true }
}

function ingredienteUpsert_(payload) {
  var row = [
    payload.id_ingrediente, payload.nombre, payload.proveedor || '', payload.unidad_base || '',
    payload.temporada || 'TODAS', payload.kcal_100 || '', payload.prot_100 || '',
    payload.carb_100 || '', payload.grasa_100 || ''
  ]
  if (payload.id_ingrediente) {
    var existing = findRow_(SHEET_NAMES.INGREDIENTES, function (r) {
      return String(r.id_ingrediente) === String(payload.id_ingrediente)
    })
    if (!existing) throw new Error('ingrediente no encontrado: ' + payload.id_ingrediente)
    writeRow_(SHEET_NAMES.INGREDIENTES, SCHEMA.ingredientes, existing._row, row)
    return { id_ingrediente: payload.id_ingrediente }
  }
  var id = nextId_(SHEET_NAMES.INGREDIENTES, 'id_ingrediente')
  row[0] = id
  appendRow_(SHEET_NAMES.INGREDIENTES, row)
  return { id_ingrediente: id }
}

function ingredienteDelete_(payload) {
  var existing = findRow_(SHEET_NAMES.INGREDIENTES, function (r) {
    return String(r.id_ingrediente) === String(payload.id_ingrediente)
  })
  if (existing) deleteRow_(SHEET_NAMES.INGREDIENTES, existing._row)
  return { deleted: !!existing }
}

function platoIngredientesReplace_(payload) {
  var actuales = sheetToObjects_(SHEET_NAMES.INGREDIENTES_PLATOS)
    .filter(function (row) { return String(row.id_plato) === String(payload.id_plato) })
  actuales
    .sort(function (a, b) { return b._row - a._row })
    .forEach(function (row) { deleteRow_(SHEET_NAMES.INGREDIENTES_PLATOS, row._row) })

  var nextId = nextId_(SHEET_NAMES.INGREDIENTES_PLATOS, 'id')
  payload.ingredientes.forEach(function (ing, i) {
    appendRow_(SHEET_NAMES.INGREDIENTES_PLATOS,
      [nextId + i, payload.id_plato, ing.id_ingrediente, ing.cantidad, ing.unidad])
  })
  return { id_plato: payload.id_plato, count: payload.ingredientes.length }
}

function reglaUpsert_(payload) {
  var activa = payload.activa === false ? false : true
  var row = [payload.id, payload.etiqueta, payload.tipo, payload.valor, activa]
  if (payload.id) {
    var existing = findRow_(SHEET_NAMES.REGLAS, function (r) { return String(r.id) === String(payload.id) })
    if (!existing) throw new Error('regla no encontrada: ' + payload.id)
    writeRow_(SHEET_NAMES.REGLAS, SCHEMA.reglas, existing._row, row)
    return { id: payload.id }
  }
  var id = nextId_(SHEET_NAMES.REGLAS, 'id')
  row[0] = id
  appendRow_(SHEET_NAMES.REGLAS, row)
  return { id: id }
}

function reglaDelete_(payload) {
  var existing = findRow_(SHEET_NAMES.REGLAS, function (r) { return String(r.id) === String(payload.id) })
  if (existing) deleteRow_(SHEET_NAMES.REGLAS, existing._row)
  return { deleted: !!existing }
}

// ---------- Migración de datos existentes (acción idempotente) ----------

function adminMigrate_() {
  ensureSchema_()

  var nameFixes = {
    'Moozzarela fresca': 'Mozzarella fresca',
    'Huevoss': 'Huevos',
    'Garbanzzos': 'Garbanzos',
    'Arrroz basmati': 'Arroz basmati'
    // 'Mira al talll' no se corrige aquí: la celda del proveedor tiene una
    // validación de datos (lista desplegable) que solo admite ese valor
    // exacto. Corregirlo requiere editar la validación manualmente en Sheets.
  }
  var report = {
    activoBackfilled: 0,
    nombresCorregidos: 0,
    cantidadesNormalizadas: 0,
    unidadesNormalizadas: 0,
    filasIngredientesPlatosEliminadas: 0
  }

  var platosSheet = getSheet_(SHEET_NAMES.PLATOS)
  var activoCol = SCHEMA.platos.indexOf('activo') + 1
  sheetToObjects_(SHEET_NAMES.PLATOS).forEach(function (plato) {
    if (plato.activo === '' || plato.activo === null) {
      platosSheet.getRange(plato._row, activoCol).setValue(true)
      report.activoBackfilled++
    }
  })

  var ingredientesSheet = getSheet_(SHEET_NAMES.INGREDIENTES)
  var nombreCol = SCHEMA.ingredientes.indexOf('nombre') + 1
  var proveedorCol = SCHEMA.ingredientes.indexOf('proveedor') + 1
  sheetToObjects_(SHEET_NAMES.INGREDIENTES).forEach(function (ing) {
    if (nameFixes[ing.nombre]) {
      ingredientesSheet.getRange(ing._row, nombreCol).setValue(nameFixes[ing.nombre])
      report.nombresCorregidos++
    }
    if (nameFixes[ing.proveedor]) {
      ingredientesSheet.getRange(ing._row, proveedorCol).setValue(nameFixes[ing.proveedor])
      report.nombresCorregidos++
    }
  })

  var ipSheet = getSheet_(SHEET_NAMES.INGREDIENTES_PLATOS)
  var cantidadCol = SCHEMA.ingredientes_platos.indexOf('cantidad') + 1
  var unidadCol = SCHEMA.ingredientes_platos.indexOf('unidad') + 1
  var filasVacias = []
  sheetToObjects_(SHEET_NAMES.INGREDIENTES_PLATOS).forEach(function (row) {
    if (row.id_plato === '' || row.id_plato === null) {
      filasVacias.push(row._row)
      return
    }
    if (typeof row.cantidad === 'string' && row.cantidad.indexOf('/') !== -1) {
      var parts = row.cantidad.split('/')
      ipSheet.getRange(row._row, cantidadCol).setValue(Number(parts[0]) / Number(parts[1]))
      report.cantidadesNormalizadas++
    }
    if (String(row.unidad).trim().toLowerCase() === 'unidad') {
      ipSheet.getRange(row._row, unidadCol).setValue('ud')
      report.unidadesNormalizadas++
    }
  })
  filasVacias
    .sort(function (a, b) { return b - a })
    .forEach(function (rowIndex) {
      ipSheet.deleteRow(rowIndex)
      report.filasIngredientesPlatosEliminadas++
    })

  return report
}
```

- [x] **Step 2: Commit**

```bash
git add apps-script/Codigo.gs
git commit -m "feat: API completa de Apps Script (lectura, escritura, migración)"
```

---

### Task 2: Actualizar la spec con el contrato de la API

**Files:**
- Modify: `docs/specs/2026-09-06-menu-familiar-design.md`

**Interfaces:**
- Consumes: la tabla de acciones documentada en la Task 1
- Produces: sección de referencia que citará el plan del frontend al escribir los esquemas zod

- [x] **Step 1: Reemplazar la sección "API (Google Apps Script)"**

Sustituir el contenido de esa sección por:

```markdown
## API (Google Apps Script)

Implementada en `apps-script/Codigo.gs`. Un helper genérico
(`sheetToObjects_`) mapea cualquier pestaña a objetos usando sus cabeceras
reales — las lecturas no dependen de que la migración ya se haya
ejecutado. `ensureSchema_()` corre en cada request y normaliza cabeceras y
formato de la columna `fecha` de forma idempotente.

**Lectura (`GET`, sin token)**
- `?action=bootstrap` → `{ok:true, platos, ingredientes, ingredientesPlatos, reglas, proveedores}`
- `?action=plan&desde=YYYY-MM-DD&hasta=YYYY-MM-DD` → `{ok:true, entries}`

Cada objeto incluye un campo interno `_row` que el frontend debe ignorar.

**Escritura (`POST`, body `{action, token, payload}`, `Content-Type: text/plain`)**

| action | payload | result |
|---|---|---|
| `plan.set` | `{fecha, turno, id_plato, notas?}` | `{id}` |
| `plan.delete` | `{fecha, turno}` | `{deleted}` |
| `plan.move` | `{from:{fecha,turno}, to:{fecha,turno}}` | `{ok:true}` |
| `plato.upsert` | `{id_plato?, nombre, temporada, etiquetas, notas?, activo?}` | `{id_plato}` |
| `plato.delete` | `{id_plato}` | `{deleted}` |
| `ingrediente.upsert` | `{id_ingrediente?, nombre, proveedor?, unidad_base?, temporada?, kcal_100?, prot_100?, carb_100?, grasa_100?}` | `{id_ingrediente}` |
| `ingrediente.delete` | `{id_ingrediente}` | `{deleted}` |
| `platoIngredientes.replace` | `{id_plato, ingredientes:[{id_ingrediente,cantidad,unidad}]}` | `{id_plato, count}` |
| `regla.upsert` | `{id?, etiqueta, tipo, valor, activa?}` | `{id}` |
| `regla.delete` | `{id}` | `{deleted}` |
| `admin.migrate` | `{}` | `{activoBackfilled, nombresCorregidos, cantidadesNormalizadas, unidadesNormalizadas, filasIngredientesPlatosEliminadas}` |

Respuesta de error (cualquier acción): `{ok:false, error:"..."}`.

Nota de contrato: `plato.upsert` asume `activo:true` si se omite. El
cliente debe enviar siempre `activo` explícito al editar un plato
existente, o reactivará por accidente uno borrado.

`admin.migrate` es una acción de mantenimiento idempotente (backfill de
`activo`, corrección de nombres con erratas, `cantidad` de texto tipo
`"1/2"` a numérico, normalización de `unidad`, borrado de filas huérfanas
de `ingredientes_platos`). Se puede volver a llamar sin riesgo.
```

- [x] **Step 2: Commit**

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: contrato completo de la API de Apps Script"
```

---

### Task 3: Desplegar, migrar y verificar end-to-end

**Files:**
- N/A (despliegue y verificación, no código)

**Interfaces:**
- Consumes: `apps-script/Codigo.gs` de la Task 1, la URL de despliegue ya conocida
(`https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec`)
y un token que aporta Rafa
- Produces: hoja migrada al esquema nuevo, y confirmación de que las 10 acciones de escritura + las 2 de lectura funcionan sobre datos reales

- [x] **Step 1 (manual, Rafa): Actualizar el script, fijar el token y redesplegar**

1. Abre el proyecto de Apps Script (Extensiones → Apps Script desde la hoja).
2. Borra el contenido de `Código.gs` y pega el contenido nuevo de
   `apps-script/Codigo.gs` (el de la Task 1).
3. Icono de engranaje (Configuración del proyecto) → baja hasta
   "Propiedades del script" → Añadir propiedad de script:
   nombre `API_TOKEN`, valor: cualquier cadena que elijas como secreto
   compartido (por ejemplo, generada con `openssl rand -hex 16` desde una
   terminal). Compártela conmigo en el chat para poder verificar — no se
   commitea en ningún momento.
4. Implementar → Gestionar implementaciones → icono de lápiz sobre la
   implementación existente → en "Versión" elige "Nueva versión" →
   Implementar. Esto **mantiene la misma URL** que ya tenemos.
5. Confirma en el chat: "listo" + el valor del token.

- [x] **Step 2 (agente): Ejecutar la migración una vez y revisar el informe**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec'
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'admin.migrate', token: '<TOKEN>', payload: {} })
  })
  return await res.json()
}
```

Expected: `{ok:true, result:{activoBackfilled, nombresCorregidos, cantidadesNormalizadas, unidadesNormalizadas, filasIngredientesPlatosEliminadas}}` con números coherentes con los 9 platos y 15 ingredientes originales (p. ej. `activoBackfilled` cercano a 9, `filasIngredientesPlatosEliminadas` cercano a 15).

- [x] **Step 3 (agente): Confirmar el esquema migrado vía `bootstrap`**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec?action=bootstrap'
  const res = await fetch(url)
  return await res.json()
}
```

Expected: cada plato trae `etiquetas` (no `restricciones`) y `activo: true`;
cada fila de `ingredientesPlatos` tiene `cantidad` numérica y `unidad` sin
valores `"unidad"` sueltos; `reglas` y `proveedores` existen como arrays
vacíos (pestañas nuevas, sin filas todavía).

- [x] **Step 4 (agente): Round-trip de `plan.set` / `plan.move` / `plan.delete`**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec'
  const token = '<TOKEN>'
  const post = (action, payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload })
  }).then((r) => r.json())

  const set1 = await post('plan.set', { fecha: '2026-09-07', turno: 'COMIDA', id_plato: 1, notas: '' })
  const set2 = await post('plan.set', { fecha: '2026-09-08', turno: 'COMIDA', id_plato: 2, notas: '' })
  const moved = await post('plan.move', {
    from: { fecha: '2026-09-07', turno: 'COMIDA' },
    to: { fecha: '2026-09-08', turno: 'COMIDA' }
  })
  const afterMove = await fetch(url + '?action=plan&desde=2026-09-07&hasta=2026-09-08').then((r) => r.json())
  const del1 = await post('plan.delete', { fecha: '2026-09-07', turno: 'COMIDA' })
  const del2 = await post('plan.delete', { fecha: '2026-09-08', turno: 'COMIDA' })

  return { set1, set2, moved, afterMove, del1, del2 }
}
```

Expected: `set1`/`set2` con `{ok:true, result:{id}}`; `afterMove.entries`
muestra `id_plato:2` en `2026-09-07` e `id_plato:1` en `2026-09-08`
(intercambiados); ambos `delete` devuelven `{deleted:true}`.

- [x] **Step 5 (agente): `plato.upsert` (alta y edición) y `plato.delete`**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec'
  const token = '<TOKEN>'
  const post = (action, payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload })
  }).then((r) => r.json())

  const creado = await post('plato.upsert', {
    nombre: 'Plato de prueba E2E', temporada: 'TODAS', etiquetas: 'prueba', notas: ''
  })
  const idPlato = creado.result.id_plato
  const editado = await post('plato.upsert', {
    id_plato: idPlato, nombre: 'Plato de prueba E2E (editado)', temporada: 'TODAS',
    etiquetas: 'prueba', notas: '', activo: true
  })
  const borrado = await post('plato.delete', { id_plato: idPlato })
  const bootstrap = await fetch(url + '?action=bootstrap').then((r) => r.json())
  const enBootstrap = bootstrap.platos.find((p) => String(p.id_plato) === String(idPlato))

  return { creado, editado, borrado, enBootstrap }
}
```

Expected: `creado.result.id_plato` es un entero nuevo (10, si los 9
originales siguen ahí); `enBootstrap.activo === false` tras el borrado
lógico y `enBootstrap.nombre` refleja la edición.

- [x] **Step 6 (agente): `ingrediente.upsert` / `ingrediente.delete`**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec'
  const token = '<TOKEN>'
  const post = (action, payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload })
  }).then((r) => r.json())

  const creado = await post('ingrediente.upsert', {
    nombre: 'Ingrediente de prueba E2E', proveedor: 'Mercadona', unidad_base: 'g', temporada: 'TODAS'
  })
  const borrado = await post('ingrediente.delete', { id_ingrediente: creado.result.id_ingrediente })
  return { creado, borrado }
}
```

Expected: `creado.result.id_ingrediente` nuevo (16, si los 15 originales
siguen ahí); `borrado` → `{deleted:true}`.

- [x] **Step 7 (agente): `platoIngredientes.replace`**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec'
  const token = '<TOKEN>'
  const post = (action, payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload })
  }).then((r) => r.json())

  const reemplazo = await post('platoIngredientes.replace', {
    id_plato: 1,
    ingredientes: [{ id_ingrediente: 1, cantidad: 0.6, unidad: 'g' }]
  })
  const bootstrap = await fetch(url + '?action=bootstrap').then((r) => r.json())
  const filasDelPlato1 = bootstrap.ingredientesPlatos.filter((row) => String(row.id_plato) === '1')
  return { reemplazo, filasDelPlato1 }
}
```

Expected: `reemplazo.result` → `{id_plato:1, count:1}`; `filasDelPlato1`
tiene exactamente 1 fila con `cantidad:0.6` (las filas originales del
plato 1 — Gazpacho — fueron sustituidas).

**Nota:** este paso modifica de verdad los ingredientes del Gazpacho en la
hoja real. Antes de darlo por bueno, restaurar manualmente sus ingredientes
originales desde la hoja de Google (Tomate 500g, Pepino 1ud, Cebolla 1ud,
Manzana verde 500g) o volver a llamar a `platoIngredientes.replace` con
esos valores.

- [x] **Step 8 (agente): `regla.upsert` / `regla.delete`**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec'
  const token = '<TOKEN>'
  const post = (action, payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload })
  }).then((r) => r.json())

  const creada = await post('regla.upsert', { etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true })
  const borrada = await post('regla.delete', { id: creada.result.id })
  return { creada, borrada }
}
```

Expected: `creada.result.id` es `1` (primera fila de `reglas`);
`borrada` → `{deleted:true}`.

- [x] **Step 9: Registrar el resultado en la spec**

Añadir al final de `docs/specs/2026-09-06-menu-familiar-design.md`, bajo
`## Resultado de la migración y verificación E2E de la API`, un resumen
del informe de `admin.migrate` (Step 2) y la confirmación de que las 10
acciones de escritura y 2 de lectura pasaron. Commitear:

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: resultado de la migración y verificación E2E de la API"
```

**Si algún paso falla:** detener aquí y no escribir el plan de la capa de
datos del frontend hasta corregir la acción correspondiente en
`Codigo.gs`, redesplegar una nueva versión y repetir la verificación de
esa acción.
