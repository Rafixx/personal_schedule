import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { PlatoForm } from './PlatoForm'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('PlatoForm', () => {
  it('crea un plato nuevo con TODAS marcada por defecto y sin etiquetas', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 11 } })
      })
    )
    const onGuardado = vi.fn()
    render(<PlatoForm onGuardado={onGuardado} onCancelar={vi.fn()} />, { wrapper })

    await userEvent.type(screen.getByLabelText('Nombre'), 'Lentejas')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(payloadRecibido).toEqual({
      action: 'plato.upsert',
      token: 'test-token',
      payload: { nombre: 'Lentejas', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }
    })
  })

  it('convierte el texto de etiquetas separado por comas en minúsculas y sin espacios', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 11 } })
      })
    )
    render(<PlatoForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lentejas')
    await userEvent.type(screen.getByLabelText('Etiquetas (separadas por comas)'), ' Legumbre,  Guiso ')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() =>
      expect(payloadRecibido).toEqual({
        action: 'plato.upsert',
        token: 'test-token',
        payload: { nombre: 'Lentejas', temporada: 'TODAS', etiquetas: 'legumbre,guiso', notas: '', activo: true }
      })
    )
  })

  it('muestra un error de validación si el nombre está vacío', async () => {
    render(<PlatoForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument()
  })

  it('precarga los valores de un plato existente', async () => {
    render(
      <PlatoForm
        plato={{
          id: 3,
          nombre: 'Gazpacho',
          temporadas: ['VERANO'],
          etiquetas: ['verdura'],
          notas: 'Sin sal',
          activo: true
        }}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByLabelText('Nombre')).toHaveValue('Gazpacho')
    expect(screen.getByLabelText('Etiquetas (separadas por comas)')).toHaveValue('verdura')
  })
})
