import type { Orden, Plato } from '../../domain/types'

export type OrigenArrastre =
  | { tipo: 'recetario'; plato: Plato }
  | { tipo: 'asignado'; fecha: string; orden: Orden; plato: Plato }

export interface DestinoArrastre {
  fecha: string
  orden: Orden
}

export type AccionArrastre =
  | { tipo: 'asignar'; fecha: string; orden: Orden; idPlato: number }
  | { tipo: 'mover'; origen: { fecha: string; orden: Orden }; destino: { fecha: string; orden: Orden } }
  | { tipo: 'quitar'; fecha: string; orden: Orden }
  | { tipo: 'ninguna' }

export function resolverArrastre(origen: OrigenArrastre, destino: DestinoArrastre | null): AccionArrastre {
  if (destino === null) {
    if (origen.tipo === 'asignado') return { tipo: 'quitar', fecha: origen.fecha, orden: origen.orden }
    return { tipo: 'ninguna' }
  }
  if (origen.tipo === 'recetario') {
    return { tipo: 'asignar', fecha: destino.fecha, orden: destino.orden, idPlato: origen.plato.id }
  }
  if (origen.fecha === destino.fecha && origen.orden === destino.orden) {
    return { tipo: 'ninguna' }
  }
  return {
    tipo: 'mover',
    origen: { fecha: origen.fecha, orden: origen.orden },
    destino: { fecha: destino.fecha, orden: destino.orden }
  }
}
