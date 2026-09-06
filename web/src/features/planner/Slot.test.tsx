import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Slot } from './Slot'
import type { AsignacionSemana } from '../../domain/reglas'
import type { Plato } from '../../domain/types'

function plato(): Plato {
  return { id: 1, nombre: 'Pasta', temporadas: ['TODAS'], etiquetas: ['pasta'], notas: '', activo: true }
}

describe('Slot', () => {
  it('muestra el plato de dentro cuando el hueco está ocupado', () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 1, plato: plato() }
    render(<Slot asignacion={asignacion} etiquetaHueco="Primero" onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByText('Pasta')).toBeInTheDocument()
    expect(screen.getByText('Primero')).toBeInTheDocument()
  })

  it('llama a onQuitar cuando se pulsa quitar en un hueco ocupado', async () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 1, plato: plato() }
    const onQuitar = vi.fn()
    render(<Slot asignacion={asignacion} etiquetaHueco="Primero" onAbrirPicker={vi.fn()} onQuitar={onQuitar} />)
    await userEvent.click(screen.getByRole('button', { name: /quitar pasta/i }))
    expect(onQuitar).toHaveBeenCalledOnce()
  })

  it('muestra el botón de añadir cuando el hueco está vacío', () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 2, plato: null }
    render(<Slot asignacion={asignacion} etiquetaHueco="Segundo" onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByRole('button', { name: /añadir/i })).toBeInTheDocument()
  })

  it('llama a onAbrirPicker al pulsar añadir en un hueco vacío', async () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 2, plato: null }
    const onAbrirPicker = vi.fn()
    render(<Slot asignacion={asignacion} etiquetaHueco="Segundo" onAbrirPicker={onAbrirPicker} onQuitar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /añadir/i }))
    expect(onAbrirPicker).toHaveBeenCalledOnce()
  })
})
