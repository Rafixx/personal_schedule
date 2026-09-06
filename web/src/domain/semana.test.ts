import { describe, expect, it } from 'vitest'
import { aAsignaciones, construirSemana, platosDelDia } from './semana'
import type { Plato, PlanEntry } from './types'

function plato(id: number, nombre: string): Plato {
  return { id, nombre, temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }
}

function entrada(fecha: string, orden: 1 | 2, idPlato: number): PlanEntry {
  return { id: 1, fecha, turno: 'COMIDA', orden, idPlato, notas: '' }
}

describe('construirSemana', () => {
  it('coloca cada plato en su fecha y hueco correctos', () => {
    const platos = [plato(5, 'Pasta'), plato(8, 'Salmón')]
    const entries = [entrada('2026-09-07', 1, 5), entrada('2026-09-07', 2, 8)]
    const dias = construirSemana(['2026-09-07', '2026-09-08'], entries, platos)
    expect(dias).toHaveLength(2)
    expect(dias[0].huecos[0]).toEqual({ fecha: '2026-09-07', orden: 1, plato: platos[0] })
    expect(dias[0].huecos[1]).toEqual({ fecha: '2026-09-07', orden: 2, plato: platos[1] })
    expect(dias[1].huecos[0].plato).toBeNull()
    expect(dias[1].huecos[1].plato).toBeNull()
  })

  it('deja el hueco en null si el plato referenciado ya no existe en el catálogo', () => {
    const entries = [entrada('2026-09-07', 1, 999)]
    const dias = construirSemana(['2026-09-07'], entries, [])
    expect(dias[0].huecos[0].plato).toBeNull()
  })
})

describe('aAsignaciones', () => {
  it('aplana los huecos de todos los días en una sola lista', () => {
    const platos = [plato(5, 'Pasta')]
    const entries = [entrada('2026-09-07', 1, 5)]
    const dias = construirSemana(['2026-09-07', '2026-09-08'], entries, platos)
    const asignaciones = aAsignaciones(dias)
    expect(asignaciones).toHaveLength(4)
    expect(asignaciones[0]).toEqual({ fecha: '2026-09-07', orden: 1, plato: platos[0] })
  })
})

describe('platosDelDia', () => {
  it('devuelve los platos asignados a una fecha, ignorando otras fechas', () => {
    const platos = [plato(5, 'Pasta'), plato(8, 'Salmón')]
    const entries = [entrada('2026-09-07', 1, 5), entrada('2026-09-07', 2, 8), entrada('2026-09-08', 1, 5)]
    const resultado = platosDelDia('2026-09-07', entries, platos)
    expect(resultado).toEqual([platos[0], platos[1]])
  })

  it('devuelve una lista vacía si no hay asignaciones ese día', () => {
    expect(platosDelDia('2026-09-09', [], [])).toEqual([])
  })
})
