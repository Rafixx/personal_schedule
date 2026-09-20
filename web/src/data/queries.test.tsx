import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { server } from '../test/mswServer'
import { borrarSesion, guardarSesion, leerSesion } from './session'
import { ApiError } from './sheetsClient'
import {
  useCatalogo,
  useIngredienteDelete,
  useIngredienteUpsert,
  useLogin,
  useLogout,
  useMarcarCompra,
  useMarcasCompra,
  useMovePlanEntry,
  usePlatoDelete,
  usePlatoIngredientesReplace,
  usePlatoUpsert,
  useReglaDelete,
  useReglaUpsert,
  useSetPlanEntry,
  useUsuarios
} from './queries'

const API_URL = 'https://script.example.com/exec'

// El cliente ya no lleva un token fijo de build: lo toma de la sesión en
// localStorage. La sembramos aquí para que las mutaciones de abajo, que
// pasan por el singleton `sheetsClient` (vía `queries.ts`), sigan mandando
// un token en el body — y las aserciones existentes sobre él sigan siendo
// significativas.
beforeEach(() => {
  guardarSesion({ token: 'test-token', idUsuario: 1, nombre: 'Test' })
})

afterEach(() => {
  borrarSesion()
})

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

describe('useMarcasCompra', () => {
  it('pide la semana correcta y mapea las marcas a MarcaCompra', async () => {
    server.use(
      http.get(API_URL, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('action')).toBe('compra')
        expect(url.searchParams.get('semana')).toBe('2026-09-07')
        return HttpResponse.json({
          ok: true,
          marcas: [{ id: 1, semana: '2026-09-07', id_ingrediente: 3, unidad: 'g' }]
        })
      })
    )
    const { result } = renderHook(() => useMarcasCompra('2026-09-07'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([{ id: 1, semana: '2026-09-07', idIngrediente: 3, unidad: 'g' }])
  })
})

describe('useMarcarCompra', () => {
  it('llama a compra.marcar con semana, id_ingrediente, unidad y comprado', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { comprado: true } })
      })
    )
    const { result } = renderHook(() => useMarcarCompra(), { wrapper })
    result.current.mutate({ semana: '2026-09-07', idIngrediente: 3, unidad: 'g', comprado: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'compra.marcar',
      token: 'test-token',
      payload: { semana: '2026-09-07', id_ingrediente: 3, unidad: 'g', comprado: true }
    })
  })

  it('actualiza la caché de ["compra", semana] al instante, antes de que resuelva el POST', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(['compra', '2026-09-07'], [])
    function wrapperConCliente({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    let resolverPost: (() => void) | undefined
    server.use(
      http.post(API_URL, async () => {
        await new Promise<void>((resolve) => {
          resolverPost = resolve
        })
        return HttpResponse.json({ ok: true, result: { comprado: true } })
      })
    )
    const { result } = renderHook(() => useMarcarCompra(), { wrapper: wrapperConCliente })

    result.current.mutate({ semana: '2026-09-07', idIngrediente: 3, unidad: 'g', comprado: true })

    await waitFor(() =>
      expect(queryClient.getQueryData(['compra', '2026-09-07'])).toEqual([
        { id: expect.any(Number), semana: '2026-09-07', idIngrediente: 3, unidad: 'g' }
      ])
    )
    expect(resolverPost).toBeDefined()
    resolverPost?.()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('revierte la caché si el POST falla', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const marcaExistente = { id: 1, semana: '2026-09-07', idIngrediente: 3, unidad: 'g' }
    queryClient.setQueryData(['compra', '2026-09-07'], [marcaExistente])
    function wrapperConCliente({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    server.use(http.post(API_URL, () => HttpResponse.json({ ok: false, error: 'fallo' }, { status: 500 })))
    const { result } = renderHook(() => useMarcarCompra(), { wrapper: wrapperConCliente })

    result.current.mutate({ semana: '2026-09-07', idIngrediente: 3, unidad: 'g', comprado: false })

    await waitFor(() => expect(queryClient.getQueryData(['compra', '2026-09-07'])).toEqual([]))
    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 8000 })
    expect(queryClient.getQueryData(['compra', '2026-09-07'])).toEqual([marcaExistente])
  }, 10000)
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

describe('useUsuarios', () => {
  it('mapea auth.usuarios a {id, nombre}, sin nombres hardcodeados', async () => {
    server.use(
      http.get(API_URL, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('action')).toBe('auth.usuarios')
        return HttpResponse.json({
          ok: true,
          usuarios: [
            { id_usuario: 1, nombre: 'Rafa' },
            { id_usuario: 2, nombre: 'Lourdes' }
          ]
        })
      })
    )
    const { result } = renderHook(() => useUsuarios(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      { id: 1, nombre: 'Rafa' },
      { id: 2, nombre: 'Lourdes' }
    ])
  })
})

describe('useLogin', () => {
  it('manda { id_usuario, pin, dispositivo } y guarda la sesión al acertar', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({
          ok: true,
          token: 'nuevo-token',
          usuario: { id_usuario: 3, nombre: 'Paula' },
          id_sesion: 42
        })
      })
    )
    const { result } = renderHook(() => useLogin(), { wrapper })
    result.current.mutate({ idUsuario: 3, pin: '123456', dispositivo: 'vitest' })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'auth.login',
      token: 'test-token',
      payload: { id_usuario: 3, pin: '123456', dispositivo: 'vitest' }
    })
    expect(leerSesion()).toEqual({ token: 'nuevo-token', idUsuario: 3, nombre: 'Paula' })
  })

  it('propaga el error con su code (LOCKED_OUT) para que la pantalla lo distinga', async () => {
    server.use(
      http.post(API_URL, () =>
        HttpResponse.json({
          ok: false,
          code: 'LOCKED_OUT',
          error: 'demasiados intentos fallidos',
          reintentar_en_s: 90
        })
      )
    )
    const { result } = renderHook(() => useLogin(), { wrapper })
    result.current.mutate({ idUsuario: 3, pin: '000000', dispositivo: 'vitest' })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error).toMatchObject({ code: 'LOCKED_OUT', reintentarEnS: 90 })
    // Un login fallido no debe tocar la sesión ya existente.
    expect(leerSesion()).toEqual({ token: 'test-token', idUsuario: 1, nombre: 'Test' })
  })
})

describe('useLogout', () => {
  it('llama a auth.logout y luego borra la sesión y vacía la caché de queries', async () => {
    let accionRecibida: string | null = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { action: string }
        accionRecibida = body.action
        return HttpResponse.json({ ok: true, result: { revocadas: 1 } })
      })
    )
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    queryClient.setQueryData(['catalogo'], { algo: 'lo-que-sea' })
    function wrapperConCliente({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }
    const { result } = renderHook(() => useLogout(), { wrapper: wrapperConCliente })
    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(accionRecibida).toBe('auth.logout')
    expect(leerSesion()).toBeNull()
    expect(queryClient.getQueryData(['catalogo'])).toBeUndefined()
  })

  it('borra la sesión igualmente aunque la llamada a auth.logout falle', async () => {
    server.use(http.post(API_URL, () => HttpResponse.json({ ok: false, code: 'INTERNAL', error: 'boom' })))
    const { result } = renderHook(() => useLogout(), { wrapper })
    result.current.mutate()
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(leerSesion()).toBeNull()
  })
})
