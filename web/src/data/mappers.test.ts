import { describe, expect, it } from 'vitest'
import { mapIngrediente, mapPlanEntry, mapPlato } from './mappers'

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

  it('normaliza temporadas en minúscula y descarta valores inválidos sin romper las válidas', () => {
    const resultado = mapPlato({
      id_plato: 1,
      nombre: 'Ensalada',
      temporada: 'verano,NOEXISTE',
      etiquetas: '',
      notas: '',
      activo: true
    })
    expect(resultado.temporadas).toEqual(['VERANO'])
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

describe('mapPlanEntry', () => {
  it('mapea orden e id_plato a idPlato', () => {
    const resultado = mapPlanEntry({
      id: 5,
      fecha: '2026-09-07',
      turno: 'COMIDA',
      orden: 2,
      id_plato: 3,
      notas: ''
    })
    expect(resultado).toEqual({
      id: 5,
      fecha: '2026-09-07',
      turno: 'COMIDA',
      orden: 2,
      idPlato: 3,
      notas: ''
    })
  })
})
