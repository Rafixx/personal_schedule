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
      <PlatoForm
        platosExistentes={[]}
        reglas={[]}
        ingredientesDisponibles={[]}
        ingredientesPlato={[]}
        onGuardado={onGuardado}
        onCancelar={vi.fn()}
      />,
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

  it('deshabilita los campos y el editor de ingredientes mientras se está guardando', async () => {
    let resolverPost: (() => void) | undefined
    server.use(
      http.post(API_URL, async () => {
        await new Promise<void>((resolve) => {
          resolverPost = resolve
        })
        return HttpResponse.json({ ok: true, result: { id_plato: 11 } })
      })
    )
    render(
      <PlatoForm
        platosExistentes={[]}
        reglas={[]}
        ingredientesDisponibles={[]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lentejas')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(screen.getByLabelText('Nombre')).toBeDisabled())
    expect(screen.getByLabelText('Todas')).toBeDisabled()
    expect(screen.getByLabelText('Etiquetas (separadas por comas)')).toBeDisabled()
    expect(screen.getByLabelText('Notas')).toBeDisabled()
    expect(screen.getByRole('button', { name: /añadir ingrediente/i })).toBeDisabled()

    resolverPost?.()
    await waitFor(() => expect(screen.getByLabelText('Nombre')).not.toBeDisabled())
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
      <PlatoForm
        platosExistentes={[]}
        reglas={[]}
        ingredientesDisponibles={[]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lentejas')
    await userEvent.type(
      screen.getByLabelText('Etiquetas (separadas por comas)'),
      ' Legumbre,  Guiso '
    )
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() =>
      expect(payloadRecibido).toEqual({
        action: 'plato.upsert',
        token: 'test-token',
        payload: {
          nombre: 'Lentejas',
          temporada: 'TODAS',
          etiquetas: 'legumbre,guiso',
          notas: '',
          activo: true
        }
      })
    )
  })

  it('muestra un error de validación si el nombre está vacío', async () => {
    render(
      <PlatoForm
        platosExistentes={[]}
        reglas={[]}
        ingredientesDisponibles={[]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
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
        platosExistentes={[]}
        reglas={[]}
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

  it('sugiere como pills las etiquetas de otros platos y de las reglas existentes, sin duplicados', () => {
    render(
      <PlatoForm
        platosExistentes={[
          {
            id: 1,
            nombre: 'Gazpacho',
            temporadas: ['VERANO'],
            etiquetas: ['verdura'],
            notas: '',
            activo: true
          },
          {
            id: 2,
            nombre: 'Ensalada',
            temporadas: ['TODAS'],
            etiquetas: ['verdura', 'ligero'],
            notas: '',
            activo: true
          }
        ]}
        reglas={[{ id: 1, etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true }]}
        ingredientesDisponibles={[]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getAllByRole('button', { name: 'verdura' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'ligero' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'pasta' })).toBeInTheDocument()
  })

  it('pulsar una pill añade la etiqueta al campo de texto, y pulsarla de nuevo la quita', async () => {
    render(
      <PlatoForm
        platosExistentes={[
          {
            id: 1,
            nombre: 'Gazpacho',
            temporadas: ['VERANO'],
            etiquetas: ['verdura'],
            notas: '',
            activo: true
          }
        ]}
        reglas={[]}
        ingredientesDisponibles={[]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    const pill = screen.getByRole('button', { name: 'verdura' })
    expect(pill).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(pill)
    expect(screen.getByLabelText('Etiquetas (separadas por comas)')).toHaveValue('verdura')
    expect(pill).toHaveAttribute('aria-pressed', 'true')

    await userEvent.click(pill)
    expect(screen.getByLabelText('Etiquetas (separadas por comas)')).toHaveValue('')
    expect(pill).toHaveAttribute('aria-pressed', 'false')
  })

  it('una pill ya presente en el texto escrito a mano aparece activa', () => {
    render(
      <PlatoForm
        platosExistentes={[
          {
            id: 1,
            nombre: 'Gazpacho',
            temporadas: ['VERANO'],
            etiquetas: ['verdura'],
            notas: '',
            activo: true
          }
        ]}
        reglas={[]}
        ingredientesDisponibles={[]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    fireEvent.change(screen.getByLabelText('Etiquetas (separadas por comas)'), {
      target: { value: 'verdura' }
    })
    expect(screen.getByRole('button', { name: 'verdura' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('normaliza las pills sugeridas (mayúsculas/acentos de datos antiguos) para que coincidan con el texto ya normalizado', () => {
    render(
      <PlatoForm
        plato={{
          id: 1,
          nombre: 'Pollo',
          temporadas: ['TODAS'],
          etiquetas: ['Proteína'],
          notas: '',
          activo: true
        }}
        platosExistentes={[
          {
            id: 1,
            nombre: 'Pollo',
            temporadas: ['TODAS'],
            etiquetas: ['Proteína'],
            notas: '',
            activo: true
          }
        ]}
        reglas={[]}
        ingredientesDisponibles={[]}
        ingredientesPlato={[]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    // El plato precarga "Proteína" tal cual en el texto (etiquetasATexto no normaliza),
    // pero la pill sugerida ya está normalizada — sin la normalización de
    // etiquetasSugeridas esta pill mostraría "Proteína" y nunca aparecería
    // activa, aunque su forma normalizada ya esté en el campo.
    expect(screen.queryByRole('button', { name: 'Proteína' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'proteina' })).toHaveAttribute('aria-pressed', 'true')
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
        platosExistentes={[]}
        reglas={[]}
        ingredientesDisponibles={[
          { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }
        ]}
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
        plato={{
          id: 3,
          nombre: 'Gazpacho',
          temporadas: ['VERANO'],
          etiquetas: [],
          notas: '',
          activo: true
        }}
        platosExistentes={[]}
        reglas={[]}
        ingredientesDisponibles={[
          { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }
        ]}
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
        platosExistentes={[]}
        reglas={[]}
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
    await waitFor(() =>
      expect(screen.getByText('No se pudo guardar. Inténtalo de nuevo.')).toBeInTheDocument()
    )

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
        plato={{
          id: 3,
          nombre: 'Gazpacho',
          temporadas: ['VERANO'],
          etiquetas: [],
          notas: '',
          activo: true
        }}
        platosExistentes={[]}
        reglas={[]}
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
        platosExistentes={[]}
        reglas={[]}
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
