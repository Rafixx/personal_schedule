import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RulesStrip } from './RulesStrip'
import type { EstadoRegla } from '../../domain/reglas'

describe('RulesStrip', () => {
  it('muestra un chip por regla con su etiqueta y estado', () => {
    const estados: EstadoRegla[] = [
      { etiqueta: 'pasta', tipo: 'MAX_SEMANA', actual: 1, objetivo: 1, estado: 'ok' },
      { etiqueta: 'pescado', tipo: 'MIN_SEMANA', actual: 0, objetivo: 2, estado: 'aviso' }
    ]
    render(<RulesStrip estados={estados} />)
    expect(screen.getByText('Pasta 1/1')).toBeInTheDocument()
    expect(screen.getByText('Pescado 0/2')).toBeInTheDocument()
  })

  it('describe las reglas NO_CONSECUTIVO sin fracción', () => {
    const estados: EstadoRegla[] = [
      { etiqueta: 'carne', tipo: 'NO_CONSECUTIVO', actual: 1, objetivo: 0, estado: 'aviso' }
    ]
    render(<RulesStrip estados={estados} />)
    expect(screen.getByText('Carne en días seguidos')).toBeInTheDocument()
  })

  it('no renderiza nada si no hay reglas activas', () => {
    const { container } = render(<RulesStrip estados={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
