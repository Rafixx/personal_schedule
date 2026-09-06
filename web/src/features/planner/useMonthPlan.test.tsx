import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { useMonthPlan } from './useMonthPlan'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useMonthPlan', () => {
  it('devuelve 42 celdas cubriendo el mes visible, marcando los días fuera de mes', async () => {
    server.use(
      http.get(API_URL, ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('action') === 'bootstrap') {
          return HttpResponse.json({
            ok: true,
            platos: [{ id_plato: 5, nombre: 'Pasta', temporada: 'TODAS', etiquetas: 'pasta', notas: '', activo: true }],
            ingredientes: [],
            ingredientesPlatos: [],
            reglas: [],
            proveedores: []
          })
        }
        return HttpResponse.json({
          ok: true,
          entries: [{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 5, notas: '' }]
        })
      })
    )
    const { result } = renderHook(() => useMonthPlan(new Date(2026, 8, 15)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.dias).toHaveLength(42)
    const dia7 = result.current.dias.find((d) => d.fecha === '2026-09-07')
    expect(dia7?.platos[0]?.nombre).toBe('Pasta')
    expect(dia7?.esOtroMes).toBe(false)
    const diaAgosto = result.current.dias.find((d) => d.fecha === '2026-08-31')
    expect(diaAgosto?.esOtroMes).toBe(true)
  })
})
