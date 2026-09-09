import { describe, expect, it } from 'vitest'
import { colorVarDeEtiqueta, colorVarDePlato } from './tagColors'

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

describe('colorVarDePlato', () => {
  it('usa la primera etiqueta cuando el plato tiene alguna', () => {
    const plato = { etiquetas: ['pasta'], nombre: 'Espaguetis a la boloñesa' }
    expect(colorVarDePlato(plato)).toBe(colorVarDeEtiqueta('pasta'))
  })

  it('cae al nombre del plato cuando no tiene ninguna etiqueta', () => {
    const plato = { etiquetas: [], nombre: 'Hamburguesa' }
    expect(colorVarDePlato(plato)).toBe(colorVarDeEtiqueta('Hamburguesa'))
  })

  it('dos platos sin etiquetar y con nombres distintos no comparten siempre el mismo color', () => {
    const a = colorVarDePlato({ etiquetas: [], nombre: 'Hamburguesa' })
    const b = colorVarDePlato({ etiquetas: [], nombre: 'Ensalada' })
    expect(a).not.toBe(b)
  })
})
