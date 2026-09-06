import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'

function setup(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const props = {
    rangoSemana: '7–11 sep',
    vista: 'semana' as const,
    guardando: false,
    error: false,
    onSemanaAnterior: vi.fn(),
    onSemanaSiguiente: vi.fn(),
    onCambiarVista: vi.fn(),
    ...overrides
  }
  render(<Toolbar {...props} />)
  return props
}

describe('Toolbar', () => {
  it('muestra el rango de la semana', () => {
    setup()
    expect(screen.getByText('7–11 sep')).toBeInTheDocument()
  })

  it('llama a onSemanaAnterior y onSemanaSiguiente al pulsar las flechas', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /semana anterior/i }))
    await userEvent.click(screen.getByRole('button', { name: /semana siguiente/i }))
    expect(props.onSemanaAnterior).toHaveBeenCalledOnce()
    expect(props.onSemanaSiguiente).toHaveBeenCalledOnce()
  })

  it('llama a onCambiarVista al pulsar "Mes"', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('tab', { name: 'Mes' }))
    expect(props.onCambiarVista).toHaveBeenCalledWith('mes')
  })

  it('muestra "Guardando…" mientras guardando es true', () => {
    setup({ guardando: true })
    expect(screen.getByText('Guardando…')).toBeInTheDocument()
  })

  it('muestra "Sin conexión" cuando error es true', () => {
    setup({ error: true })
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  })
})
