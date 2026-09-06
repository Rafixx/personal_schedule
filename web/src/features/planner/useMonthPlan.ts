import { addDays, format, startOfMonth } from 'date-fns'
import type { Plato } from '../../domain/types'
import { platosDelDia } from '../../domain/semana'
import { useCatalogo, usePlan } from '../../data/queries'
import { lunesDe } from '../../shared/semanaDates'

export interface DiaMes {
  fecha: string
  esOtroMes: boolean
  platos: Plato[]
}

export function useMonthPlan(mesReferencia: Date) {
  const inicio = lunesDe(startOfMonth(mesReferencia))
  const desde = format(inicio, 'yyyy-MM-dd')
  const hasta = format(addDays(inicio, 41), 'yyyy-MM-dd')
  const catalogo = useCatalogo()
  const plan = usePlan(desde, hasta)

  const platos = catalogo.data?.catalogo.platos ?? []
  const entries = plan.data ?? []
  const mes = mesReferencia.getMonth()

  const dias: DiaMes[] = Array.from({ length: 42 }, (_, i) => {
    const fecha = addDays(inicio, i)
    const iso = format(fecha, 'yyyy-MM-dd')
    return { fecha: iso, esOtroMes: fecha.getMonth() !== mes, platos: platosDelDia(iso, entries, platos) }
  })

  return { dias, cargando: catalogo.isLoading || plan.isLoading }
}
