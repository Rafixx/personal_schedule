import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { useShoppingList } from './useShoppingList'

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
      return HttpResponse.json({ ok: true, entries })
    })
  )
}

beforeEach(() => localStorage.clear())

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

  it('marcarComprado persiste el estado y comprado lo refleja', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'actual'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.comprado(1, 'g')).toBe(false)

    result.current.marcarComprado(1, 'g', true)

    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))
    expect(localStorage.getItem('compra:2026-09-07:2026-09-11')).toContain('"1|g":true')
  })

  it('actual y siguiente tienen checklists de comprado independientes', async () => {
    mockApi([])
    const { result, rerender } = renderHook(({ rango }: { rango: 'actual' | 'siguiente' }) => useShoppingList(new Date(2026, 8, 7), rango), {
      wrapper,
      initialProps: { rango: 'actual' }
    })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    result.current.marcarComprado(1, 'g', true)
    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))

    rerender({ rango: 'siguiente' })

    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(false))
  })
})
