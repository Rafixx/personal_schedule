import { addWeeks } from 'date-fns'
import type { ListaCompra } from '../../domain/compra'
import { calcularCompra } from '../../domain/compra'
import { useCatalogo, useMarcarCompra, useMarcasCompra, usePlan } from '../../data/queries'
import { fechasSemana } from '../../shared/semanaDates'

export type RangoCompra = 'actual' | 'siguiente'

function lunesDeRango(lunesActual: Date, rango: RangoCompra): Date {
  return rango === 'actual' ? lunesActual : addWeeks(lunesActual, 1)
}

// Compartido con ShoppingListPage (para el indicador de sincronización, que
// necesita la misma clave ['compra', semana] sin duplicar este cálculo).
export function semanaDeRango(lunesActual: Date, rango: RangoCompra): string {
  return fechasSemana(lunesDeRango(lunesActual, rango))[0]
}

export function useShoppingList(lunesActual: Date, rango: RangoCompra) {
  const lunes = lunesDeRango(lunesActual, rango)
  const fechas = fechasSemana(lunes)
  const desde = fechas[0]
  const hasta = fechas[4]
  const semana = desde

  const catalogo = useCatalogo()
  const plan = usePlan(desde, hasta)
  const marcasCompra = useMarcasCompra(semana)
  const marcarCompra = useMarcarCompra()
  const marcas = marcasCompra.data ?? []

  function comprado(idIngrediente: number, unidad: string): boolean {
    return marcas.some((m) => m.idIngrediente === idIngrediente && m.unidad === unidad)
  }

  function marcarComprado(idIngrediente: number, unidad: string, valor: boolean): void {
    marcarCompra.mutate({ semana, idIngrediente, unidad, comprado: valor })
  }

  const listas: ListaCompra[] = catalogo.data && plan.data ? calcularCompra(plan.data, catalogo.data.catalogo) : []

  return {
    listas,
    cargando: catalogo.isLoading || plan.isLoading,
    error: catalogo.isError || plan.isError,
    comprado,
    marcarComprado
  }
}
