import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppBar } from './AppBar'

describe('AppBar', () => {
  it('muestra los enlaces de navegación y el contenido de la página', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppBar>
          <span>Contenido de la página</span>
        </AppBar>
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Planificador' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compra' })).toBeInTheDocument()
    expect(screen.getByText('Contenido de la página')).toBeInTheDocument()
  })

  it('marca "Compra" como activo cuando la ruta es /compra, y "Planificador" no', () => {
    render(
      <MemoryRouter initialEntries={['/compra']}>
        <AppBar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Compra' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Planificador' })).not.toHaveAttribute('aria-current')
  })
})
