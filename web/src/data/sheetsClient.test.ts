import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/mswServer'
import { ApiError, SesionInvalidaError, createSheetsClient } from './sheetsClient'

const BASE_URL = 'https://script.example.com/exec'

describe('apiGet', () => {
  it('añade action, params y token como query string cuando hay sesión', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => 't0k3n' })
    server.use(
      http.get(BASE_URL, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('action')).toBe('plan')
        expect(url.searchParams.get('desde')).toBe('2026-09-07')
        expect(url.searchParams.get('token')).toBe('t0k3n')
        return HttpResponse.json({ ok: true, entries: [] })
      })
    )
    const resultado = await client.apiGet('plan', { desde: '2026-09-07', hasta: '2026-09-11' })
    expect(resultado).toEqual({ ok: true, entries: [] })
  })

  it('omite el token de la query string cuando no hay sesión', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => null })
    server.use(
      http.get(BASE_URL, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.has('token')).toBe(false)
        return HttpResponse.json({ ok: true })
      })
    )
    await client.apiGet('auth.usuarios')
  })

  it('lanza ApiError con el code si la API responde ok:false', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => 't0k3n' })
    server.use(http.get(BASE_URL, () => HttpResponse.json({ ok: false, code: 'INTERNAL', error: 'boom' })))
    const promesa = client.apiGet('bootstrap')
    await expect(promesa).rejects.toBeInstanceOf(ApiError)
    await expect(promesa).rejects.not.toBeInstanceOf(SesionInvalidaError)
    await expect(promesa).rejects.toMatchObject({ code: 'INTERNAL', message: 'boom' })
  })

  it('lanza SesionInvalidaError (no ApiError genérico) cuando code es UNAUTHENTICATED', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => 'expirado' })
    server.use(
      http.get(BASE_URL, () => HttpResponse.json({ ok: false, code: 'UNAUTHENTICATED', error: 'sesión inválida' }))
    )
    await expect(client.apiGet('plan')).rejects.toBeInstanceOf(SesionInvalidaError)
  })
})

describe('apiPost', () => {
  it('envía Content-Type text/plain con action, token y payload, y devuelve result', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => 't0k3n' })
    server.use(
      http.post(BASE_URL, async ({ request }) => {
        expect(request.headers.get('content-type')).toContain('text/plain')
        const body = (await request.json()) as { action: string; token: string | null; payload: unknown }
        expect(body).toEqual({ action: 'plan.set', token: 't0k3n', payload: { fecha: '2026-09-07' } })
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const resultado = await client.apiPost('plan.set', { fecha: '2026-09-07' })
    expect(resultado).toEqual({ id: 1 })
  })

  it('incluye token: null en el body cuando no hay sesión', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => null })
    server.use(
      http.post(BASE_URL, async ({ request }) => {
        const body = (await request.json()) as { token: string | null }
        expect(body.token).toBeNull()
        return HttpResponse.json({ ok: true, result: {} })
      })
    )
    await client.apiPost('auth.login', { id_usuario: 1, pin: '123456' })
  })

  it('lanza ApiError con el code si la API responde ok:false', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => 't0k3n' })
    server.use(http.post(BASE_URL, () => HttpResponse.json({ ok: false, code: 'LOCKED_OUT', error: 'bloqueado' })))
    const promesa = client.apiPost('plan.set', {})
    await expect(promesa).rejects.toBeInstanceOf(ApiError)
    await expect(promesa).rejects.not.toBeInstanceOf(SesionInvalidaError)
    await expect(promesa).rejects.toMatchObject({ code: 'LOCKED_OUT', message: 'bloqueado' })
  })

  it('lanza SesionInvalidaError cuando code es UNAUTHENTICATED', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => 'expirado' })
    server.use(
      http.post(BASE_URL, () => HttpResponse.json({ ok: false, code: 'UNAUTHENTICATED', error: 'sesión inválida' }))
    )
    await expect(client.apiPost('plan.set', {})).rejects.toBeInstanceOf(SesionInvalidaError)
  })

  it('propaga reintentar_en_s en el ApiError cuando la respuesta lo incluye (LOCKED_OUT)', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => null })
    server.use(
      http.post(BASE_URL, () =>
        HttpResponse.json({
          ok: false,
          code: 'LOCKED_OUT',
          error: 'demasiados intentos fallidos',
          reintentar_en_s: 125
        })
      )
    )
    const promesa = client.apiPost('auth.login', { id_usuario: 1, pin: '000000' })
    await expect(promesa).rejects.toMatchObject({ code: 'LOCKED_OUT', reintentarEnS: 125 })
  })

  it('deja reintentarEnS a undefined cuando la respuesta no trae reintentar_en_s', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => 't0k3n' })
    server.use(http.post(BASE_URL, () => HttpResponse.json({ ok: false, code: 'INTERNAL', error: 'boom' })))
    const promesa = client.apiPost('plan.set', {})
    await expect(promesa).rejects.toMatchObject({ code: 'INTERNAL', reintentarEnS: undefined })
  })

  it('para auth.login, devuelve la respuesta completa en vez de json.result (la API no la envuelve)', async () => {
    const client = createSheetsClient({ baseUrl: BASE_URL, getToken: () => null })
    server.use(
      http.post(BASE_URL, () =>
        HttpResponse.json({ ok: true, token: 'abc123', usuario: { id_usuario: 1, nombre: 'Rafa' }, id_sesion: 9 })
      )
    )
    const resultado = await client.apiPost('auth.login', { id_usuario: 1, pin: '123456' })
    expect(resultado).toEqual({
      ok: true,
      token: 'abc123',
      usuario: { id_usuario: 1, nombre: 'Rafa' },
      id_sesion: 9
    })
  })
})
