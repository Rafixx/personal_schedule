import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { useWeekPlan } from './useWeekPlan'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function mockApi(entries: unknown[]) {
  server.use(
    http.get(API_URL, ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get('action') === 'bootstrap') {
        return HttpResponse.json({
          ok: true,
          platos: [
            { id_plato: 5, nombre: 'Pasta', temporada: 'TODAS', etiquetas: 'pasta', notas: '', activo: true }
          ],
          ingredientes: [],
          ingredientesPlatos: [],
          reglas: [{ id: 1, etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 0, activa: true }],
          proveedores: []
        })
      }
      return HttpResponse.json({ ok: true, entries })
    })
  )
}

describe('useWeekPlan', () => {
  it('construye los días de la semana y evalúa las reglas sobre ellos', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 5, notas: '' }])
    const { result } = renderHook(() => useWeekPlan(new Date(2026, 8, 7)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.dias).toHaveLength(5)
    expect(result.current.dias[0].huecos[0].plato?.nombre).toBe('Pasta')
    expect(result.current.estadosRegla).toHaveLength(1)
    expect(result.current.estadosRegla[0].estado).toBe('aviso')
  })

  it('asignarPlato llama a plan.set con fecha, turno, orden e id_plato correctos', async () => {
    mockApi([])
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const { result } = renderHook(() => useWeekPlan(new Date(2026, 8, 7)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    result.current.asignarPlato('2026-09-07', 1, 5)
    await waitFor(() => expect(result.current.guardando).toBe(false))
    expect(payloadRecibido).toEqual({
      action: 'plan.set',
      token: 'test-token',
      payload: { fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 5, notas: '' }
    })
  })

  it('quitarPlato llama a plan.delete con fecha, turno y orden correctos', async () => {
    mockApi([])
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const { result } = renderHook(() => useWeekPlan(new Date(2026, 8, 7)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    result.current.quitarPlato('2026-09-07', 2)
    await waitFor(() => expect(result.current.guardando).toBe(false))
    expect(payloadRecibido).toEqual({
      action: 'plan.delete',
      token: 'test-token',
      payload: { fecha: '2026-09-07', turno: 'COMIDA', orden: 2 }
    })
  })

  it('asignarPlato actualiza el tablero al instante, antes de que resuelva el POST', async () => {
    mockApi([])
    let resolverPost: (() => void) | undefined
    server.use(
      http.post(API_URL, async () => {
        await new Promise<void>((resolve) => {
          resolverPost = resolve
        })
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const { result } = renderHook(() => useWeekPlan(new Date(2026, 8, 7)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))

    result.current.asignarPlato('2026-09-07', 1, 5)

    await waitFor(() => expect(result.current.dias[0].huecos[0].plato?.nombre).toBe('Pasta'))
    expect(resolverPost).toBeDefined()

    resolverPost?.()
    await waitFor(() => expect(result.current.guardando).toBe(false))
  })

  it('revierte el tablero si el POST de quitarPlato falla', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 5, notas: '' }])
    server.use(http.post(API_URL, () => HttpResponse.json({ ok: false, error: 'fallo' }, { status: 500 })))
    const { result } = renderHook(() => useWeekPlan(new Date(2026, 8, 7)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.dias[0].huecos[0].plato?.nombre).toBe('Pasta')

    result.current.quitarPlato('2026-09-07', 1)

    await waitFor(() => expect(result.current.dias[0].huecos[0].plato).toBeNull())
    await waitFor(() => expect(result.current.dias[0].huecos[0].plato?.nombre).toBe('Pasta'), { timeout: 8000 })
  }, 10000)
})
