import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WeekBoard } from './WeekBoard'
import type { DiaSemana } from '../../domain/semana'

function diaVacio(fecha: string): DiaSemana {
  return {
    fecha,
    huecos: [
      { fecha, orden: 1, plato: null },
      { fecha, orden: 2, plato: null }
    ]
  }
}

const FECHAS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']

describe('WeekBoard', () => {
  it('renderiza los 5 días de la semana con sus nombres', () => {
    render(<WeekBoard dias={FECHAS.map(diaVacio)} hoyIso="2026-09-09" onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />)
    ;['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].forEach((nombre) => {
      expect(screen.getByText(nombre)).toBeInTheDocument()
    })
  })

  it('marca como hoy solo el día que coincide con hoyIso', () => {
    const { container } = render(
      <WeekBoard dias={FECHAS.map(diaVacio)} hoyIso="2026-09-09" onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />
    )
    expect(container.querySelectorAll('[data-today="true"]')).toHaveLength(1)
  })

  it('pasa la fecha del día correcto a onAbrirPicker', async () => {
    const onAbrirPicker = vi.fn()
    render(<WeekBoard dias={FECHAS.map(diaVacio)} hoyIso="2026-09-09" onAbrirPicker={onAbrirPicker} onQuitar={vi.fn()} />)
    const botones = screen.getAllByRole('button', { name: /añadir/i })
    await userEvent.click(botones[2])
    expect(onAbrirPicker).toHaveBeenCalledWith('2026-09-08', 1)
  })
})
