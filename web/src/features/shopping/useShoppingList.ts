import { useState } from 'react'
import { addWeeks } from 'date-fns'
import type { ListaCompra } from '../../domain/compra'
import { calcularCompra } from '../../domain/compra'
import { useCatalogo, usePlan } from '../../data/queries'
import { fechasSemana } from '../../shared/semanaDates'

export type RangoCompra = 'actual' | 'siguiente'

function claveComprado(desde: string, hasta: string): string {
  return `compra:${desde}:${hasta}`
}

function leerComprado(desde: string, hasta: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(claveComprado(desde, hasta))
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function useShoppingList(lunesActual: Date, rango: RangoCompra) {
  const lunes = rango === 'actual' ? lunesActual : addWeeks(lunesActual, 1)
  const fechas = fechasSemana(lunes)
  const desde = fechas[0]
  const hasta = fechas[4]

  const catalogo = useCatalogo()
  const plan = usePlan(desde, hasta)
  const [, setVersion] = useState(0)
  const comprados = leerComprado(desde, hasta)

  function comprado(idIngrediente: number, unidad: string): boolean {
    return comprados[`${idIngrediente}|${unidad}`] === true
  }

  function marcarComprado(idIngrediente: number, unidad: string, valor: boolean): void {
    const siguientes = { ...comprados, [`${idIngrediente}|${unidad}`]: valor }
    try {
      localStorage.setItem(claveComprado(desde, hasta), JSON.stringify(siguientes))
    } catch {
      // localStorage puede fallar (modo privado, cuota agotada); en ese caso la marca no
      // persiste — comprados se deriva de localStorage en cada render, así que tampoco
      // se refleja en memoria más allá de este render.
    }
    setVersion((v) => v + 1)
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
