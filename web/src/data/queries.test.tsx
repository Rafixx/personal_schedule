import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../test/mswServer'
import { useCatalogo, useSetPlanEntry } from './queries'

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
})

describe('useSetPlanEntry', () => {
  it('llama a plan.set con el payload correcto', async () => {
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { action: string; payload: unknown }
        expect(body.action).toBe('plan.set')
        expect(body.payload).toEqual({ fecha: '2026-09-07', turno: 'COMIDA', id_plato: 1, notas: '' })
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const { result } = renderHook(() => useSetPlanEntry(), { wrapper })
    result.current.mutate({ fecha: '2026-09-07', turno: 'COMIDA', idPlato: 1 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
