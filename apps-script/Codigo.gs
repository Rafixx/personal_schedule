/**
 * API del planificador de menú familiar sobre Google Sheets.
 * Lectura vía doGet, escritura vía doPost; ambas exigen una sesión
 * válida (ver autenticar_) salvo auth.usuarios y auth.login.
 * Cada escritura corre bajo LockService para evitar carreras entre
 * peticiones simultáneas desde varios dispositivos.
 */

var SHEET_NAMES = {
  PLATOS: 'platos',
  INGREDIENTES: 'ingredientes',
  INGREDIENTES_PLATOS: 'ingredientes_platos',
  PLAN: 'plan',
  REGLAS: 'reglas',
  PROVEEDORES: 'proveedores',
  USUARIOS: 'usuarios',
  SESIONES: 'sesiones',
  COMPRA_MARCAS: 'compra_marcas'
}

var SCHEMA = {
  platos: ['id_plato', 'nombre', 'temporada', 'etiquetas', 'notas', 'activo'],
  ingredientes: [
    'id_ingrediente', 'nombre', 'proveedor', 'unidad_base', 'temporada',
    'kcal_100', 'prot_100', 'carb_100', 'grasa_100'
  ],
  ingredientes_platos: ['id', 'id_plato', 'id_ingrediente', 'cantidad', 'unidad'],
  plan: ['id', 'fecha', 'turno', 'orden', 'id_plato', 'notas'],
  reglas: ['id', 'etiqueta', 'tipo', 'valor', 'activa'],
  proveedores: ['nombre', 'orden'],
  usuarios: [
    'id_usuario', 'nombre', 'pin_hash', 'pin_salt', 'pin_iteraciones',
    'activo', 'intentos_fallidos', 'bloqueado_hasta', 'ultimo_login'
  ],
  sesiones: [
    'id_sesion', 'id_usuario', 'token_hash', 'dispositivo', 'creado_en',
    'ultimo_uso', 'activa', 'revocado_en'
  ],
  compra_marcas: ['id', 'semana', 'id_ingrediente', 'unidad']
}

// ---------- Helpers de hoja ----------

function getSheet_(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(name)
  if (!sheet) sheet = ss.insertSheet(name)
  return sheet
}

function ensureSchemaForzado_() {
  Object.keys(SCHEMA).forEach(function (name) {
    var sheet = getSheet_(name)
    var headers = SCHEMA[name]
    var currentRow = sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    var matches = headers.every(function (h, i) { return currentRow[i] === h })
    if (!matches) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    }
  })
  // Forzar formato texto '@' en columnas donde un valor casualmente
  // numérico (todo dígitos) haría que Sheets lo coaccionara a número y
  // perdiera ceros a la izquierda (fechas ISO, hashes, tokens).
  formatearColumnaTexto_(SHEET_NAMES.PLAN, 'fecha')
  formatearColumnaTexto_(SHEET_NAMES.USUARIOS, 'pin_hash')
  formatearColumnaTexto_(SHEET_NAMES.USUARIOS, 'pin_salt')
  formatearColumnaTexto_(SHEET_NAMES.SESIONES, 'token_hash')
  formatearColumnaTexto_(SHEET_NAMES.COMPRA_MARCAS, 'semana')
}

// ensureSchemaForzado_ recorre 8 hojas leyendo cabeceras y fijando formatos
// en cada petición autenticada; se cachea 1h para no pagar ese coste en
// cada request. Las funciones admin (adminInicializarAuth, adminSetPin)
// llaman a ensureSchemaForzado_ directamente para no depender de que la
// caché haya caducado al dar de alta usuarios.
function ensureSchema_() {
  var cache = CacheService.getScriptCache()
  if (cache.get('schema:ok')) return
  ensureSchemaForzado_()
  cache.put('schema:ok', '1', 3600)
}

function formatearColumnaTexto_(hoja, columna) {
  var sheet = getSheet_(hoja)
  var col = SCHEMA[hoja].indexOf(columna) + 1
  var maxRows = Math.max(sheet.getMaxRows() - 1, 1)
  sheet.getRange(2, col, maxRows, 1).setNumberFormat('@')
}

function fraccionDesdeFecha_(fecha) {
  var dia = Number(Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'd'))
  var mes = Number(Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'M'))
  return dia / mes
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

// HTTP siempre 200 (ContentService no permite otra cosa); `code` es lo que
// deja al frontend distinguir "vuelve a entrar" de un error reintentable.
function errorOutput_(code, mensaje) {
  return jsonOutput_({ ok: false, code: code, error: mensaje })
}

// ---------- Lectura ----------

function doGet(e) {
  var params = (e && e.parameter) || {}
  var action = params.action || null
  try {
    // Única acción pública del GET: alimenta el selector de la pantalla de login.
    if (action === 'auth.usuarios') {
      return jsonOutput_({ ok: true, usuarios: listaUsuariosPublica_() })
    }
    var sesion = autenticar_(params.token)
    if (!sesion) return errorOutput_('UNAUTHENTICATED', 'sesión inválida o revocada')

    ensureSchema_()
    if (action === 'bootstrap') return jsonOutput_(bootstrapResponse_())
    if (action === 'plan') {
      return jsonOutput_({ ok: true, entries: getPlan_(params.desde, params.hasta) })
    }
    if (action === 'compra') {
      return jsonOutput_({ ok: true, marcas: getCompraMarcas_(params.semana) })
    }
    return errorOutput_('UNKNOWN_ACTION', 'acción GET desconocida: ' + action)
  } catch (err) {
    return errorOutput_('INTERNAL', String(err))
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

function getCompraMarcas_(semana) {
  return sheetToObjects_(SHEET_NAMES.COMPRA_MARCAS)
    .filter(function (m) { return normalizeFecha_(m.semana) === semana })
}

// ---------- Escritura ----------

function doPost(e) {
  var body
  try {
    body = JSON.parse(e.postData.contents)
  } catch (err) {
    return errorOutput_('BAD_REQUEST', 'body no es JSON válido')
  }

  // auth.login se resuelve antes de exigir sesión (es como se consigue una)
  // y bajo su propio lock corto: no debe competir con el lock de 10s del
  // resto de acciones ni bloquearse por él.
  if (body.action === 'auth.login') {
    var lockLogin = LockService.getScriptLock()
    try {
      lockLogin.waitLock(5000)
    } catch (err) {
      return errorOutput_('BUSY', 'inténtalo de nuevo')
    }
    try {
      // login_ ya construye su propio sobre { ok, code, ... }; no se
      // re-envuelve en { ok: true, result: ... } como el resto de acciones.
      return jsonOutput_(login_(body.payload || {}))
    } catch (err) {
      return errorOutput_('INTERNAL', String(err))
    } finally {
      lockLogin.releaseLock()
    }
  }

  var sesion = autenticar_(body.token)
  if (!sesion) {
    return errorOutput_('UNAUTHENTICATED', 'sesión inválida o revocada')
  }

  ensureSchema_()
  var lock = LockService.getScriptLock()
  lock.waitLock(10000)
  try {
    var result = routeAction_(body.action, body.payload || {}, sesion)
    return jsonOutput_({ ok: true, result: result })
  } catch (err) {
    return errorOutput_('INTERNAL', String(err))
  } finally {
    lock.releaseLock()
  }
}

function routeAction_(action, payload, sesion) {
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
    'admin.migrate': adminMigrate_,
    'auth.logout': authLogout_,
    'compra.marcar': compraMarcar_
  }
  var handler = handlers[action]
  if (!handler) throw new Error('acción POST desconocida: ' + action)
  return handler(payload, sesion)
}

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

function planDelete_(payload) {
  var existing = findRow_(SHEET_NAMES.PLAN, function (row) {
    return normalizeFecha_(row.fecha) === payload.fecha && row.turno === payload.turno &&
      String(row.orden) === String(payload.orden)
  })
  if (existing) deleteRow_(SHEET_NAMES.PLAN, existing._row)
  return { deleted: !!existing }
}

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

// La presencia de la fila significa "comprado": marcar añade fila,
// desmarcar la borra. Evita acumular filas FALSE y refleja el mismo par
// plan.set/plan.delete. Idempotente en ambos sentidos.
function compraMarcar_(payload) {
  var existente = findRow_(SHEET_NAMES.COMPRA_MARCAS, function (m) {
    return normalizeFecha_(m.semana) === payload.semana &&
      String(m.id_ingrediente) === String(payload.id_ingrediente) &&
      m.unidad === payload.unidad
  })
  if (payload.comprado) {
    if (existente) return { comprado: true }
    var id = nextId_(SHEET_NAMES.COMPRA_MARCAS, 'id')
    appendRow_(SHEET_NAMES.COMPRA_MARCAS, [id, payload.semana, payload.id_ingrediente, payload.unidad])
    return { comprado: true }
  }
  if (existente) deleteRow_(SHEET_NAMES.COMPRA_MARCAS, existente._row)
  return { comprado: false }
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
    // Sheets a veces interpreta "1/2" escrito a mano como una fecha
    // (1 de febrero) en vez de como texto; reconstruimos la fracción a
    // partir del día/mes antes de forzar el formato numérico de la celda.
    if (typeof row.cantidad === 'string' && row.cantidad.indexOf('/') !== -1) {
      var parts = row.cantidad.split('/')
      var valorTexto = Number(parts[0]) / Number(parts[1])
      ipSheet.getRange(row._row, cantidadCol).setValue(valorTexto).setNumberFormat('0.####')
      report.cantidadesNormalizadas++
    } else if (row.cantidad instanceof Date) {
      var valorFecha = fraccionDesdeFecha_(row.cantidad)
      ipSheet.getRange(row._row, cantidadCol).setValue(valorFecha).setNumberFormat('0.####')
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

// ---------- Autenticación: configuración ----------

var AUTH = {
  ITERACIONES_PIN: 1000,
  MAX_INTENTOS: 5,
  BLOQUEO_BASE_MS: 15 * 60 * 1000,
  BLOQUEO_MAX_MS: 60 * 60 * 1000, // tope de 1h: con 10^6 PIN posibles ya es disuasorio
  CACHE_SESION_S: 300,
  CACHE_USUARIOS_S: 300
}

// ---------- Autenticación: primitivas criptográficas ----------

// Memoizado a nivel de módulo: sin esto, derivarPin_ haría una lectura de
// PropertiesService por iteración (1000 RPC = varios segundos por login).
var PEPPER_MEMO = null

function getPepper_() {
  if (PEPPER_MEMO) return PEPPER_MEMO
  var pepper = PropertiesService.getScriptProperties().getProperty('AUTH_PEPPER')
  if (!pepper) throw new Error('falta AUTH_PEPPER: ejecuta adminInicializarAuth una vez')
  PEPPER_MEMO = pepper
  return pepper
}

// Los Byte[] de Apps Script vienen con signo (-128..127): sin normalizar
// a 0..255 el hex sale corrupto.
function bytesAHex_(bytes) {
  var hex = ''
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256
    hex += (b < 16 ? '0' : '') + b.toString(16)
  }
  return hex
}

function hmacHex_(mensaje) {
  return bytesAHex_(
    Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, mensaje, getPepper_())
  )
}

// KDF casero: no hay PBKDF2 en Apps Script. Iterar HMAC con el pepper como
// clave es lo más parecido que se puede montar con Utilities.
function derivarPin_(pin, salt, iteraciones) {
  var acc = 'pin:' + salt + ':' + pin
  for (var i = 0; i < iteraciones; i++) acc = hmacHex_(acc)
  return acc
}

// El token tiene ~244 bits de entropía: una sola pasada basta, no hay
// nada que fuerza-brutear.
function hashToken_(token) {
  return hmacHex_('tok:' + token)
}

function nuevoSecreto_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '')
}

function comparaSegura_(a, b) {
  var sa = String(a)
  var sb = String(b)
  if (sa.length !== sb.length) return false
  var diff = 0
  for (var i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i)
  return diff === 0
}

// Sheets devuelve `true`, `'TRUE'` o incluso `''` según cómo se haya
// escrito la celda (checkbox vs texto vs valor por defecto).
function esVerdadero_(valor) {
  return valor === true || valor === 1 || String(valor).toLowerCase() === 'true'
}

function ahoraIso_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd'T'HH:mm:ss")
}

// Función de calibración (Step 3 del brief): ejecutar a mano desde el editor
// de Apps Script, mirar el Logger y fijar AUTH.ITERACIONES_PIN en el mayor
// valor que quede por debajo de ~400ms.
function benchPin() {
  var salt = nuevoSecreto_()
  var candidatos = [100, 500, 1000, 2000, 5000]
  candidatos.forEach(function (n) {
    var t0 = Date.now()
    derivarPin_('123456', salt, n)
    Logger.log(n + ' iteraciones: ' + (Date.now() - t0) + ' ms')
  })
}

// ---------- Autenticación: bloqueo por intentos fallidos ----------

function cachearBloqueo_(idUsuario, hasta) {
  var segundos = Math.ceil((hasta - Date.now()) / 1000)
  if (segundos <= 0) return
  CacheService.getScriptCache().put('bloq:' + idUsuario, String(hasta), Math.min(segundos, 21600))
}

function respuestaBloqueado_(hasta) {
  return {
    ok: false,
    code: 'LOCKED_OUT',
    error: 'demasiados intentos fallidos',
    reintentar_en_s: Math.max(Math.ceil((hasta - Date.now()) / 1000), 1)
  }
}

function escribirUsuario_(usuario, cambios) {
  var fila = SCHEMA.usuarios.map(function (col) {
    return Object.prototype.hasOwnProperty.call(cambios, col) ? cambios[col] : usuario[col]
  })
  writeRow_(SHEET_NAMES.USUARIOS, SCHEMA.usuarios, usuario._row, fila)
}

function registrarFallo_(usuario) {
  var fallos = (Number(usuario.intentos_fallidos) || 0) + 1
  var bloqueadoHasta = 0
  if (fallos >= AUTH.MAX_INTENTOS) {
    var exceso = fallos - AUTH.MAX_INTENTOS
    var espera = Math.min(AUTH.BLOQUEO_BASE_MS * Math.pow(2, exceso), AUTH.BLOQUEO_MAX_MS)
    bloqueadoHasta = Date.now() + espera
    cachearBloqueo_(String(usuario.id_usuario), bloqueadoHasta)
  }
  escribirUsuario_(usuario, { intentos_fallidos: fallos, bloqueado_hasta: bloqueadoHasta })
}

function registrarExito_(usuario) {
  CacheService.getScriptCache().remove('bloq:' + usuario.id_usuario)
  escribirUsuario_(usuario, { intentos_fallidos: 0, bloqueado_hasta: 0, ultimo_login: ahoraIso_() })
}

// ---------- Autenticación: sesiones ----------

function cachearSesion_(tokenHash, sesion) {
  CacheService.getScriptCache().put('ses:' + tokenHash, JSON.stringify(sesion), AUTH.CACHE_SESION_S)
}

function autenticar_(token) {
  if (!token || typeof token !== 'string' || token.length < 32) return null
  var hash = hashToken_(token)
  var cache = CacheService.getScriptCache()
  var enCache = cache.get('ses:' + hash)
  if (enCache) return JSON.parse(enCache)

  var fila = findRow_(SHEET_NAMES.SESIONES, function (s) {
    return esVerdadero_(s.activa) && comparaSegura_(String(s.token_hash), hash)
  })
  if (!fila) return null
  var usuario = findRow_(SHEET_NAMES.USUARIOS, function (u) {
    return String(u.id_usuario) === String(fila.id_usuario)
  })
  if (!usuario || !esVerdadero_(usuario.activo)) return null

  var sesion = {
    id_sesion: Number(fila.id_sesion),
    id_usuario: Number(fila.id_usuario),
    nombre: String(usuario.nombre)
  }
  cachearSesion_(hash, sesion)
  tocarSesion_(fila)
  return sesion
}

// Actualiza ultimo_uso como mucho una vez cada 6h por sesión: escribirlo en
// cada petición sería una escritura por request y contención del lock.
function tocarSesion_(fila) {
  var cache = CacheService.getScriptCache()
  var clave = 'uso:' + fila.id_sesion
  if (cache.get(clave)) return
  cache.put(clave, '1', 21600)
  var col = SCHEMA.sesiones.indexOf('ultimo_uso') + 1
  getSheet_(SHEET_NAMES.SESIONES).getRange(fila._row, col).setValue(ahoraIso_())
}

function crearSesion_(usuario, token, dispositivo) {
  var id = nextId_(SHEET_NAMES.SESIONES, 'id_sesion')
  var hash = hashToken_(token)
  var etiqueta = String(dispositivo || 'dispositivo').substring(0, 60)
  appendRow_(SHEET_NAMES.SESIONES,
    [id, usuario.id_usuario, hash, etiqueta, ahoraIso_(), ahoraIso_(), true, ''])
  cachearSesion_(hash, {
    id_sesion: id,
    id_usuario: Number(usuario.id_usuario),
    nombre: String(usuario.nombre)
  })
  return { id_sesion: id }
}

function revocarFilaSesion_(fila) {
  if (!esVerdadero_(fila.activa)) return false
  var valores = SCHEMA.sesiones.map(function (col) {
    if (col === 'activa') return false
    if (col === 'revocado_en') return ahoraIso_()
    return fila[col]
  })
  writeRow_(SHEET_NAMES.SESIONES, SCHEMA.sesiones, fila._row, valores)
  // La revocación es inmediata porque la clave de caché se deriva del
  // token_hash, que sí tenemos en la hoja (nunca del token en claro).
  var cache = CacheService.getScriptCache()
  cache.remove('ses:' + String(fila.token_hash))
  cache.remove('uso:' + fila.id_sesion)
  return true
}

function exigirSesion_(sesion) {
  if (!sesion) throw new Error('esta acción requiere iniciar sesión')
  return sesion
}

// ---------- Autenticación: acciones ----------

function login_(payload) {
  var idUsuario = String(payload.id_usuario || '')
  var pin = String(payload.pin || '')
  var generico = { ok: false, code: 'INVALID_CREDENTIALS', error: 'usuario o PIN incorrectos' }
  if (!idUsuario || !/^[0-9]{6}$/.test(pin)) return generico

  // Camino rápido: rechaza un bloqueo vigente sin abrir la hoja de cálculo.
  var enCache = CacheService.getScriptCache().get('bloq:' + idUsuario)
  if (enCache && Number(enCache) > Date.now()) return respuestaBloqueado_(Number(enCache))

  ensureSchema_()
  var usuario = findRow_(SHEET_NAMES.USUARIOS, function (u) {
    return String(u.id_usuario) === idUsuario
  })
  if (!usuario || !esVerdadero_(usuario.activo) || !usuario.pin_hash) return generico

  var bloqueadoHasta = Number(usuario.bloqueado_hasta) || 0
  if (bloqueadoHasta > Date.now()) {
    cachearBloqueo_(idUsuario, bloqueadoHasta)
    return respuestaBloqueado_(bloqueadoHasta)
  }

  var iteraciones = Number(usuario.pin_iteraciones) || AUTH.ITERACIONES_PIN
  if (!comparaSegura_(derivarPin_(pin, String(usuario.pin_salt), iteraciones), String(usuario.pin_hash))) {
    registrarFallo_(usuario)
    return generico
  }

  registrarExito_(usuario)
  var token = nuevoSecreto_()
  var sesion = crearSesion_(usuario, token, payload.dispositivo)
  return {
    ok: true,
    token: token,
    usuario: { id_usuario: Number(usuario.id_usuario), nombre: String(usuario.nombre) },
    id_sesion: sesion.id_sesion
  }
}

// GET público: solo id_usuario y nombre de los activos, para pintar el
// selector de usuario antes de iniciar sesión. Cacheado para que un
// bombardeo anónimo no abra el spreadsheet en cada petición.
function listaUsuariosPublica_() {
  var cache = CacheService.getScriptCache()
  var enCache = cache.get('usuarios:lista')
  if (enCache) return JSON.parse(enCache)
  var lista = sheetToObjects_(SHEET_NAMES.USUARIOS)
    .filter(function (u) { return esVerdadero_(u.activo) })
    .map(function (u) { return { id_usuario: Number(u.id_usuario), nombre: String(u.nombre) } })
  cache.put('usuarios:lista', JSON.stringify(lista), AUTH.CACHE_USUARIOS_S)
  return lista
}

function authLogout_(payload, sesion) {
  exigirSesion_(sesion)
  var fila = findRow_(SHEET_NAMES.SESIONES, function (s) {
    return String(s.id_sesion) === String(sesion.id_sesion)
  })
  return { revocadas: fila && revocarFilaSesion_(fila) ? 1 : 0 }
}

// ---------- Autenticación: administración (ejecutar a mano desde el editor) ----------

function adminInicializarAuth() {
  ensureSchemaForzado_()
  var props = PropertiesService.getScriptProperties()
  if (!props.getProperty('AUTH_PEPPER')) {
    props.setProperty('AUTH_PEPPER', Utilities.base64Encode(Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      Utilities.getUuid() + Utilities.getUuid() + String(Date.now())
    )))
    Logger.log('AUTH_PEPPER creado')
  } else {
    Logger.log('AUTH_PEPPER ya existía; NO lo regeneres: invalidaría todos los PIN y sesiones')
  }
  Logger.log('hojas usuarios/sesiones listas')
}

function adminSetPin() {
  var props = PropertiesService.getScriptProperties()
  var nombre = String(props.getProperty('ADMIN_NOMBRE') || '').trim()
  var pin = String(props.getProperty('ADMIN_PIN') || '').trim()
  try {
    if (!nombre) throw new Error('define ADMIN_NOMBRE en Propiedades del script')
    if (!/^[0-9]{6}$/.test(pin)) throw new Error('ADMIN_PIN debe tener 6 dígitos')
    ensureSchemaForzado_()
    var existente = findRow_(SHEET_NAMES.USUARIOS, function (u) {
      return String(u.nombre).trim().toLowerCase() === nombre.toLowerCase()
    })
    var salt = nuevoSecreto_()
    var hash = derivarPin_(pin, salt, AUTH.ITERACIONES_PIN)
    if (existente) {
      escribirUsuario_(existente, {
        pin_hash: hash, pin_salt: salt, pin_iteraciones: AUTH.ITERACIONES_PIN,
        activo: true, intentos_fallidos: 0, bloqueado_hasta: 0
      })
      var revocadas = revocarSesionesDeUsuario_(existente.id_usuario, 0)
      Logger.log('PIN actualizado: ' + nombre + ' (id ' + existente.id_usuario +
        '), ' + revocadas + ' sesiones revocadas')
    } else {
      var id = nextId_(SHEET_NAMES.USUARIOS, 'id_usuario')
      appendRow_(SHEET_NAMES.USUARIOS,
        [id, nombre, hash, salt, AUTH.ITERACIONES_PIN, true, 0, 0, ''])
      Logger.log('usuario creado: ' + nombre + ' (id ' + id + ')')
    }
    CacheService.getScriptCache().remove('usuarios:lista')
  } finally {
    // Aunque haya fallado: el PIN no se queda dando vueltas por el almacén.
    props.deleteProperty('ADMIN_PIN')
    props.deleteProperty('ADMIN_NOMBRE')
  }
}

function revocarSesionesDeUsuario_(idUsuario, exceptoIdSesion) {
  var revocadas = 0
  sheetToObjects_(SHEET_NAMES.SESIONES).forEach(function (s) {
    if (String(s.id_usuario) !== String(idUsuario)) return
    if (exceptoIdSesion && String(s.id_sesion) === String(exceptoIdSesion)) return
    if (revocarFilaSesion_(s)) revocadas++
  })
  return revocadas
}

function adminDesbloquearUsuario() {
  var ID_USUARIO = 1 // edita este valor antes de ejecutar
  var usuario = findRow_(SHEET_NAMES.USUARIOS, function (u) {
    return String(u.id_usuario) === String(ID_USUARIO)
  })
  if (!usuario) throw new Error('usuario no encontrado: ' + ID_USUARIO)
  CacheService.getScriptCache().remove('bloq:' + ID_USUARIO)
  escribirUsuario_(usuario, { intentos_fallidos: 0, bloqueado_hasta: 0 })
  Logger.log('desbloqueado: ' + usuario.nombre)
}

function adminDesactivarUsuario() {
  var ID_USUARIO = 1 // edita este valor antes de ejecutar
  var usuario = findRow_(SHEET_NAMES.USUARIOS, function (u) {
    return String(u.id_usuario) === String(ID_USUARIO)
  })
  if (!usuario) throw new Error('usuario no encontrado: ' + ID_USUARIO)
  escribirUsuario_(usuario, { activo: false })
  CacheService.getScriptCache().remove('usuarios:lista')
  Logger.log('desactivado ' + usuario.nombre + '; sesiones revocadas: ' +
    revocarSesionesDeUsuario_(ID_USUARIO, 0))
}

function adminPurgarSesiones() {
  var DIAS = 90
  var sheet = getSheet_(SHEET_NAMES.SESIONES)
  var limite = Utilities.formatDate(new Date(Date.now() - DIAS * 86400000),
    Session.getScriptTimeZone(), 'yyyy-MM-dd')
  var borradas = 0
  sheetToObjects_(SHEET_NAMES.SESIONES)
    .filter(function (s) {
      return !esVerdadero_(s.activa) && String(s.ultimo_uso).substring(0, 10) < limite
    })
    .sort(function (a, b) { return b._row - a._row })
    .forEach(function (s) { sheet.deleteRow(s._row); borradas++ })
  Logger.log('sesiones purgadas: ' + borradas)
}
