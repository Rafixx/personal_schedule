/**
 * Spike de conectividad: confirma que un navegador puede hacer GET y POST
 * contra este Web App sin bloqueos de CORS, antes de construir la API real.
 * No toca la hoja de cálculo todavía.
 */

function doGet(e) {
  var body = JSON.stringify({
    ok: true,
    action: 'get',
    receivedParams: e && e.parameter ? e.parameter : {},
    serverTime: new Date().toISOString()
  })
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  var raw = e && e.postData ? e.postData.contents : null
  var parsed = null
  var parseError = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch (err) {
    parseError = String(err)
  }
  var body = JSON.stringify({
    ok: true,
    action: 'post',
    echoed: parsed,
    parseError: parseError,
    rawLength: raw ? raw.length : 0,
    contentType: e && e.postData ? e.postData.type : null
  })
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON)
}
