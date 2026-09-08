import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import type { Regla } from '../../domain/types'
import { ReglaList } from './ReglaList'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const reglas: Regla[] = [
  { id: 1, etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true },
  { id: 2, etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: false }
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ReglaList', () => {
  it('muestra cada regla con su tipo, valor y estado', () => {
    render(<ReglaList reglas={reglas} />, { wrapper })
    expect(screen.getByText('pasta')).toBeInTheDocument()
    expect(screen.getByText(/Máximo por semana.*1.*Activa/)).toBeInTheDocument()
    expect(screen.getByText('pescado')).toBeInTheDocument()
    expect(screen.getByText(/Mínimo por semana.*2.*Inactiva/)).toBeInTheDocument()
  })

  it('abre el formulario de nueva regla al pulsar "+ Nueva regla"', async () => {
    render(<ReglaList reglas={reglas} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /nueva regla/i }))
    expect(screen.getByLabelText('Etiqueta')).toHaveValue('')
  })

  it('abre el formulario precargado al pulsar "Editar" en una fila', async () => {
    render(<ReglaList reglas={reglas} />, { wrapper })
    const filaPasta = screen.getByText('pasta').closest('li')
    if (!filaPasta) throw new Error('no se encontró la fila de pasta')
    await userEvent.click(within(filaPasta).getByRole('button', { name: /editar/i }))
    expect(screen.getByLabelText('Etiqueta')).toHaveValue('pasta')
  })

  it('pide confirmación y llama a regla.delete al pulsar "Eliminar"', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    render(<ReglaList reglas={reglas} />, { wrapper })
    const filaPasta = screen.getByText('pasta').closest('li')
    if (!filaPasta) throw new Error('no se encontró la fila de pasta')
    await userEvent.click(within(filaPasta).getByRole('button', { name: /eliminar/i }))
    expect(window.confirm).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(payloadRecibido).toEqual({ action: 'regla.delete', token: 'test-token', payload: { id: 1 } })
    )
  })

  it('no llama a regla.delete si se cancela la confirmación', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    let seLlamoAlApi = false
    server.use(
      http.post(API_URL, () => {
        seLlamoAlApi = true
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    render(<ReglaList reglas={reglas} />, { wrapper })
    const filaPasta = screen.getByText('pasta').closest('li')
    if (!filaPasta) throw new Error('no se encontró la fila de pasta')
    await userEvent.click(within(filaPasta).getByRole('button', { name: /eliminar/i }))
    expect(seLlamoAlApi).toBe(false)
  })
})
