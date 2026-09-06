import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DishChip } from './DishChip'

describe('DishChip', () => {
  it('muestra el nombre y la etiqueta del plato', () => {
    render(
      <DishChip plato={{ id: 1, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: ['verdura'], notas: '', activo: true }} />
    )
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getByText('verdura')).toBeInTheDocument()
  })

  it('muestra el icono de temporada cuando el plato no vale para todas', () => {
    render(<DishChip plato={{ id: 1, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: [], notas: '', activo: true }} />)
    expect(screen.getByTitle('Temporada: VERANO')).toBeInTheDocument()
  })

  it('no muestra el icono de temporada cuando el plato vale para todas', () => {
    render(<DishChip plato={{ id: 1, nombre: 'Gazpacho', temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }} />)
    expect(screen.queryByTitle(/temporada/i)).not.toBeInTheDocument()
  })
})
