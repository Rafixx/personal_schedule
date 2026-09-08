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
        const cuerpo = (await request.json()) as { action: string }
        // El envío ahora encadena un platoIngredientes.replace tras el plato.upsert (Task 5):
        // solo capturamos el cuerpo del upsert, que es lo que este test verifica.
        if (cuerpo.action === 'plato.upsert') payloadRecibido = cuerpo
        return HttpResponse.json({ ok: true, result: { id_plato: 11 } })
      })
    )
    const onGuardado = vi.fn()
    render(
      <PlatoForm ingredientesDisponibles={[]} ingredientesPlato={[]} onGuardado={onGuardado} onCancelar={vi.fn()} />,
      { wrapper }
    )

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
        const cuerpo = (await request.json()) as { action: string }
        // El envío ahora encadena un platoIngredientes.replace tras el plato.upsert (Task 5):
        // solo capturamos el cuerpo del upsert, que es lo que este test verifica.
        if (cuerpo.action === 'plato.upsert') payloadRecibido = cuerpo
        return HttpResponse.json({ ok: true, result: { id_plato: 11 } })
      })
    )
    render(
      <PlatoForm ingredientesDisponibles={[]} ingredientesPlato={[]} onGuardado={vi.fn()} onCancelar={vi.fn()} />,
      { wrapper }
    )
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
    render(
      <PlatoForm ingredientesDisponibles={[]} ingredientesPlato={[]} onGuardado={vi.fn()} onCancelar={vi.fn()} />,
      { wrapper }
    )
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
        ingredientesDisponibles={[]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByLabelText('Nombre')).toHaveValue('Gazpacho')
    expect(screen.getByLabelText('Etiquetas (separadas por comas)')).toHaveValue('verdura')
  })

  it('incluye las líneas del editor de ingredientes al guardar, tras el upsert del plato', async () => {
    let segundoCuerpo: unknown = null
    let llamadas = 0
    server.use(
      http.post(API_URL, async ({ request }) => {
        llamadas += 1
        const cuerpo = (await request.json()) as { action: string }
        if (llamadas === 1) {
          expect(cuerpo.action).toBe('plato.upsert')
          return HttpResponse.json({ ok: true, result: { id_plato: 11 } })
        }
        segundoCuerpo = cuerpo
        return HttpResponse.json({ ok: true, result: { id_plato: 11, count: 1 } })
      })
    )
    const onGuardado = vi.fn()
    render(
      <PlatoForm
        ingredientesDisponibles={[{ id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }]}
        ingredientesPlato={[]}
        onGuardado={onGuardado}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    await userEvent.type(screen.getByLabelText('Nombre'), 'Gazpacho')
    await userEvent.click(screen.getByRole('button', { name: /añadir ingrediente/i }))
    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(segundoCuerpo).toEqual({
      action: 'platoIngredientes.replace',
      token: 'test-token',
      payload: { id_plato: 11, ingredientes: [{ id_ingrediente: 1, cantidad: 1, unidad: 'g' }] }
    })
  })

  it('precarga las líneas de ingredientesPlato en el editor', () => {
    render(
      <PlatoForm
        plato={{ id: 3, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: [], notas: '', activo: true }}
        ingredientesDisponibles={[{ id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }]}
        ingredientesPlato={[{ id: 1, idPlato: 3, idIngrediente: 1, cantidad: 500, unidad: 'g' }]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByDisplayValue('500')).toBeInTheDocument()
  })
})
