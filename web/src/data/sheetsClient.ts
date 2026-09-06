export class ApiError extends Error {}

export interface SheetsClient {
  apiGet: (action: string, params?: Record<string, string>) => Promise<unknown>
  apiPost: (action: string, payload?: unknown) => Promise<unknown>
}

export function createSheetsClient(config: { baseUrl: string; token: string }): SheetsClient {
  async function apiGet(action: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(config.baseUrl)
    url.searchParams.set('action', action)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    const res = await fetch(url.toString())
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`)
    const json = (await res.json()) as { ok: boolean; error?: string }
    if (json.ok === false) throw new ApiError(json.error ?? 'error desconocido')
    return json
  }

  async function apiPost(action: string, payload: unknown = {}): Promise<unknown> {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: config.token, payload })
    })
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`)
    const json = (await res.json()) as { ok: boolean; error?: string; result?: unknown }
    if (json.ok === false) throw new ApiError(json.error ?? 'error desconocido')
    return json.result
  }

  return { apiGet, apiPost }
}
