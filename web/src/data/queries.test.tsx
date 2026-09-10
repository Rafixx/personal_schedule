import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../test/mswServer'
import {
  useCatalogo,
  useIngredienteDelete,
  useIngredienteUpsert,
  useMovePlanEntry,
  usePlatoDelete,
  usePlatoIngredientesReplace,
  usePlatoUpsert,
  useReglaDelete,
  useReglaUpsert,
  useSetPlanEntry
} from './queries'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useCatalogo', () => {
  it('mapea las filas válidas y cuenta las inválidas por separado', async () => {
    server.use(
      http.get(API_URL, () =>
        HttpResponse.json({
          ok: true,
          platos: [
            { id_plato: 1, nombre: 'Gazpacho', temporada: 'VERANO', etiquetas: '', notas: '', activo: true },
            { id_plato: 2, nombre: '', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }
          ],
          ingredientes: [],
          ingredientesPlatos: [],
          reglas: [],
          proveedores: []
        })
      )
    )
    const { result } = renderHook(() => useCatalogo(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.catalogo.platos).toHaveLength(1)
    expect(result.current.data?.catalogo.platos[0].nombre).toBe('Gazpacho')
    expect(result.current.data?.filasInvalidas).toBe(1)
    expect(result.current.data?.erroresPorColeccion.platos).toHaveLength(1)
  })

  it('ordena los platos y los ingredientes alfabéticamente, sin importar el orden de la hoja', async () => {
    server.use(
      http.get(API_URL, () =>
        HttpResponse.json({
          ok: true,
          platos: [
            { id_plato: 1, nombre: 'Zanahorias asadas', temporada: 'TODAS', etiquetas: '', notas: '', activo: true },
            { id_plato: 2, nombre: 'Ñoquis', temporada: 'TODAS', etiquetas: '', notas: '', activo: true },
            { id_plato: 3, nombre: 'Ensalada', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }
          ],
          ingredientes: [
            { id_ingrediente: 1, nombre: 'Tomate', proveedor: 'Frutería', unidad_base: 'g', temporada: 'TODAS' },
            { id_ingrediente: 2, nombre: 'Arroz', proveedor: 'Ultramarinos', unidad_base: 'g', temporada: 'TODAS' }
          ],
          ingredientesPlatos: [],
          reglas: [],
          proveedores: []
        })
      )
    )
    const { result } = renderHook(() => useCatalogo(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.catalogo.platos.map((p) => p.nombre)).toEqual([
      'Ensalada',
      'Ñoquis',
      'Zanahorias asadas'
    ])
    expect(result.current.data?.catalogo.ingredientes.map((i) => i.nombre)).toEqual(['Arroz', 'Tomate'])
  })
})

describe('useSetPlanEntry', () => {
  it('llama a plan.set con el payload correcto', async () => {
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { action: string; payload: unknown }
        expect(body.action).toBe('plan.set')
        expect(body.payload).toEqual({ fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' })
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const { result } = renderHook(() => useSetPlanEntry(), { wrapper })
    result.current.mutate({ fecha: '2026-09-07', turno: 'COMIDA', orden: 1, idPlato: 1 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useMovePlanEntry', () => {
  it('llama a plan.move con los dos extremos', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { ok: true } })
      })
    )
    const { result } = renderHook(() => useMovePlanEntry(), { wrapper })
    result.current.mutate({
      from: { fecha: '2026-09-07', turno: 'COMIDA', orden: 1 },
      to: { fecha: '2026-09-08', turno: 'COMIDA', orden: 2 }
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'plan.move',
      token: 'test-token',
      payload: {
        from: { fecha: '2026-09-07', turno: 'COMIDA', orden: 1 },
        to: { fecha: '2026-09-08', turno: 'COMIDA', orden: 2 }
      }
    })
  })
})

describe('usePlatoUpsert', () => {
  it('crea un plato nuevo con temporadas y etiquetas unidas por comas', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 9 } })
      })
    )
    const { result } = renderHook(() => usePlatoUpsert(), { wrapper })
    result.current.mutate({
      nombre: 'Lentejas',
      temporadas: ['OTOÑO', 'INVIERNO'],
      etiquetas: ['legumbre'],
      notas: '',
      activo: true
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'plato.upsert',
      token: 'test-token',
      payload: { nombre: 'Lentejas', temporada: 'OTOÑO,INVIERNO', etiquetas: 'legumbre', notas: '', activo: true }
    })
    expect(result.current.data).toEqual({ id_plato: 9 })
  })

  it('incluye el id al editar un plato existente', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 3 } })
      })
    )
    const { result } = renderHook(() => usePlatoUpsert(), { wrapper })
    result.current.mutate({
      id: 3,
      nombre: 'Gazpacho',
      temporadas: ['VERANO'],
      etiquetas: [],
      notas: '',
      activo: true
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'plato.upsert',
      token: 'test-token',
      payload: { id_plato: 3, nombre: 'Gazpacho', temporada: 'VERANO', etiquetas: '', notas: '', activo: true }
    })
  })
})

describe('usePlatoDelete', () => {
  it('llama a plato.delete con el id', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const { result } = renderHook(() => usePlatoDelete(), { wrapper })
    result.current.mutate({ id: 3 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({ action: 'plato.delete', token: 'test-token', payload: { id_plato: 3 } })
  })
})

describe('useIngredienteUpsert', () => {
  it('crea un ingrediente nuevo con macros opcionales', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_ingrediente: 12 } })
      })
    )
    const { result } = renderHook(() => useIngredienteUpsert(), { wrapper })
    result.current.mutate({
      nombre: 'Lenteja',
      proveedor: 'Mercadona',
      unidadBase: 'g',
      temporadas: ['TODAS'],
      kcal100: 350
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'ingrediente.upsert',
      token: 'test-token',
      payload: {
        nombre: 'Lenteja',
        proveedor: 'Mercadona',
        unidad_base: 'g',
        temporada: 'TODAS',
        kcal_100: 350
      }
    })
  })
})

describe('useIngredienteDelete', () => {
  it('llama a ingrediente.delete con el id', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const { result } = renderHook(() => useIngredienteDelete(), { wrapper })
    result.current.mutate({ id: 12 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'ingrediente.delete',
      token: 'test-token',
      payload: { id_ingrediente: 12 }
    })
  })
})

describe('usePlatoIngredientesReplace', () => {
  it('envía id_plato y la lista de líneas con las claves de la API', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 3, count: 2 } })
      })
    )
    const { result } = renderHook(() => usePlatoIngredientesReplace(), { wrapper })
    result.current.mutate({
      idPlato: 3,
      ingredientes: [
        { idIngrediente: 1, cantidad: 500, unidad: 'g' },
        { idIngrediente: 2, cantidad: 1, unidad: 'ud' }
      ]
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'platoIngredientes.replace',
      token: 'test-token',
      payload: {
        id_plato: 3,
        ingredientes: [
          { id_ingrediente: 1, cantidad: 500, unidad: 'g' },
          { id_ingrediente: 2, cantidad: 1, unidad: 'ud' }
        ]
      }
    })
  })
})

describe('useReglaUpsert', () => {
  it('crea una regla nueva', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id: 4 } })
      })
    )
    const { result } = renderHook(() => useReglaUpsert(), { wrapper })
    result.current.mutate({ etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'regla.upsert',
      token: 'test-token',
      payload: { etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: true }
    })
  })
})

describe('useReglaDelete', () => {
  it('llama a regla.delete con el id', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const { result } = renderHook(() => useReglaDelete(), { wrapper })
    result.current.mutate({ id: 4 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({ action: 'regla.delete', token: 'test-token', payload: { id: 4 } })
  })
})
