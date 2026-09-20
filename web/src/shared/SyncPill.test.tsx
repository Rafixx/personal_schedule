import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SyncPill } from './SyncPill'

function setup(overrides: Partial<Parameters<typeof SyncPill>[0]> = {}) {
  const props = { guardando: false, error: false, onRefrescar: vi.fn(), ...overrides }
  render(<SyncPill {...props} />)
  return props
}

describe('SyncPill', () => {
  it('muestra "Guardado" por defecto', () => {
    setup()
    expect(screen.getByText('Guardado')).toBeInTheDocument()
  })

  it('muestra "Guardando…" mientras guardando es true', () => {
    setup({ guardando: true })
    expect(screen.getByText('Guardando…')).toBeInTheDocument()
  })

  it('muestra "Sin conexión" cuando error es true', () => {
    setup({ error: true })
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  })

  it('prioriza "Sin conexión" sobre "Guardando…" cuando ambos son true', () => {
    setup({ guardando: true, error: true })
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
    expect(screen.queryByText('Guardando…')).not.toBeInTheDocument()
  })

  it('llama a onRefrescar al pulsar el indicador', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /actualizar datos/i }))
    expect(props.onRefrescar).toHaveBeenCalledOnce()
  })
})
