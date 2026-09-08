import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { ReglaForm } from './ReglaForm'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('ReglaForm', () => {
  it('crea una regla nueva con los valores por defecto y llama a onGuardado', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id: 5 } })
      })
    )
    const onGuardado = vi.fn()
    render(<ReglaForm onGuardado={onGuardado} onCancelar={vi.fn()} />, { wrapper })

    await userEvent.type(screen.getByLabelText('Etiqueta'), 'pasta')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(payloadRecibido).toEqual({
      action: 'regla.upsert',
      token: 'test-token',
      payload: { etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true }
    })
  })

  it('muestra un error de validación si la etiqueta está vacía', async () => {
    render(<ReglaForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('La etiqueta es obligatoria')).toBeInTheDocument()
  })

  it('precarga los valores de una regla existente y envía su id al guardar', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id: 3 } })
      })
    )
    const onGuardado = vi.fn()
    render(
      <ReglaForm
        regla={{ id: 3, etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: true }}
        onGuardado={onGuardado}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByLabelText('Etiqueta')).toHaveValue('pescado')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(payloadRecibido).toEqual({
      action: 'regla.upsert',
      token: 'test-token',
      payload: { id: 3, etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: true }
    })
  })

  it('llama a onCancelar al pulsar Cancelar', async () => {
    const onCancelar = vi.fn()
    render(<ReglaForm onGuardado={vi.fn()} onCancelar={onCancelar} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onCancelar).toHaveBeenCalledOnce()
  })

  it('normaliza la etiqueta a minúsculas y sin acentos al guardar', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id: 6 } })
      })
    )
    render(<ReglaForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.type(screen.getByLabelText('Etiqueta'), 'Pastél')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() =>
      expect(payloadRecibido).toEqual({
        action: 'regla.upsert',
        token: 'test-token',
        payload: { etiqueta: 'pastel', tipo: 'MAX_SEMANA', valor: 1, activa: true }
      })
    )
  })
})
