import { describe, expect, it } from 'vitest'
import { fechasSemana, fechasSemanaCompleta, formatearRangoSemana, hoyIso, lunesDe } from './semanaDates'

describe('lunesDe', () => {
  it('devuelve el lunes de la semana para cualquier día de esa semana', () => {
    const miercoles = new Date('2026-09-09T12:00:00')
    const lunes = lunesDe(miercoles)
    expect(lunes.getFullYear()).toBe(2026)
    expect(lunes.getMonth()).toBe(8)
    expect(lunes.getDate()).toBe(7)
  })
})

describe('fechasSemana', () => {
  it('devuelve las 5 fechas ISO de lunes a viernes', () => {
    const lunes = new Date(2026, 8, 7)
    expect(fechasSemana(lunes)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11'
    ])
  })
})

describe('fechasSemanaCompleta', () => {
  it('devuelve las 7 fechas ISO consecutivas de lunes a domingo', () => {
    const lunes = new Date(2026, 8, 7)
    expect(fechasSemanaCompleta(lunes)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11',
      '2026-09-12',
      '2026-09-13'
    ])
  })
})

describe('formatearRangoSemana', () => {
  it('usa solo el día para el inicio cuando ambos extremos caen en el mismo mes', () => {
    const lunes = new Date(2026, 8, 7)
    expect(formatearRangoSemana(lunes)).toBe('7–11 sep')
  })

  it('usa día y mes en el inicio cuando la semana cruza un cambio de mes', () => {
    const lunes = new Date(2026, 7, 31)
    expect(formatearRangoSemana(lunes)).toBe('31 ago–4 sep')
  })
})

describe('hoyIso', () => {
  it('devuelve la fecha de hoy en formato ISO yyyy-MM-dd', () => {
    expect(hoyIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
