import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Recetario } from './Recetario'
import type { Plato } from '../../domain/types'

function plato(id: number, nombre: string): Plato {
  return { id, nombre, temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }
}

describe('Recetario', () => {
  it('muestra todos los platos recibidos', () => {
    render(<Recetario platos={[plato(1, 'Gazpacho'), plato(2, 'Pasta')]} />)
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
  })

  it('filtra por nombre al escribir en el buscador', async () => {
    render(<Recetario platos={[plato(1, 'Gazpacho'), plato(2, 'Pasta')]} />)
    await userEvent.type(screen.getByPlaceholderText('Buscar plato…'), 'gaz')
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.queryByText('Pasta')).not.toBeInTheDocument()
  })

  it('muestra un mensaje cuando ningún plato coincide', async () => {
    render(<Recetario platos={[plato(1, 'Gazpacho')]} />)
    await userEvent.type(screen.getByPlaceholderText('Buscar plato…'), 'zzz')
    expect(screen.getByText('Ningún plato coincide')).toBeInTheDocument()
  })

  it('envuelve cada plato en un elemento arrastrable', () => {
    render(<Recetario platos={[plato(1, 'Gazpacho')]} />)
    const arrastrable = screen.getByRole('button', { name: 'Arrastrar Gazpacho' })
    expect(arrastrable).toHaveAttribute('aria-roledescription', 'draggable')
  })
})
