import { describe, expect, it } from 'vitest'
import { colorVarDeEtiqueta } from './tagColors'

describe('colorVarDeEtiqueta', () => {
  it('asigna el mismo color a la misma etiqueta siempre', () => {
    expect(colorVarDeEtiqueta('pasta')).toBe(colorVarDeEtiqueta('pasta'))
  })

  it('devuelve una variable CSS del rango de 7 colores validados', () => {
    expect(colorVarDeEtiqueta('pasta')).toBe('var(--tag-color-4)')
    expect(colorVarDeEtiqueta('carne')).toBe('var(--tag-color-6)')
    expect(colorVarDeEtiqueta('pescado')).toBe('var(--tag-color-0)')
    expect(colorVarDeEtiqueta('verdura')).toBe('var(--tag-color-5)')
  })
})
