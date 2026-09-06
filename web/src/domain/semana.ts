import type { PlanEntry, Plato } from './types'
import type { AsignacionSemana } from './reglas'

export interface DiaSemana {
  fecha: string
  huecos: [AsignacionSemana, AsignacionSemana]
}

export function construirSemana(fechas: string[], entries: PlanEntry[], platos: Plato[]): DiaSemana[] {
  const platoPorId = new Map(platos.map((p) => [p.id, p]))
  return fechas.map((fecha) => {
    const huecos = ([1, 2] as const).map((orden): AsignacionSemana => {
      const entrada = entries.find((e) => e.fecha === fecha && e.orden === orden)
      const plato = entrada ? (platoPorId.get(entrada.idPlato) ?? null) : null
      return { fecha, orden, plato }
    })
    return { fecha, huecos: huecos as [AsignacionSemana, AsignacionSemana] }
  })
}

export function aAsignaciones(dias: DiaSemana[]): AsignacionSemana[] {
  return dias.flatMap((dia) => dia.huecos)
}

export function platosDelDia(fecha: string, entries: PlanEntry[], platos: Plato[]): Plato[] {
  const platoPorId = new Map(platos.map((p) => [p.id, p]))
  return entries
    .filter((e) => e.fecha === fecha)
    .map((e) => platoPorId.get(e.idPlato))
    .filter((p): p is Plato => p !== undefined)
}
