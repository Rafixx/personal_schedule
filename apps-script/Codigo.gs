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
    'Arrroz basmati': 'Arroz basmati',
    'Mira al talll': 'Mira al tall'
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
