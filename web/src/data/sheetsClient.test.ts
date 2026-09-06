import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/mswServer'
import { ApiError, createSheetsClient } from './sheetsClient'

const client = createSheetsClient({ baseUrl: 'https://script.example.com/exec', token: 't0k3n' })

describe('apiGet', () => {
  it('añade action y params como query string y devuelve el JSON', async () => {
    server.use(
      http.get('https://script.example.com/exec', ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('action')).toBe('plan')
        expect(url.searchParams.get('desde')).toBe('2026-09-07')
        return HttpResponse.json({ ok: true, entries: [] })
      })
    )
    const resultado = await client.apiGet('plan', { desde: '2026-09-07', hasta: '2026-09-11' })
    expect(resultado).toEqual({ ok: true, entries: [] })
  })

  it('lanza ApiError si la API responde ok:false', async () => {
    server.use(
      http.get('https://script.example.com/exec', () => HttpResponse.json({ ok: false, error: 'boom' }))
    )
    await expect(client.apiGet('bootstrap')).rejects.toThrow(ApiError)
  })
})

describe('apiPost', () => {
  it('envía Content-Type text/plain con action, token y payload, y devuelve result', async () => {
    server.use(
      http.post('https://script.example.com/exec', async ({ request }) => {
        expect(request.headers.get('content-type')).toContain('text/plain')
        const body = (await request.json()) as { action: string; token: string; payload: unknown }
        expect(body).toEqual({ action: 'plan.set', token: 't0k3n', payload: { fecha: '2026-09-07' } })
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const resultado = await client.apiPost('plan.set', { fecha: '2026-09-07' })
    expect(resultado).toEqual({ id: 1 })
  })

  it('lanza ApiError si la API responde ok:false', async () => {
    server.use(
      http.post('https://script.example.com/exec', () =>
        HttpResponse.json({ ok: false, error: 'token inválido' })
      )
    )
    await expect(client.apiPost('plan.set', {})).rejects.toThrow('token inválido')
  })
})
