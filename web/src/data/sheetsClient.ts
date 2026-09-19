export class ApiError extends Error {
  code?: string

  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
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
}

function lanzarSiRespuestaError(json: RespuestaApi): void {
  if (json.ok === false) {
    const mensaje = json.error ?? 'error desconocido'
    if (json.code === 'UNAUTHENTICATED') throw new SesionInvalidaError(mensaje)
    throw new ApiError(mensaje, json.code)
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
    return json.result
  }

  return { apiGet, apiPost }
}
