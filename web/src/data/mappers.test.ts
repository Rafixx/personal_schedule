import { describe, expect, it } from 'vitest'
import { mapIngrediente, mapPlato } from './mappers'

describe('mapPlato', () => {
  it('convierte temporada y etiquetas en listas, e ignora _row', () => {
    const resultado = mapPlato({
      id_plato: 1,
      nombre: 'Pasta',
      temporada: 'TODAS',
      etiquetas: 'pasta,rapido',
      notas: '',
      activo: true
    })
    expect(resultado).toEqual({
      id: 1,
      nombre: 'Pasta',
      temporadas: ['TODAS'],
      etiquetas: ['pasta', 'rapido'],
      notas: '',
      activo: true
    })
  })

  it('devuelve lista vacía de etiquetas cuando la columna está vacía', () => {
    const resultado = mapPlato({
      id_plato: 1,
      nombre: 'Ensalada',
      temporada: 'TODAS',
      etiquetas: '',
      notas: '',
      activo: true
    })
    expect(resultado.etiquetas).toEqual([])
  })
})

describe('mapIngrediente', () => {
  it('deja los macros como undefined si no había valor', () => {
    const resultado = mapIngrediente({
      id_ingrediente: 1,
      nombre: 'Tomate',
      proveedor: 'Frutería',
      unidad_base: '',
      temporada: '',
      kcal_100: undefined,
      prot_100: undefined,
      carb_100: undefined,
      grasa_100: undefined
    })
    expect(resultado.kcal100).toBeUndefined()
  })
})
