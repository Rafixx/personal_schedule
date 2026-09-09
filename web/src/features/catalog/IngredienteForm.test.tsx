import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { IngredienteForm } from './IngredienteForm'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('IngredienteForm', () => {
  it('crea un ingrediente nuevo con la temporada TODAS marcada por defecto', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_ingrediente: 8 } })
      })
    )
    const onGuardado = vi.fn()
    render(<IngredienteForm onGuardado={onGuardado} onCancelar={vi.fn()} />, { wrapper })

    await userEvent.type(screen.getByLabelText('Nombre'), 'Lenteja')
    await userEvent.type(screen.getByLabelText('Proveedor'), 'Mercadona')
    await userEvent.type(screen.getByLabelText('Unidad base'), 'g')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(payloadRecibido).toEqual({
      action: 'ingrediente.upsert',
      token: 'test-token',
      payload: { nombre: 'Lenteja', proveedor: 'Mercadona', unidad_base: 'g', temporada: 'TODAS' }
    })
  })

  it('deshabilita los campos mientras se está guardando', async () => {
    let resolverPost: (() => void) | undefined
    server.use(
      http.post(API_URL, async () => {
        await new Promise<void>((resolve) => {
          resolverPost = resolve
        })
        return HttpResponse.json({ ok: true, result: { id_ingrediente: 8 } })
      })
    )
    render(<IngredienteForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lenteja')
    await userEvent.type(screen.getByLabelText('Proveedor'), 'Mercadona')
    await userEvent.type(screen.getByLabelText('Unidad base'), 'g')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeDisabled())
    expect(screen.getByLabelText('Proveedor')).toBeDisabled()
    expect(screen.getByLabelText('Unidad base')).toBeDisabled()
    expect(screen.getByLabelText('Todas')).toBeDisabled()
    expect(screen.getByLabelText('Kcal / 100g')).toBeDisabled()

    resolverPost?.()
    await waitFor(() => expect(screen.getByLabelText('Nombre')).not.toBeDisabled())
  })

  it('muestra errores de validación si nombre, proveedor o unidad están vacíos', async () => {
    render(<IngredienteForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('El proveedor es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('La unidad es obligatoria')).toBeInTheDocument()
  })

  it('envía los macros solo cuando se rellenan', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_ingrediente: 8 } })
      })
    )
    render(<IngredienteForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lenteja')
    await userEvent.type(screen.getByLabelText('Proveedor'), 'Mercadona')
    await userEvent.type(screen.getByLabelText('Unidad base'), 'g')
    await userEvent.type(screen.getByLabelText('Kcal / 100g'), '350')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() =>
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
    )
  })

  it('precarga los valores de un ingrediente existente', async () => {
    render(
      <IngredienteForm
        ingrediente={{
          id: 5,
          nombre: 'Tomate',
          proveedor: 'Frutería',
          unidadBase: 'g',
          temporadas: ['VERANO'],
          kcal100: 18
        }}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByLabelText('Nombre')).toHaveValue('Tomate')
    expect(screen.getByLabelText('Kcal / 100g')).toHaveValue(18)
  })
})
