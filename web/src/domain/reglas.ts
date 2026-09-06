import type { Orden, Plato, Regla } from './types'

export interface AsignacionSemana {
  fecha: string
  orden: Orden
  plato: Plato | null
}

export interface EstadoRegla {
  etiqueta: string
  tipo: Regla['tipo']
  actual: number
  objetivo: number
  estado: 'ok' | 'aviso'
}

function tienEtiqueta(asignacion: AsignacionSemana, etiqueta: string): boolean {
  return asignacion.plato !== null && asignacion.plato.etiquetas.includes(etiqueta)
}

function contarPorEtiqueta(asignaciones: AsignacionSemana[], etiqueta: string): number {
  return asignaciones.filter((a) => tienEtiqueta(a, etiqueta)).length
}

function diasEntre(fechaA: string, fechaB: string): number {
  const a = new Date(`${fechaA}T00:00:00Z`).getTime()
  const b = new Date(`${fechaB}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

// Dos asignaciones se consideran "seguidas" si están en el mismo día
// (distinto hueco, distancia 0) o en días calendario consecutivos
// (distancia 1) — así una regla NO_CONSECUTIVO detecta tanto carne dos
// días seguidos como carne de primero y segundo el mismo día.
function hayConsecutivos(asignaciones: AsignacionSemana[], etiqueta: string): boolean {
  const ordenadas = [...asignaciones].sort((a, b) => {
    const porFecha = a.fecha.localeCompare(b.fecha)
    return porFecha !== 0 ? porFecha : a.orden - b.orden
  })
  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1]
    const actual = ordenadas[i]
    const distancia = diasEntre(anterior.fecha, actual.fecha)
    if (distancia <= 1 && tienEtiqueta(anterior, etiqueta) && tienEtiqueta(actual, etiqueta)) {
      return true
    }
  }
  return false
}

export function evaluarSemana(asignaciones: AsignacionSemana[], reglas: Regla[]): EstadoRegla[] {
  return reglas
    .filter((regla) => regla.activa)
    .map((regla) => {
      if (regla.tipo === 'NO_CONSECUTIVO') {
        const incumple = hayConsecutivos(asignaciones, regla.etiqueta)
        return {
          etiqueta: regla.etiqueta,
          tipo: regla.tipo,
          actual: incumple ? 1 : 0,
          objetivo: 0,
          estado: incumple ? 'aviso' : 'ok'
        }
      }
      const actual = contarPorEtiqueta(asignaciones, regla.etiqueta)
      const cumple = regla.tipo === 'MAX_SEMANA' ? actual <= regla.valor : actual >= regla.valor
      return {
        etiqueta: regla.etiqueta,
        tipo: regla.tipo,
        actual,
        objetivo: regla.valor,
        estado: cumple ? 'ok' : 'aviso'
      }
    })
}
