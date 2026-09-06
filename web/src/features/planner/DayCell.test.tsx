import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DayCell } from './DayCell'
import type { DiaSemana } from '../../domain/semana'
import type { Plato } from '../../domain/types'

function plato(): Plato {
  return { id: 1, nombre: 'Pasta', temporadas: ['TODAS'], etiquetas: ['pasta'], notas: '', activo: true }
}

function dia(): DiaSemana {
  return {
    fecha: '2026-09-07',
    huecos: [
      { fecha: '2026-09-07', orden: 1, plato: plato() },
      { fecha: '2026-09-07', orden: 2, plato: null }
    ]
  }
}

describe('DayCell', () => {
  it('muestra el nombre y el número del día, y los dos huecos', () => {
    render(<DayCell dia={dia()} nombreDia="Lunes" numeroDia={7} esHoy={false} onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByText('Lunes')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /añadir/i })).toBeInTheDocument()
  })

  it('marca la celda de hoy con data-today', () => {
    const { container } = render(
      <DayCell dia={dia()} nombreDia="Lunes" numeroDia={7} esHoy onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />
    )
    expect(container.querySelector('[data-today="true"]')).not.toBeNull()
  })

  it('propaga el orden correcto al abrir el picker del segundo hueco', async () => {
    const onAbrirPicker = vi.fn()
    render(<DayCell dia={dia()} nombreDia="Lunes" numeroDia={7} esHoy={false} onAbrirPicker={onAbrirPicker} onQuitar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /añadir/i }))
    expect(onAbrirPicker).toHaveBeenCalledWith(2)
  })

  it('propaga el orden correcto al quitar el plato del primer hueco', async () => {
    const onQuitar = vi.fn()
    render(<DayCell dia={dia()} nombreDia="Lunes" numeroDia={7} esHoy={false} onAbrirPicker={vi.fn()} onQuitar={onQuitar} />)
    await userEvent.click(screen.getByRole('button', { name: /quitar pasta/i }))
    expect(onQuitar).toHaveBeenCalledWith(1)
  })
})
