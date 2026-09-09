import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import type { Plato } from '../../domain/types'
import { PlatoList } from './PlatoList'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const platos: Plato[] = [
  { id: 1, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: ['verdura'], notas: '', activo: true },
  { id: 2, nombre: 'Cocido', temporadas: ['INVIERNO'], etiquetas: [], notas: '', activo: false }
]

describe('PlatoList', () => {
  it('muestra cada plato con su estado activo/inactivo', () => {
    render(<PlatoList platos={platos} ingredientesDisponibles={[]} ingredientesPlato={[]} />, { wrapper })
    const filaGazpacho = screen.getByText('Gazpacho').closest('li')
    const filaCocido = screen.getByText('Cocido').closest('li')
    if (!filaGazpacho || !filaCocido) throw new Error('no se encontraron las filas')
    expect(within(filaGazpacho).getByText('Activo')).toBeInTheDocument()
    expect(within(filaCocido).getByText('Inactivo')).toBeInTheDocument()
  })

  it('muestra las etiquetas y la temporada de cada plato, con un aviso cuando no tiene etiquetas', () => {
    render(<PlatoList platos={platos} ingredientesDisponibles={[]} ingredientesPlato={[]} />, { wrapper })
    const filaGazpacho = screen.getByText('Gazpacho').closest('li')
    const filaCocido = screen.getByText('Cocido').closest('li')
    if (!filaGazpacho || !filaCocido) throw new Error('no se encontraron las filas')
    expect(within(filaGazpacho).getByText(/verdura/)).toBeInTheDocument()
    expect(within(filaGazpacho).getByText(/verano/)).toBeInTheDocument()
    expect(within(filaCocido).getByText(/sin etiquetas/)).toBeInTheDocument()
    expect(within(filaCocido).getByText(/invierno/)).toBeInTheDocument()
  })

  it('abre el formulario precargado al pulsar "Editar"', async () => {
    render(<PlatoList platos={platos} ingredientesDisponibles={[]} ingredientesPlato={[]} />, { wrapper })
    const fila = screen.getByText('Gazpacho').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /editar/i }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Gazpacho')
  })

  it('desactiva un plato activo llamando a plato.delete, sin pedir confirmación', async () => {
    let cuerpoRecibido: { action: string; payload: unknown } | null = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        cuerpoRecibido = (await request.json()) as { action: string; payload: unknown }
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<PlatoList platos={platos} ingredientesDisponibles={[]} ingredientesPlato={[]} />, { wrapper })
    const fila = screen.getByText('Gazpacho').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /desactivar/i }))
    expect(confirmSpy).not.toHaveBeenCalled()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cuerpoRecibido).toEqual({ action: 'plato.delete', token: 'test-token', payload: { id_plato: 1 } })
  })

  it('reactiva un plato inactivo llamando a plato.upsert con activo:true', async () => {
    let cuerpoRecibido: { action: string; payload: unknown } | null = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        cuerpoRecibido = (await request.json()) as { action: string; payload: unknown }
        return HttpResponse.json({ ok: true, result: { id_plato: 2 } })
      })
    )
    render(<PlatoList platos={platos} ingredientesDisponibles={[]} ingredientesPlato={[]} />, { wrapper })
    const fila = screen.getByText('Cocido').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /reactivar/i }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cuerpoRecibido).toEqual({
      action: 'plato.upsert',
      token: 'test-token',
      payload: { id_plato: 2, nombre: 'Cocido', temporada: 'INVIERNO', etiquetas: '', notas: '', activo: true }
    })
  })

  it('pasa los ingredientes disponibles y las líneas del plato al abrir su formulario', async () => {
    render(
      <PlatoList
        platos={platos}
        ingredientesDisponibles={[{ id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }]}
        ingredientesPlato={[{ id: 1, idPlato: 1, idIngrediente: 1, cantidad: 500, unidad: 'g' }]}
      />,
      { wrapper }
    )
    const fila = screen.getByText('Gazpacho').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /editar/i }))
    expect(screen.getByDisplayValue('500')).toBeInTheDocument()
  })

  it('no incluye líneas de otros platos al abrir el formulario', async () => {
    render(
      <PlatoList
        platos={platos}
        ingredientesDisponibles={[{ id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }]}
        ingredientesPlato={[{ id: 1, idPlato: 999, idIngrediente: 1, cantidad: 500, unidad: 'g' }]}
      />,
      { wrapper }
    )
    const fila = screen.getByText('Gazpacho').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /editar/i }))
    expect(screen.getByText('Ningún ingrediente añadido.')).toBeInTheDocument()
  })
})
