import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Ingrediente } from '../../domain/types'
import { PlatoIngredientesEditor } from './PlatoIngredientesEditor'

const ingredientesDisponibles: Ingrediente[] = [
  { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] },
  { id: 2, nombre: 'Cebolla', proveedor: 'Frutería', unidadBase: 'ud', temporadas: ['TODAS'] }
]

describe('PlatoIngredientesEditor', () => {
  it('muestra un mensaje cuando no hay líneas', () => {
    render(
      <PlatoIngredientesEditor ingredientesDisponibles={ingredientesDisponibles} lineas={[]} onCambiar={vi.fn()} />
    )
    expect(screen.getByText('Ningún ingrediente añadido.')).toBeInTheDocument()
  })

  it('añade una línea con el primer ingrediente disponible al pulsar "+ Añadir ingrediente"', async () => {
    const onCambiar = vi.fn()
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[]}
        onCambiar={onCambiar}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /añadir ingrediente/i }))
    expect(onCambiar).toHaveBeenCalledWith([{ idIngrediente: 1, cantidad: 1, unidad: 'g' }])
  })

  it('muestra una fila por línea con su ingrediente, cantidad y unidad', () => {
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[{ idIngrediente: 2, cantidad: 3, unidad: 'ud' }]}
        onCambiar={vi.fn()}
      />
    )
    expect(screen.getByRole('combobox')).toHaveValue('2')
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ud')).toBeInTheDocument()
  })

  it('actualiza la cantidad de una línea al editarla', async () => {
    const onCambiar = vi.fn()
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[{ idIngrediente: 1, cantidad: 1, unidad: 'g' }]}
        onCambiar={onCambiar}
      />
    )
    const campoCantidad = screen.getByDisplayValue('1')
    // El componente es puramente controlado (sin estado interno): en este test aislado, sin un
    // wrapper que reenvíe onCambiar como nuevo prop `lineas`, userEvent.type carácter a carácter
    // se ve revertido por React tras cada onChange. fireEvent.change fija el valor final de una vez,
    // que es la forma idiomática de accionar un input controlado sin wrapper con estado.
    fireEvent.change(campoCantidad, { target: { value: '500' } })
    expect(onCambiar).toHaveBeenLastCalledWith([{ idIngrediente: 1, cantidad: 500, unidad: 'g' }])
  })

  it('quita una línea al pulsar su botón de quitar', async () => {
    const onCambiar = vi.fn()
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[
          { idIngrediente: 1, cantidad: 500, unidad: 'g' },
          { idIngrediente: 2, cantidad: 1, unidad: 'ud' }
        ]}
        onCambiar={onCambiar}
      />
    )
    const filas = screen.getAllByRole('button', { name: /quitar ingrediente/i })
    await userEvent.click(filas[0])
    expect(onCambiar).toHaveBeenCalledWith([{ idIngrediente: 2, cantidad: 1, unidad: 'ud' }])
  })

  it('muestra una opción de "no encontrado" si el ingrediente de la línea ya no está disponible', () => {
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[{ idIngrediente: 99, cantidad: 1, unidad: 'ud' }]}
        onCambiar={vi.fn()}
      />
    )
    expect(screen.getByText('Ingrediente #99 — no encontrado')).toBeInTheDocument()
  })

  it('recorta espacios de la unidad al perder el foco', () => {
    const onCambiar = vi.fn()
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[{ idIngrediente: 1, cantidad: 1, unidad: 'g' }]}
        onCambiar={onCambiar}
      />
    )
    const campoUnidad = screen.getByDisplayValue('g')
    fireEvent.change(campoUnidad, { target: { value: ' g ' } })
    fireEvent.blur(campoUnidad)
    expect(onCambiar).toHaveBeenLastCalledWith([{ idIngrediente: 1, cantidad: 1, unidad: 'g' }])
  })
})
