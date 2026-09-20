export class ApiError extends Error {
  code?: string
  // Solo lo manda la API en LOCKED_OUT (ver Codigo.gs respuestaBloqueado_):
  // segundos que faltan para poder reintentar el login.
  reintentarEnS?: number

  constructor(message: string, code?: string, reintentarEnS?: number) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.reintentarEnS = reintentarEnS
  }
}

// Se lanza en vez de ApiError cuando la API responde code:'UNAUTHENTICATED',
// para que quien consuma el cliente pueda distinguir "sesión inválida o
// revocada" (hay que volver al login) de cualquier otro error de la API.
export class SesionInvalidaError extends ApiError {
  constructor(message: string) {
    super(message, 'UNAUTHENTICATED')
    this.name = 'SesionInvalidaError'
  }
}

export interface SheetsClient {
  apiGet: (action: string, params?: Record<string, string>) => Promise<unknown>
  apiPost: (action: string, payload?: unknown) => Promise<unknown>
}

interface RespuestaApi {
  ok: boolean
  code?: string
  error?: string
  result?: unknown
  reintentar_en_s?: number
}

function lanzarSiRespuestaError(json: RespuestaApi): void {
  if (json.ok === false) {
    const mensaje = json.error ?? 'error desconocido'
    if (json.code === 'UNAUTHENTICATED') throw new SesionInvalidaError(mensaje)
    throw new ApiError(mensaje, json.code, json.reintentar_en_s)
  }
}

export function createSheetsClient(config: { baseUrl: string; getToken: () => string | null }): SheetsClient {
  async function apiGet(action: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(config.baseUrl)
    url.searchParams.set('action', action)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    const token = config.getToken()
    if (token !== null) url.searchParams.set('token', token)
    const res = await fetch(url.toString())
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`)
    const json = (await res.json()) as RespuestaApi
    lanzarSiRespuestaError(json)
    return json
  }

  async function apiPost(action: string, payload: unknown = {}): Promise<unknown> {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: config.getToken(), payload })
    })
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`)
    const json = (await res.json()) as RespuestaApi
    lanzarSiRespuestaError(json)
    // auth.login es la única acción POST cuya respuesta no viene envuelta en
    // { ok:true, result:... } (ver Codigo.gs, doPost): en éxito devuelve
    // { ok:true, token, usuario, id_sesion } al mismo nivel que `ok`. Para
    // el resto de acciones json.result sí es la forma correcta.
    if (action === 'auth.login') return json
    return json.result
  }

  return { apiGet, apiPost }
}
