import { describe, expect, it } from 'vitest'
import { evaluarSemana } from './reglas'
import type { AsignacionSemana } from './reglas'
import type { Plato, Regla } from './types'

function plato(nombre: string, etiquetas: string[]): Plato {
  return { id: 1, nombre, temporadas: ['TODAS'], etiquetas, notas: '', activo: true }
}

function regla(parcial: Partial<Regla>): Regla {
  return { id: 1, etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true, ...parcial }
}

describe('evaluarSemana', () => {
  it('MAX_SEMANA en ok cuando no se supera el límite', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', plato: plato('Pasta', ['pasta']) },
      { fecha: '2026-09-08', plato: plato('Ensalada', ['verdura']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [regla({ tipo: 'MAX_SEMANA', valor: 1 })])
    expect(estado).toMatchObject({ actual: 1, objetivo: 1, estado: 'ok' })
  })

  it('MAX_SEMANA en aviso cuando se supera el límite', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', plato: plato('Pasta', ['pasta']) },
      { fecha: '2026-09-09', plato: plato('Macarrones', ['pasta']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [regla({ tipo: 'MAX_SEMANA', valor: 1 })])
    expect(estado).toMatchObject({ actual: 2, objetivo: 1, estado: 'aviso' })
  })

  it('MIN_SEMANA en aviso cuando no se llega al mínimo', () => {
    const asignaciones: AsignacionSemana[] = [{ fecha: '2026-09-07', plato: plato('Pasta', ['pasta']) }]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2 })
    ])
    expect(estado).toMatchObject({ actual: 0, objetivo: 2, estado: 'aviso' })
  })

  it('NO_CONSECUTIVO en aviso cuando dos días seguidos llevan la etiqueta', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', plato: plato('Hamburguesa', ['carne']) },
      { fecha: '2026-09-08', plato: plato('Pollo', ['carne']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'carne', tipo: 'NO_CONSECUTIVO', valor: 0 })
    ])
    expect(estado.estado).toBe('aviso')
  })

  it('NO_CONSECUTIVO en ok cuando el hueco entre fechas no es de 1 día (viernes y el lunes siguiente)', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-11', plato: plato('Hamburguesa', ['carne']) }, // viernes
      { fecha: '2026-09-14', plato: plato('Pollo', ['carne']) } // lunes siguiente
    ]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'carne', tipo: 'NO_CONSECUTIVO', valor: 0 })
    ])
    expect(estado.estado).toBe('ok')
  })

  it('ignora reglas inactivas', () => {
    const asignaciones: AsignacionSemana[] = [{ fecha: '2026-09-07', plato: plato('Pasta', ['pasta']) }]
    const resultado = evaluarSemana(asignaciones, [regla({ activa: false })])
    expect(resultado).toEqual([])
  })

  it('cuenta días sin plato asignado como ausencia de la etiqueta', () => {
    const asignaciones: AsignacionSemana[] = [{ fecha: '2026-09-07', plato: null }]
    const [estado] = evaluarSemana(asignaciones, [regla({ tipo: 'MAX_SEMANA', valor: 1 })])
    expect(estado.actual).toBe(0)
  })
})
