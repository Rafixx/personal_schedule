import { describe, expect, it } from 'vitest'
import {
  bootstrapEnvelopeSchema,
  ingredienteRowSchema,
  parseRows,
  platoRowSchema
} from './schemas'

describe('platoRowSchema', () => {
  it('acepta una fila real de la hoja', () => {
    const fila = {
      id_plato: 1,
      nombre: 'Gazpacho',
      temporada: 'VERANO',
      etiquetas: '',
      notas: '',
      activo: true,
      _row: 2
    }
    const resultado = platoRowSchema.safeParse(fila)
    expect(resultado.success).toBe(true)
  })

  it('interpreta correctamente activo como texto "false" (no usa Boolean() a secas)', () => {
    const resultado = platoRowSchema.safeParse({
      id_plato: 1,
      nombre: 'Test',
      temporada: 'TODAS',
      etiquetas: '',
      notas: '',
      activo: 'false'
    })
    expect(resultado.success).toBe(true)
    expect(resultado.success && resultado.data.activo).toBe(false)
  })

  it('rechaza una fila sin nombre', () => {
    const resultado = platoRowSchema.safeParse({
      id_plato: 1,
      nombre: '',
      temporada: 'TODAS',
      etiquetas: '',
      notas: '',
      activo: true
    })
    expect(resultado.success).toBe(false)
  })
})

describe('ingredienteRowSchema', () => {
  it('acepta macros vacíos (columnas todavía sin rellenar)', () => {
    const resultado = ingredienteRowSchema.safeParse({
      id_ingrediente: 1,
      nombre: 'Tomate',
      proveedor: 'Frutería/verdulería',
      unidad_base: '',
      temporada: '',
      kcal_100: '',
      prot_100: '',
      carb_100: '',
      grasa_100: ''
    })
    expect(resultado.success).toBe(true)
    expect(resultado.success && resultado.data.kcal_100).toBeUndefined()
  })
})

describe('parseRows', () => {
  it('descarta filas inválidas sin romper las válidas', () => {
    const filas = [
      { id_plato: 1, nombre: 'Gazpacho', temporada: 'VERANO', etiquetas: '', notas: '', activo: true },
      { id_plato: 2, nombre: '', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }
    ]
    const { valid, invalid } = parseRows(platoRowSchema, filas)
    expect(valid).toHaveLength(1)
    expect(invalid).toHaveLength(1)
  })
})

describe('bootstrapEnvelopeSchema', () => {
  it('valida la forma general de la respuesta sin validar cada fila todavía', () => {
    const resultado = bootstrapEnvelopeSchema.safeParse({
      ok: true,
      platos: [{ cualquierCosa: true }],
      ingredientes: [],
      ingredientesPlatos: [],
      reglas: [],
      proveedores: []
    })
    expect(resultado.success).toBe(true)
  })
})
