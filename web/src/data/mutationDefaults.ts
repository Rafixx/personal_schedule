import type { QueryClient } from '@tanstack/react-query'
import type { MarcaCompra } from '../domain/types'
import { sheetsClient } from './client'

// Clave estable (serializable) de la mutación de marcar/desmarcar un
// ingrediente como comprado. Se registra una única vez vía
// registrarMutationDefaults, y useMarcarCompra() la referencia por clave en
// vez de llevar su propio mutationFn — así una mutación rehidratada desde
// IndexedDB tras recargar la página (que solo trae mutationKey + estado, sin
// funciones) puede recuperar aquí su comportamiento y reenviarse sola.
export const MARCAR_COMPRA_MUTATION_KEY = ['compra', 'marcar'] as const

export interface MarcarCompraInput {
  semana: string
  idIngrediente: number
  unidad: string
  comprado: boolean
}

export interface MarcarCompraContext {
  previas: MarcaCompra[] | undefined
  queryKey: readonly ['compra', string]
}

// Registra el mutationFn y el ciclo optimista de "marcar comprado" en el
// QueryClient, por clave. Debe llamarse una vez, justo tras crear el
// QueryClient y antes de que se monte cualquier componente — si una mutación
// pausada se rehidrata desde IndexedDB antes de que este registro exista,
// no encontraría su mutationFn.
export function registrarMutationDefaults(queryClient: QueryClient): void {
  queryClient.setMutationDefaults<unknown, Error, MarcarCompraInput, MarcarCompraContext>(
    MARCAR_COMPRA_MUTATION_KEY,
    {
      mutationFn: (args) =>
        sheetsClient.apiPost('compra.marcar', {
          semana: args.semana,
          id_ingrediente: args.idIngrediente,
          unidad: args.unidad,
          comprado: args.comprado
        }),
      // compra.marcar es idempotente por diseño (marcar dos veces o desmarcar
      // dos veces no hace nada la segunda vez), así que reintentar tras un
      // fallo de red es seguro.
      retry: 2,
      onMutate: async (args) => {
        const queryKey = ['compra', args.semana] as const
        await queryClient.cancelQueries({ queryKey })
        const previas = queryClient.getQueryData<MarcaCompra[]>(queryKey)
        queryClient.setQueryData<MarcaCompra[]>(queryKey, (anteriores) => {
          // Igual que useSetPlanEntry/useDeletePlanEntry: si todavía no hay datos
          // (el GET inicial ni siquiera ha resuelto — cancelQueries lo acaba de
          // descartar), NO sintetizamos una lista a partir de [], porque eso
          // borraría de la vista marcas reales ya persistidas (p.ej. "leche"
          // marcada desde otro dispositivo) que aún no habían llegado a esta
          // caché. Se omite la actualización optimista en ese caso concreto; el
          // POST sigue adelante igualmente y onSettled corrige el estado real.
          if (!anteriores) return anteriores
          const sinEsaMarca = anteriores.filter(
            (m) => !(m.idIngrediente === args.idIngrediente && m.unidad === args.unidad)
          )
          if (!args.comprado) return sinEsaMarca
          return [
            ...sinEsaMarca,
            {
              id: -Date.now(),
              semana: args.semana,
              idIngrediente: args.idIngrediente,
              unidad: args.unidad
            }
          ]
        })
        return { previas, queryKey }
      },
      onError: (_err, _args, context) => {
        if (context) queryClient.setQueryData(context.queryKey, context.previas)
      },
      onSettled: (_data, _err, args) =>
        queryClient.invalidateQueries({ queryKey: ['compra', args.semana] })
    }
  )
}
