import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProviderGroup } from './ProviderGroup'
import type { ListaCompra } from '../../domain/compra'

const lista: ListaCompra = {
  proveedor: 'Mercadona',
  lineas: [
    { idIngrediente: 1, nombre: 'Tomate', proveedor: 'Mercadona', cantidad: 500, unidad: 'g' },
    { idIngrediente: 2, nombre: 'Pasta', proveedor: 'Mercadona', cantidad: 2, unidad: 'paquete' }
  ]
}

describe('ProviderGroup', () => {
  it('muestra el proveedor y cada línea con su cantidad', () => {
    render(<ProviderGroup lista={lista} comprado={() => false} onMarcar={vi.fn()} />)
    expect(screen.getByText('Mercadona')).toBeInTheDocument()
    expect(screen.getByText('Tomate: 500 g')).toBeInTheDocument()
    expect(screen.getByText('Pasta: 2 paquete')).toBeInTheDocument()
  })

  it('marca el checkbox como marcado cuando comprado devuelve true para esa línea', () => {
    render(<ProviderGroup lista={lista} comprado={(id) => id === 1} onMarcar={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /tomate/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /pasta/i })).not.toBeChecked()
  })

  it('llama a onMarcar con idIngrediente, unidad y el nuevo valor al marcar', async () => {
    const onMarcar = vi.fn()
    render(<ProviderGroup lista={lista} comprado={() => false} onMarcar={onMarcar} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /tomate/i }))
    expect(onMarcar).toHaveBeenCalledWith(1, 'g', true)
  })
})
