import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthView } from './MonthView'
import type { DiaMes } from './useMonthPlan'
import type { Plato } from '../../domain/types'

function plato(): Plato {
  return { id: 1, nombre: 'Pasta', temporadas: ['TODAS'], etiquetas: ['pasta'], notas: '', activo: true }
}

function diasDeEjemplo(): DiaMes[] {
  return Array.from({ length: 42 }, (_, i) => ({
    fecha: `2026-08-${String(i + 1).padStart(2, '0')}`,
    esOtroMes: i < 1,
    platos: i === 7 ? [plato()] : []
  }))
}

describe('MonthView', () => {
  it('renderiza 7 cabeceras de día de la semana y una celda con punto por cada día con plato', () => {
    render(<MonthView dias={diasDeEjemplo()} fechasSemanaActual={[]} onSeleccionarDia={vi.fn()} />)
    ;['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((d) => expect(screen.getAllByText(d).length).toBeGreaterThan(0))
    expect(screen.getAllByTestId('dia-punto')).toHaveLength(1)
  })

  it('llama a onSeleccionarDia con la fecha de la celda pulsada', async () => {
    const dias = diasDeEjemplo()
    const onSeleccionarDia = vi.fn()
    render(<MonthView dias={dias} fechasSemanaActual={[]} onSeleccionarDia={onSeleccionarDia} />)
    const celdas = screen.getAllByRole('button')
    await userEvent.click(celdas[10])
    expect(onSeleccionarDia).toHaveBeenCalledWith(dias[10].fecha)
  })

  it('marca las celdas fuera de mes con data-other-month', () => {
    const { container } = render(<MonthView dias={diasDeEjemplo()} fechasSemanaActual={[]} onSeleccionarDia={vi.fn()} />)
    expect(container.querySelectorAll('[data-other-month="true"]')).toHaveLength(1)
  })
})
