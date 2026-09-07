import { addDays, format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const

export function lunesDe(fecha: Date): Date {
  return startOfWeek(fecha, { weekStartsOn: 1 })
}

export function fechasSemana(lunes: Date): string[] {
  return Array.from({ length: 5 }, (_, i) => format(addDays(lunes, i), 'yyyy-MM-dd'))
}

export function fechasSemanaCompleta(lunes: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => format(addDays(lunes, i), 'yyyy-MM-dd'))
}

export function formatearRangoSemana(lunes: Date): string {
  const viernes = addDays(lunes, 4)
  const mismoMes = lunes.getMonth() === viernes.getMonth()
  const inicio = mismoMes ? format(lunes, 'd') : format(lunes, 'd MMM', { locale: es })
  return `${inicio}–${format(viernes, 'd MMM', { locale: es })}`
}

export function hoyIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
