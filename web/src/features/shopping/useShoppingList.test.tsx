import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { registrarMutationDefaults } from '../../data/mutationDefaults'
import { useShoppingList } from './useShoppingList'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // marcarComprado usa useMarcarCompra, que ya no lleva su propio mutationFn:
  // lo busca por mutationKey en el registro de setMutationDefaults, igual que
  // en main.tsx. Cada test crea su propio QueryClient, así que hace falta
  // registrarlo aquí también.
  registrarMutationDefaults(queryClient)
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function mockApi(entries: unknown[], marcasPorSemana: Record<string, unknown[]> = {}) {
  server.use(
    http.get(API_URL, ({ request }) => {
      const url = new URL(request.url)
      const action = url.searchParams.get('action')
      if (action === 'bootstrap') {
        return HttpResponse.json({
          ok: true,
          platos: [{ id_plato: 1, nombre: 'Gazpacho', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }],
          ingredientes: [
            {
              id_ingrediente: 1,
              nombre: 'Tomate',
              proveedor: 'Mercadona',
              unidad_base: 'g',
              temporada: 'TODAS',
              kcal_100: '',
              prot_100: '',
              carb_100: '',
              grasa_100: ''
            }
          ],
          ingredientesPlatos: [{ id: 1, id_plato: 1, id_ingrediente: 1, cantidad: 500, unidad: 'g' }],
          reglas: [],
          proveedores: [{ nombre: 'Mercadona', orden: 1 }]
        })
      }
      if (action === 'compra') {
        const semana = url.searchParams.get('semana') ?? ''
        return HttpResponse.json({ ok: true, marcas: marcasPorSemana[semana] ?? [] })
      }
      return HttpResponse.json({ ok: true, entries })
    })
  )
}

describe('useShoppingList', () => {
  it('agrega los ingredientes del plan de la semana actual por proveedor', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'actual'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.listas).toEqual([
      {
        proveedor: 'Mercadona',
        lineas: [{ idIngrediente: 1, nombre: 'Tomate', proveedor: 'Mercadona', cantidad: 500, unidad: 'g' }]
      }
    ])
  })

  it('la semana siguiente consulta el rango de la semana después de la actual', async () => {
    mockApi([{ id: 1, fecha: '2026-09-14', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'siguiente'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.listas).toHaveLength(1)
  })

  it('comprado refleja las marcas que ya trae la API para esa semana', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }], {
      '2026-09-07': [{ id: 1, semana: '2026-09-07', id_ingrediente: 1, unidad: 'g' }]
    })
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'actual'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))
  })

  it('marcarComprado envía compra.marcar con la semana, el ingrediente y la unidad, y comprado se actualiza', async () => {
    // El GET de recarga que dispara onSettled debe ver la marca ya persistida
    // (como haría el backend real) o el checklist volvería a "no comprado" en
    // cuanto esa recarga sobrescriba la actualización optimista.
    const marcasPorSemana: Record<string, unknown[]> = {}
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }], marcasPorSemana)
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { payload: { semana: string; id_ingrediente: number; unidad: string } }
        payloadRecibido = body
        marcasPorSemana[body.payload.semana] = [
          { id: 1, semana: body.payload.semana, id_ingrediente: body.payload.id_ingrediente, unidad: body.payload.unidad }
        ]
        return HttpResponse.json({ ok: true, result: { comprado: true } })
      })
    )
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'actual'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.comprado(1, 'g')).toBe(false)

    result.current.marcarComprado(1, 'g', true)

    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))
    expect(payloadRecibido).toMatchObject({
      action: 'compra.marcar',
      payload: { semana: '2026-09-07', id_ingrediente: 1, unidad: 'g', comprado: true }
    })
  })

  it('marcarComprado actualiza comprado al instante, antes de que resuelva el POST', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    let resolverPost: (() => void) | undefined
    server.use(
      http.post(API_URL, async () => {
        await new Promise<void>((resolve) => {
          resolverPost = resolve
        })
        return HttpResponse.json({ ok: true, result: { comprado: true } })
      })
    )
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'actual'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))

    result.current.marcarComprado(1, 'g', true)

    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))
    expect(resolverPost).toBeDefined()

    resolverPost?.()
    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))
  })

  it('revierte comprado si el POST de compra.marcar falla', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    server.use(http.post(API_URL, () => HttpResponse.json({ ok: false, error: 'fallo' }, { status: 500 })))
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'actual'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.comprado(1, 'g')).toBe(false)

    result.current.marcarComprado(1, 'g', true)

    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))
    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(false), { timeout: 8000 })
  }, 10000)

  it('actual y siguiente tienen checklists de comprado independientes', async () => {
    const marcasPorSemana: Record<string, unknown[]> = {}
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { payload: { semana: string; id_ingrediente: number; unidad: string } }
        payloadRecibido = body
        marcasPorSemana[body.payload.semana] = [
          { id: 1, semana: body.payload.semana, id_ingrediente: body.payload.id_ingrediente, unidad: body.payload.unidad }
        ]
        return HttpResponse.json({ ok: true, result: { comprado: true } })
      })
    )
    mockApi([], marcasPorSemana)
    const { result, rerender } = renderHook(
      ({ rango }: { rango: 'actual' | 'siguiente' }) => useShoppingList(new Date(2026, 8, 7), rango),
      {
        wrapper,
        initialProps: { rango: 'actual' }
      }
    )
    await waitFor(() => expect(result.current.cargando).toBe(false))
    result.current.marcarComprado(1, 'g', true)
    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))
    expect(payloadRecibido).toMatchObject({ payload: { semana: '2026-09-07' } })

    rerender({ rango: 'siguiente' })

    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(false))
  })
})
