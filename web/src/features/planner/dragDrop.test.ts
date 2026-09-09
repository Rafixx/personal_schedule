import { describe, expect, it } from 'vitest'
import { resolverArrastre } from './dragDrop'
import type { Plato } from '../../domain/types'

function plato(id: number): Plato {
  return { id, nombre: `Plato ${id}`, temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }
}

describe('resolverArrastre', () => {
  it('desde el Recetario a un hueco vacío: asigna', () => {
    const accion = resolverArrastre({ tipo: 'recetario', plato: plato(5) }, { fecha: '2026-09-07', orden: 1 })
    expect(accion).toEqual({ tipo: 'asignar', fecha: '2026-09-07', orden: 1, idPlato: 5 })
  })

  it('desde el Recetario a un hueco ocupado: asigna igualmente (reemplaza)', () => {
    const accion = resolverArrastre({ tipo: 'recetario', plato: plato(5) }, { fecha: '2026-09-07', orden: 2 })
    expect(accion).toEqual({ tipo: 'asignar', fecha: '2026-09-07', orden: 2, idPlato: 5 })
  })

  it('desde el Recetario sin destino válido: no hace nada', () => {
    const accion = resolverArrastre({ tipo: 'recetario', plato: plato(5) }, null)
    expect(accion).toEqual({ tipo: 'ninguna' })
  })

  it('un plato asignado soltado fuera de cualquier hueco: quita', () => {
    const accion = resolverArrastre({ tipo: 'asignado', fecha: '2026-09-07', orden: 1, plato: plato(5) }, null)
    expect(accion).toEqual({ tipo: 'quitar', fecha: '2026-09-07', orden: 1 })
  })

  it('un plato asignado soltado sobre su propio hueco: no hace nada', () => {
    const accion = resolverArrastre(
      { tipo: 'asignado', fecha: '2026-09-07', orden: 1, plato: plato(5) },
      { fecha: '2026-09-07', orden: 1 }
    )
    expect(accion).toEqual({ tipo: 'ninguna' })
  })

  it('un plato asignado soltado sobre otro hueco: mueve', () => {
    const accion = resolverArrastre(
      { tipo: 'asignado', fecha: '2026-09-07', orden: 1, plato: plato(5) },
      { fecha: '2026-09-08', orden: 2 }
    )
    expect(accion).toEqual({
      tipo: 'mover',
      origen: { fecha: '2026-09-07', orden: 1 },
      destino: { fecha: '2026-09-08', orden: 2 }
    })
  })
})
