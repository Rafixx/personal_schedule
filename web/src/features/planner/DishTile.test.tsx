import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DishTile } from './DishTile'
import type { Plato } from '../../domain/types'

function plato(overrides: Partial<Plato> = {}): Plato {
  return { id: 1, nombre: 'Gazpacho', temporadas: ['TODAS'], etiquetas: ['verdura'], notas: '', activo: true, ...overrides }
}

describe('DishTile', () => {
  it('muestra el nombre y la etiqueta del plato', () => {
    render(<DishTile plato={plato()} fecha="2026-09-07" onQuitar={vi.fn()} />)
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getByText('verdura')).toBeInTheDocument()
  })

  it('llama a onQuitar al pulsar el botón de quitar', async () => {
    const onQuitar = vi.fn()
    render(<DishTile plato={plato()} fecha="2026-09-07" onQuitar={onQuitar} />)
    await userEvent.click(screen.getByRole('button', { name: /quitar gazpacho/i }))
    expect(onQuitar).toHaveBeenCalledOnce()
  })

  it('avisa cuando la fecha cae fuera de la temporada del plato', () => {
    render(<DishTile plato={plato({ temporadas: ['VERANO'] })} fecha="2026-09-07" onQuitar={vi.fn()} />)
    expect(screen.getByText(/fuera de temporada/i)).toBeInTheDocument()
  })

  it('no avisa cuando el plato vale para todas las temporadas', () => {
    render(<DishTile plato={plato({ temporadas: ['TODAS'] })} fecha="2026-09-07" onQuitar={vi.fn()} />)
    expect(screen.queryByText(/fuera de temporada/i)).not.toBeInTheDocument()
  })
})
