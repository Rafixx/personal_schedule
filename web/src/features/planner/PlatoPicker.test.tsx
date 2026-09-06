import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlatoPicker } from './PlatoPicker'
import type { Plato } from '../../domain/types'

function plato(id: number, nombre: string): Plato {
  return { id, nombre, temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }
}

describe('PlatoPicker', () => {
  it('no renderiza nada cuando abierto es false', () => {
    const { container } = render(
      <PlatoPicker abierto={false} tituloHueco="Primero" platos={[]} onElegir={vi.fn()} onCerrar={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra la lista de platos y el título del hueco', () => {
    render(
      <PlatoPicker abierto tituloHueco="Primero" platos={[plato(1, 'Gazpacho'), plato(2, 'Pasta')]} onElegir={vi.fn()} onCerrar={vi.fn()} />
    )
    expect(screen.getByText('Elegir plato · Primero')).toBeInTheDocument()
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
  })

  it('filtra la lista al escribir en el buscador', async () => {
    render(
      <PlatoPicker abierto tituloHueco="Primero" platos={[plato(1, 'Gazpacho'), plato(2, 'Pasta')]} onElegir={vi.fn()} onCerrar={vi.fn()} />
    )
    await userEvent.type(screen.getByPlaceholderText('Buscar plato…'), 'pas')
    expect(screen.queryByText('Gazpacho')).not.toBeInTheDocument()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
  })

  it('llama a onElegir con el id del plato pulsado', async () => {
    const onElegir = vi.fn()
    render(<PlatoPicker abierto tituloHueco="Primero" platos={[plato(1, 'Gazpacho')]} onElegir={onElegir} onCerrar={vi.fn()} />)
    await userEvent.click(screen.getByText('Gazpacho'))
    expect(onElegir).toHaveBeenCalledWith(1)
  })

  it('llama a onCerrar al pulsar el botón de cerrar', async () => {
    const onCerrar = vi.fn()
    render(<PlatoPicker abierto tituloHueco="Primero" platos={[]} onElegir={vi.fn()} onCerrar={onCerrar} />)
    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    expect(onCerrar).toHaveBeenCalledOnce()
  })

  it('muestra un mensaje cuando ningún plato coincide con la búsqueda', async () => {
    render(<PlatoPicker abierto tituloHueco="Primero" platos={[plato(1, 'Gazpacho')]} onElegir={vi.fn()} onCerrar={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('Buscar plato…'), 'zzz')
    expect(screen.getByText('Ningún plato coincide')).toBeInTheDocument()
  })
})
