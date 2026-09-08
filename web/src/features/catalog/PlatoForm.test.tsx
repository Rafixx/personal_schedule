import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

  it('si falla el guardado de ingredientes, reintentar reutiliza el id creado en vez de duplicar el plato', async () => {
    const cuerposUpsert: Array<{ action: string; payload: unknown }> = []
    let fallarReplace = true
    server.use(
      http.post(API_URL, async ({ request }) => {
        const cuerpo = (await request.json()) as { action: string; payload: unknown }
        if (cuerpo.action === 'plato.upsert') {
          cuerposUpsert.push(cuerpo)
          return HttpResponse.json({ ok: true, result: { id_plato: 21 } })
        }
        if (fallarReplace) {
          fallarReplace = false
          return HttpResponse.json({ ok: false, error: 'fallo temporal' }, { status: 500 })
        }
        return HttpResponse.json({ ok: true, result: { id_plato: 21, count: 1 } })
      })
    )
    render(
      <PlatoForm
        ingredientesDisponibles={[
          { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }
        ]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lentejas')
    await userEvent.click(screen.getByRole('button', { name: /añadir ingrediente/i }))
    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))
    await waitFor(() => expect(screen.getByText('No se pudo guardar. Inténtalo de nuevo.')).toBeInTheDocument())

    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))
    await waitFor(() => expect(cuerposUpsert).toHaveLength(2))
    expect(cuerposUpsert[0].payload).not.toHaveProperty('id_plato')
    expect(cuerposUpsert[1].payload).toMatchObject({ id_plato: 21 })
  })

  it('no llama a platoIngredientes.replace si las líneas no cambiaron al editar', async () => {
    let seLlamoAReplace = false
    server.use(
      http.post(API_URL, async ({ request }) => {
        const cuerpo = (await request.json()) as { action: string }
        if (cuerpo.action === 'platoIngredientes.replace') seLlamoAReplace = true
        return HttpResponse.json({ ok: true, result: { id_plato: 3 } })
      })
    )
    const onGuardado = vi.fn()
    render(
      <PlatoForm
        plato={{ id: 3, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: [], notas: '', activo: true }}
        ingredientesDisponibles={[
          { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }
        ]}
        ingredientesPlato={[{ id: 1, idPlato: 3, idIngrediente: 1, cantidad: 500, unidad: 'g' }]}
        onGuardado={onGuardado}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    await userEvent.clear(screen.getByLabelText('Nombre'))
    await userEvent.type(screen.getByLabelText('Nombre'), 'Gazpacho andaluz')
    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(seLlamoAReplace).toBe(false)
  })

  it('no guarda si una línea de ingrediente tiene cantidad 0', async () => {
    server.use(http.post(API_URL, () => HttpResponse.json({ ok: true, result: { id_plato: 30 } })))
    render(
      <PlatoForm
        ingredientesDisponibles={[
          { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }
        ]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lentejas')
    await userEvent.click(screen.getByRole('button', { name: /añadir ingrediente/i }))
    const campoCantidad = screen.getByDisplayValue('1')
    fireEvent.change(campoCantidad, { target: { value: '0' } })
    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))
    expect(
      await screen.findByText(
        'Revisa los ingredientes: la cantidad debe ser mayor que 0 y la unidad no puede estar vacía.'
      )
    ).toBeInTheDocument()
  })
})
