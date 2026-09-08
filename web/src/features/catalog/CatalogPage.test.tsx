import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { CatalogPage } from './CatalogPage'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/catalogo']}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function mockCatalogo() {
  server.use(
    http.get(API_URL, () =>
      HttpResponse.json({
        ok: true,
        platos: [{ id_plato: 1, nombre: 'Gazpacho', temporada: 'VERANO', etiquetas: '', notas: '', activo: true }],
        ingredientes: [
          { id_ingrediente: 1, nombre: 'Tomate', proveedor: 'Frutería', unidad_base: 'g', temporada: 'TODAS' }
        ],
        ingredientesPlatos: [],
        reglas: [{ id: 1, etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true }],
        proveedores: []
      })
    )
  )
}

describe('CatalogPage', () => {
  it('muestra la pestaña de Platos por defecto', async () => {
    mockCatalogo()
    render(<CatalogPage />, { wrapper })
    expect(await screen.findByText('Gazpacho')).toBeInTheDocument()
  })

  it('cambia a la pestaña de Ingredientes al pulsarla', async () => {
    mockCatalogo()
    render(<CatalogPage />, { wrapper })
    await screen.findByText('Gazpacho')
    await userEvent.click(screen.getByRole('tab', { name: 'Ingredientes' }))
    expect(await screen.findByText('Tomate')).toBeInTheDocument()
    expect(screen.queryByText('Gazpacho')).not.toBeInTheDocument()
  })

  it('cambia a la pestaña de Reglas al pulsarla', async () => {
    mockCatalogo()
    render(<CatalogPage />, { wrapper })
    await screen.findByText('Gazpacho')
    await userEvent.click(screen.getByRole('tab', { name: 'Reglas' }))
    expect(await screen.findByText('pasta')).toBeInTheDocument()
  })

  it('muestra un estado de carga mientras llega el catálogo', () => {
    mockCatalogo()
    render(<CatalogPage />, { wrapper })
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })
})
