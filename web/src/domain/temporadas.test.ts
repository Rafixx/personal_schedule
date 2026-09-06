import { describe, expect, it } from 'vitest'
import { estaEnTemporada, temporadaDe } from './temporadas'

describe('temporadaDe', () => {
  it('devuelve INVIERNO en enero y diciembre', () => {
    expect(temporadaDe('2026-01-15')).toBe('INVIERNO')
    expect(temporadaDe('2026-12-24')).toBe('INVIERNO')
  })

  it('devuelve VERANO en julio', () => {
    expect(temporadaDe('2026-07-01')).toBe('VERANO')
  })

  it('devuelve PRIMAVERA en abril y OTOÑO en octubre', () => {
    expect(temporadaDe('2026-04-10')).toBe('PRIMAVERA')
    expect(temporadaDe('2026-10-10')).toBe('OTOÑO')
  })
})

describe('estaEnTemporada', () => {
  it('es true si la lista está vacía (sin restricción)', () => {
    expect(estaEnTemporada([], '2026-01-15')).toBe(true)
  })

  it('es true si incluye TODAS', () => {
    expect(estaEnTemporada(['TODAS'], '2026-01-15')).toBe(true)
  })

  it('es true solo si la temporada actual está en la lista', () => {
    expect(estaEnTemporada(['VERANO'], '2026-07-15')).toBe(true)
    expect(estaEnTemporada(['VERANO'], '2026-01-15')).toBe(false)
  })

  it('admite varias temporadas', () => {
    expect(estaEnTemporada(['VERANO', 'OTOÑO'], '2026-10-01')).toBe(true)
    expect(estaEnTemporada(['VERANO', 'OTOÑO'], '2026-01-01')).toBe(false)
  })
})
