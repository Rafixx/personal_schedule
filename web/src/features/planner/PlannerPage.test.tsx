import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { PlannerPage } from './PlannerPage'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </BrowserRouter>
  )
}

function mockPlanner() {
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
}

describe('PlannerPage', () => {
  it('monta WeekBoard y Recetario juntos dentro del planificador', async () => {
    mockPlanner()
    render(
      <PlannerPage lunes={new Date(2026, 8, 7)} setLunes={vi.fn()} vista="semana" setVista={vi.fn()} />,
      { wrapper }
    )
    await screen.findByRole('region', { name: 'Días de la semana' })
    expect(screen.getByRole('heading', { name: 'Recetario' })).toBeInTheDocument()
  })
})
