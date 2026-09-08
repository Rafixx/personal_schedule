import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import type { Ingrediente } from '../../domain/types'
import { IngredienteList } from './IngredienteList'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const ingredientes: Ingrediente[] = [
  { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['VERANO'] }
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('IngredienteList', () => {
  it('muestra cada ingrediente con su proveedor y unidad', () => {
    render(<IngredienteList ingredientes={ingredientes} />, { wrapper })
    expect(screen.getByText('Tomate')).toBeInTheDocument()
    expect(screen.getByText(/Frutería.*g/)).toBeInTheDocument()
  })

  it('abre el formulario precargado al pulsar "Editar"', async () => {
    render(<IngredienteList ingredientes={ingredientes} />, { wrapper })
    const fila = screen.getByText('Tomate').closest('li')
    if (!fila) throw new Error('no se encontró la fila de Tomate')
    await userEvent.click(within(fila).getByRole('button', { name: /editar/i }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Tomate')
  })

  it('pide confirmación y llama a ingrediente.delete al pulsar "Eliminar"', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    render(<IngredienteList ingredientes={ingredientes} />, { wrapper })
    const fila = screen.getByText('Tomate').closest('li')
    if (!fila) throw new Error('no se encontró la fila de Tomate')
    await userEvent.click(within(fila).getByRole('button', { name: /eliminar/i }))
    expect(window.confirm).toHaveBeenCalledOnce()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(payloadRecibido).toEqual({
      action: 'ingrediente.delete',
      token: 'test-token',
      payload: { id_ingrediente: 1 }
    })
  })
})
