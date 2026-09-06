# Segundo hueco por comida (primero/segundo) — API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ampliar la pestaña `plan` y las tres acciones de escritura de `plan.*` en `apps-script/Codigo.gs` para soportar dos huecos por comida (`orden` 1 = primero, 2 = segundo), validado en la maqueta de UX aprobada por Rafa. Redesplegar y verificar contra la API real ya en producción.

**Architecture:** Se añade una columna `orden` a la pestaña `plan` (clave de fila pasa de `fecha+turno` a `fecha+turno+orden`). No se cambian las demás pestañas ni acciones. `admin.migrate` no necesita tocar `plan`: la pestaña está vacía (todas las filas de prueba del plan anterior fueron borradas durante su propia verificación E2E).

**Tech Stack:** Google Apps Script (igual que los dos planes anteriores de la API).

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md` (esta plan actualiza la sección "API (Google Apps Script)" y añade una nota de decisión sobre "dos huecos por comida").

## Global Constraints

- `orden` es `1` (primero) o `2` (segundo). No hay un tercer hueco.
- `plan.move` debe soportar tanto mover entre días distintos como intercambiar primero↔segundo del mismo día (la maqueta ya usa el mismo mecanismo para ambos casos).
- Ningún otro esquema de hoja cambia. `platos`, `ingredientes`, `ingredientes_platos`, `reglas`, `proveedores` quedan intactos.
- POST sigue siempre con `Content-Type: text/plain;charset=utf-8`.
- No se commitea ningún secreto.

---

### Task 1: Añadir `orden` al esquema y a las acciones de `plan` en `Codigo.gs`

**Files:**
- Modify: `apps-script/Codigo.gs`

**Interfaces:**
- Consumes: `SCHEMA.plan` actual (`['id', 'fecha', 'turno', 'id_plato', 'notas']`)
- Produces — contrato actualizado que consumirá el plan de dominio/datos:
  - `GET ?action=plan&desde&hasta` → cada entrada de `entries` incluye ahora `orden` (número `1` o `2`)
  - `POST plan.set` → payload `{fecha, turno, orden, id_plato, notas?}` → `{id}`
  - `POST plan.delete` → payload `{fecha, turno, orden}` → `{deleted}`
  - `POST plan.move` → payload `{from:{fecha,turno,orden}, to:{fecha,turno,orden}}` → `{ok:true}`

- [x] **Step 1: Actualizar `SCHEMA.plan`**

En `apps-script/Codigo.gs`, dentro del objeto `SCHEMA`, cambiar:

```javascript
  plan: ['id', 'fecha', 'turno', 'id_plato', 'notas'],
```

por:

```javascript
  plan: ['id', 'fecha', 'turno', 'orden', 'id_plato', 'notas'],
```

- [x] **Step 2: Actualizar `planSet_`**

Reemplazar la función completa por:

```javascript
function planSet_(payload) {
  var existing = findRow_(SHEET_NAMES.PLAN, function (row) {
    return normalizeFecha_(row.fecha) === payload.fecha && row.turno === payload.turno &&
      String(row.orden) === String(payload.orden)
  })
  var notas = payload.notas || ''
  if (existing) {
    writeRow_(SHEET_NAMES.PLAN, SCHEMA.plan, existing._row,
      [existing.id, payload.fecha, payload.turno, payload.orden, payload.id_plato, notas])
    return { id: existing.id }
  }
  var id = nextId_(SHEET_NAMES.PLAN, 'id')
  appendRow_(SHEET_NAMES.PLAN, [id, payload.fecha, payload.turno, payload.orden, payload.id_plato, notas])
  return { id: id }
}
```

- [x] **Step 3: Actualizar `planDelete_`**

Reemplazar la función completa por:

```javascript
function planDelete_(payload) {
  var existing = findRow_(SHEET_NAMES.PLAN, function (row) {
    return normalizeFecha_(row.fecha) === payload.fecha && row.turno === payload.turno &&
      String(row.orden) === String(payload.orden)
  })
  if (existing) deleteRow_(SHEET_NAMES.PLAN, existing._row)
  return { deleted: !!existing }
}
```

- [x] **Step 4: Actualizar `planMove_`**

Reemplazar la función completa por:

```javascript
function planMove_(payload) {
  var from = payload.from
  var to = payload.to
  var fromEntry = findRow_(SHEET_NAMES.PLAN, function (row) {
    return normalizeFecha_(row.fecha) === from.fecha && row.turno === from.turno &&
      String(row.orden) === String(from.orden)
  })
  var toEntry = findRow_(SHEET_NAMES.PLAN, function (row) {
    return normalizeFecha_(row.fecha) === to.fecha && row.turno === to.turno &&
      String(row.orden) === String(to.orden)
  })
  if (fromEntry) {
    planSet_({ fecha: to.fecha, turno: to.turno, orden: to.orden, id_plato: fromEntry.id_plato, notas: fromEntry.notas })
  } else {
    planDelete_(to)
  }
  if (toEntry) {
    planSet_({ fecha: from.fecha, turno: from.turno, orden: from.orden, id_plato: toEntry.id_plato, notas: toEntry.notas })
  } else {
    planDelete_(from)
  }
  return { ok: true }
}
```

- [x] **Step 5: Commit**

```bash
git add apps-script/Codigo.gs
git commit -m "feat: soportar dos huecos por comida (orden) en la API de plan"
```

---

### Task 2: Actualizar la spec

**Files:**
- Modify: `docs/specs/2026-09-06-menu-familiar-design.md`

- [x] **Step 1: Actualizar la fila de `plan` en la tabla de esquema de la hoja**

Cambiar:

```markdown
| `plan` | `id, fecha, turno, id_plato, notas` |
```

por:

```markdown
| `plan` | `id, fecha, turno, orden, id_plato, notas` |
```

- [x] **Step 2: Actualizar la tabla de acciones de la API**

Cambiar las tres filas de `plan.*` en la tabla de acciones por:

```markdown
| `plan.set` | `{fecha, turno, orden, id_plato, notas?}` | `{id}` |
| `plan.delete` | `{fecha, turno, orden}` | `{deleted}` |
| `plan.move` | `{from:{fecha,turno,orden}, to:{fecha,turno,orden}}` | `{ok:true}` |
```

- [x] **Step 3: Añadir la nota de decisión**

Añadir bajo la tabla de acciones:

```markdown
**Dos huecos por comida.** Cada día tiene hasta dos platos dentro del mismo
`turno` (`orden: 1` = primero, `2` = segundo), validado en una maqueta de UX
antes de tocar código (ver Artifact del planificador). `plan.move` con el
mismo `fecha` en `from` y `to` pero distinto `orden` intercambia primero y
segundo del mismo día, usando el mismo mecanismo que mover entre días.
```

- [x] **Step 4: Commit**

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: dos huecos por comida (orden) en el contrato de la API"
```

---

### Task 3: Desplegar y verificar

**Files:**
- N/A (despliegue y verificación)

**Interfaces:**
- Consumes: `apps-script/Codigo.gs` de la Task 1, la URL de despliegue ya conocida
(`https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec`)
y el token ya conocido

- [x] **Step 1 (manual, Rafa): Pegar el archivo completo actualizado y redesplegar**

1. Abre el editor de Apps Script, sustituye todo el contenido de `Código.gs` por el contenido íntegro y actual de `apps-script/Codigo.gs` (te lo paso completo en el chat en su momento).
2. Guarda (Ctrl+S).
3. Implementar → Gestionar implementaciones → lápiz → Nueva versión → Implementar (misma URL).
4. Confirma "listo" en el chat.

- [x] **Step 2 (agente): Verificar que `bootstrap` sigue intacto**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec?action=bootstrap'
  const res = await fetch(url)
  const json = await res.json()
  return { ok: json.ok, nPlatos: json.platos.length, nIngredientes: json.ingredientes.length }
}
```

Expected: `{ok:true, nPlatos:9, nIngredientes:15}` (u otros números si Rafa ya
editó la hoja manualmente entre medias, pero `ok:true` sin excepción).

- [x] **Step 3 (agente): `plan.set` de primero y segundo el mismo día, y lectura**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec'
  const token = '<TOKEN>'
  const post = (action, payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload })
  }).then((r) => r.json())

  const primero = await post('plan.set', { fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 2, notas: '' })
  const segundo = await post('plan.set', { fecha: '2026-09-07', turno: 'COMIDA', orden: 2, id_plato: 3, notas: '' })
  const leido = await fetch(url + '?action=plan&desde=2026-09-07&hasta=2026-09-07').then((r) => r.json())

  return { primero, segundo, leido }
}
```

Expected: `primero.result.id` y `segundo.result.id` son ids distintos;
`leido.entries` tiene **2 filas** para `2026-09-07` (no 1), una con
`orden:1, id_plato:2` y otra con `orden:2, id_plato:3` — confirma que no se
pisan entre sí.

- [x] **Step 4 (agente): `plan.move` intercambiando primero y segundo del mismo día**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec'
  const token = '<TOKEN>'
  const post = (action, payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload })
  }).then((r) => r.json())

  const movido = await post('plan.move', {
    from: { fecha: '2026-09-07', turno: 'COMIDA', orden: 1 },
    to: { fecha: '2026-09-07', turno: 'COMIDA', orden: 2 }
  })
  const leido = await fetch(url + '?action=plan&desde=2026-09-07&hasta=2026-09-07').then((r) => r.json())
  return { movido, leido }
}
```

Expected: `movido` → `{ok:true, result:{ok:true}}`; en `leido.entries`, el
`orden:1` ahora tiene `id_plato:3` y el `orden:2` tiene `id_plato:2`
(intercambiados).

- [x] **Step 5 (agente): `plan.delete` de un solo hueco y limpieza final**

```javascript
async () => {
  const url = 'https://script.google.com/macros/s/AKfycbwXp4Vmb3gWxT14nTZwdHhNHQOOBPCACjHrOFTREi4GkxZRnbvjJmdFViaGZ0uOnHyI/exec'
  const token = '<TOKEN>'
  const post = (action, payload) => fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, token, payload })
  }).then((r) => r.json())

  const del1 = await post('plan.delete', { fecha: '2026-09-07', turno: 'COMIDA', orden: 1 })
  const leidoTras1 = await fetch(url + '?action=plan&desde=2026-09-07&hasta=2026-09-07').then((r) => r.json())
  const del2 = await post('plan.delete', { fecha: '2026-09-07', turno: 'COMIDA', orden: 2 })
  const leidoFinal = await fetch(url + '?action=plan&desde=2026-09-07&hasta=2026-09-07').then((r) => r.json())

  return { del1, leidoTras1, del2, leidoFinal }
}
```

Expected: `del1` → `{deleted:true}`; `leidoTras1.entries` tiene **1 fila**
(solo el `orden:2` que quedaba); `del2` → `{deleted:true}`;
`leidoFinal.entries` está **vacío** — la hoja `plan` queda limpia, sin
residuos de la verificación.

- [x] **Step 6: Registrar el resultado en la spec**

Añadir al final de `docs/specs/2026-09-06-menu-familiar-design.md`, bajo
`## Resultado de la verificación del segundo hueco (orden)`, confirmación
de los 4 pasos anteriores. Commitear y pushear:

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: verificación del segundo hueco por comida (orden)"
git push origin main
```

**Si algún paso falla:** detener aquí y no escribir el plan de dominio/datos
hasta corregir `Codigo.gs`, redesplegar y repetir la verificación fallida.
