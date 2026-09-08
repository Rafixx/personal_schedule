import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Catalogo, Orden, PlanEntry, Turno } from '../domain/types'
import { sheetsClient } from './client'
import type { FilaInvalida } from './schemas'
import {
  bootstrapEnvelopeSchema,
  ingredientePlatoRowSchema,
  ingredienteRowSchema,
  parseRows,
  planEnvelopeSchema,
  planEntryRowSchema,
  platoRowSchema,
  proveedorRowSchema,
  reglaRowSchema
} from './schemas'
import {
  mapIngrediente,
  mapIngredientePlato,
  mapPlanEntry,
  mapPlato,
  mapProveedor,
  mapRegla
} from './mappers'

export interface CatalogoConAvisos {
  catalogo: Catalogo
  filasInvalidas: number
  erroresPorColeccion: {
    platos: FilaInvalida[]
    ingredientes: FilaInvalida[]
    ingredientesPlatos: FilaInvalida[]
    reglas: FilaInvalida[]
    proveedores: FilaInvalida[]
  }
}

async function fetchCatalogo(): Promise<CatalogoConAvisos> {
  const raw = await sheetsClient.apiGet('bootstrap')
  const envelope = bootstrapEnvelopeSchema.parse(raw)
  const platos = parseRows(platoRowSchema, envelope.platos)
  const ingredientes = parseRows(ingredienteRowSchema, envelope.ingredientes)
  const ingredientesPlatos = parseRows(ingredientePlatoRowSchema, envelope.ingredientesPlatos)
  const reglas = parseRows(reglaRowSchema, envelope.reglas)
  const proveedores = parseRows(proveedorRowSchema, envelope.proveedores)
  return {
    catalogo: {
      platos: platos.valid.map(mapPlato),
      ingredientes: ingredientes.valid.map(mapIngrediente),
      ingredientesPlatos: ingredientesPlatos.valid.map(mapIngredientePlato),
      reglas: reglas.valid.map(mapRegla),
      proveedores: proveedores.valid.map(mapProveedor)
    },
    filasInvalidas:
      platos.invalid.length +
      ingredientes.invalid.length +
      ingredientesPlatos.invalid.length +
      reglas.invalid.length +
      proveedores.invalid.length,
    erroresPorColeccion: {
      platos: platos.invalid,
      ingredientes: ingredientes.invalid,
      ingredientesPlatos: ingredientesPlatos.invalid,
      reglas: reglas.invalid,
      proveedores: proveedores.invalid
    }
  }
}

export function useCatalogo() {
  return useQuery({ queryKey: ['catalogo'], queryFn: fetchCatalogo })
}

async function fetchPlan(desde: string, hasta: string): Promise<PlanEntry[]> {
  const raw = await sheetsClient.apiGet('plan', { desde, hasta })
  const envelope = planEnvelopeSchema.parse(raw)
  const { valid } = parseRows(planEntryRowSchema, envelope.entries)
  return valid.map(mapPlanEntry)
}

export function usePlan(desde: string, hasta: string) {
  return useQuery({ queryKey: ['plan', desde, hasta], queryFn: () => fetchPlan(desde, hasta) })
}

async function instantaneaPlan(queryClient: QueryClient) {
  await queryClient.cancelQueries({ queryKey: ['plan'] })
  return queryClient.getQueriesData<PlanEntry[]>({ queryKey: ['plan'] })
}

function revertirPlan(queryClient: QueryClient, previas: Awaited<ReturnType<typeof instantaneaPlan>>) {
  previas.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data))
}

interface NuevaAsignacion {
  fecha: string
  turno: Turno
  orden: Orden
  idPlato: number
  notas?: string
}

export function useSetPlanEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entrada: NuevaAsignacion) =>
      sheetsClient.apiPost('plan.set', {
        fecha: entrada.fecha,
        turno: entrada.turno,
        orden: entrada.orden,
        id_plato: entrada.idPlato,
        notas: entrada.notas ?? ''
      }),
    retry: 2,
    onMutate: async (entrada) => {
      const previas = await instantaneaPlan(queryClient)
      queryClient.setQueriesData<PlanEntry[]>({ queryKey: ['plan'] }, (anteriores) => {
        if (!anteriores) return anteriores
        const sinEsaAsignacion = anteriores.filter(
          (e) => !(e.fecha === entrada.fecha && e.turno === entrada.turno && e.orden === entrada.orden)
        )
        return [
          ...sinEsaAsignacion,
          {
            id: -Date.now(),
            fecha: entrada.fecha,
            turno: entrada.turno,
            orden: entrada.orden,
            idPlato: entrada.idPlato,
            notas: entrada.notas ?? ''
          }
        ]
      })
      return { previas }
    },
    onError: (_err, _entrada, context) => {
      if (context) revertirPlan(queryClient, context.previas)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
  })
}

interface ExtremoPlan {
  fecha: string
  turno: Turno
  orden: Orden
}

export function useMovePlanEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { from: ExtremoPlan; to: ExtremoPlan }) => sheetsClient.apiPost('plan.move', args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
  })
}

export function useDeletePlanEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: ExtremoPlan) => sheetsClient.apiPost('plan.delete', args),
    retry: 2,
    onMutate: async (args) => {
      const previas = await instantaneaPlan(queryClient)
      queryClient.setQueriesData<PlanEntry[]>({ queryKey: ['plan'] }, (anteriores) =>
        anteriores?.filter((e) => !(e.fecha === args.fecha && e.turno === args.turno && e.orden === args.orden))
      )
      return { previas }
    },
    onError: (_err, _args, context) => {
      if (context) revertirPlan(queryClient, context.previas)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
  })
}
