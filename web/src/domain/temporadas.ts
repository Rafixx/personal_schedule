import type { Temporada } from './types'

const MES_A_TEMPORADA: Record<number, Temporada> = {
  1: 'INVIERNO',
  2: 'INVIERNO',
  3: 'PRIMAVERA',
  4: 'PRIMAVERA',
  5: 'PRIMAVERA',
  6: 'VERANO',
  7: 'VERANO',
  8: 'VERANO',
  9: 'OTOÑO',
  10: 'OTOÑO',
  11: 'OTOÑO',
  12: 'INVIERNO'
}

export function temporadaDe(fechaIso: string): Temporada {
  const mes = Number(fechaIso.slice(5, 7))
  return MES_A_TEMPORADA[mes]
}

export function estaEnTemporada(temporadas: Temporada[], fechaIso: string): boolean {
  if (temporadas.length === 0 || temporadas.includes('TODAS')) return true
  return temporadas.includes(temporadaDe(fechaIso))
}
