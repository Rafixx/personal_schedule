import type { Orden } from '../../domain/types'
import { aAsignaciones, construirSemana } from '../../domain/semana'
import { evaluarSemana } from '../../domain/reglas'
import { useCatalogo, useDeletePlanEntry, usePlan, useSetPlanEntry } from '../../data/queries'
import { fechasSemana } from '../../shared/semanaDates'

export function useWeekPlan(lunes: Date) {
  const fechas = fechasSemana(lunes)
  const catalogo = useCatalogo()
  const plan = usePlan(fechas[0], fechas[4])
  const setPlanEntry = useSetPlanEntry()
  const deletePlanEntry = useDeletePlanEntry()

  const platos = catalogo.data?.catalogo.platos ?? []
  const platosActivos = platos.filter((p) => p.activo)
  const entries = plan.data ?? []
  const dias = construirSemana(fechas, entries, platos)
  const reglas = catalogo.data?.catalogo.reglas ?? []
  const estadosRegla = evaluarSemana(aAsignaciones(dias), reglas)

  function asignarPlato(fecha: string, orden: Orden, idPlato: number) {
    setPlanEntry.mutate({ fecha, turno: 'COMIDA', orden, idPlato })
  }

  function quitarPlato(fecha: string, orden: Orden) {
    deletePlanEntry.mutate({ fecha, turno: 'COMIDA', orden })
  }

  return {
    dias,
    estadosRegla,
    platosActivos,
    cargando: catalogo.isLoading || plan.isLoading,
    error: catalogo.isError || plan.isError || setPlanEntry.isError || deletePlanEntry.isError,
    guardando: setPlanEntry.isPending || deletePlanEntry.isPending,
    asignarPlato,
    quitarPlato
  }
}
