import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { Catalogo, MarcaCompra, Orden, PlanEntry, Temporada, TipoRegla, Turno } from '../domain/types'
import { sheetsClient } from './client'
import { borrarSesion, guardarSesion } from './session'
import type { FilaInvalida } from './schemas'
import {
  bootstrapEnvelopeSchema,
  compraEnvelopeSchema,
  ingredientePlatoRowSchema,
  ingredienteRowSchema,
  marcaCompraRowSchema,
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
  mapMarcaCompra,
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
      // Ordenados por nombre aquí, en el único sitio donde se construye el
      // catálogo: así todas las listas de platos e ingredientes de la app
      // (Catálogo, Recetario, selector de plato, editor de ingredientes de
      // un plato...) salen alfabéticas sin tener que ordenar en cada una.
      platos: platos.valid.map(mapPlato).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      ingredientes: ingredientes.valid
        .map(mapIngrediente)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
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

function mismoExtremo(entrada: PlanEntry, extremo: ExtremoPlan): boolean {
  return entrada.fecha === extremo.fecha && entrada.turno === extremo.turno && entrada.orden === extremo.orden
}

export function useMovePlanEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { from: ExtremoPlan; to: ExtremoPlan }) => sheetsClient.apiPost('plan.move', args),
    onMutate: async (args) => {
      const previas = await instantaneaPlan(queryClient)
      queryClient.setQueriesData<PlanEntry[]>({ queryKey: ['plan'] }, (anteriores) => {
        if (!anteriores) return anteriores
        const entradaFrom = anteriores.find((e) => mismoExtremo(e, args.from))
        const entradaTo = anteriores.find((e) => mismoExtremo(e, args.to))
        const sinExtremos = anteriores.filter((e) => !mismoExtremo(e, args.from) && !mismoExtremo(e, args.to))
        const resultado = [...sinExtremos]
        if (entradaFrom) {
          resultado.push({ ...entradaFrom, fecha: args.to.fecha, turno: args.to.turno, orden: args.to.orden })
        }
        if (entradaTo) {
          resultado.push({ ...entradaTo, fecha: args.from.fecha, turno: args.from.turno, orden: args.from.orden })
        }
        return resultado
      })
      return { previas }
    },
    onError: (_err, _args, context) => {
      if (context) revertirPlan(queryClient, context.previas)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
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

// ---------- Lista de la compra ----------

async function fetchMarcasCompra(semana: string): Promise<MarcaCompra[]> {
  const raw = await sheetsClient.apiGet('compra', { semana })
  const envelope = compraEnvelopeSchema.parse(raw)
  const { valid } = parseRows(marcaCompraRowSchema, envelope.marcas)
  return valid.map(mapMarcaCompra)
}

export function useMarcasCompra(semana: string) {
  return useQuery({ queryKey: ['compra', semana], queryFn: () => fetchMarcasCompra(semana) })
}

interface MarcarCompraInput {
  semana: string
  idIngrediente: number
  unidad: string
  comprado: boolean
}

// mutationKey (además de la mutationFn) para que quien no dispara la mutación
// directamente —como el indicador de sincronización de ShoppingListPage—
// pueda saber si hay una marca en curso vía useIsMutating.
export function useMarcarCompra() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationKey: ['compra.marcar'],
    mutationFn: (args: MarcarCompraInput) =>
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
      const queryKey = ['compra', args.semana]
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
          { id: -Date.now(), semana: args.semana, idIngrediente: args.idIngrediente, unidad: args.unidad }
        ]
      })
      return { previas, queryKey }
    },
    onError: (_err, _args, context) => {
      if (context) queryClient.setQueryData(context.queryKey, context.previas)
    },
    onSettled: (_data, _err, args) => queryClient.invalidateQueries({ queryKey: ['compra', args.semana] })
  })
}

interface PlatoInput {
  id?: number
  nombre: string
  temporadas: Temporada[]
  etiquetas: string[]
  notas: string
  activo: boolean
}

export function usePlatoUpsert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (plato: PlatoInput) => {
      const resultado = await sheetsClient.apiPost('plato.upsert', {
        id_plato: plato.id,
        nombre: plato.nombre,
        temporada: plato.temporadas.join(','),
        etiquetas: plato.etiquetas.join(','),
        notas: plato.notas,
        activo: plato.activo
      })
      return resultado as { id_plato: number }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

export function usePlatoDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number }) => sheetsClient.apiPost('plato.delete', { id_plato: args.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

interface IngredienteInput {
  id?: number
  nombre: string
  proveedor: string
  unidadBase: string
  temporadas: Temporada[]
  kcal100?: number
  prot100?: number
  carb100?: number
  grasa100?: number
}

export function useIngredienteUpsert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ingrediente: IngredienteInput) => {
      const resultado = await sheetsClient.apiPost('ingrediente.upsert', {
        id_ingrediente: ingrediente.id,
        nombre: ingrediente.nombre,
        proveedor: ingrediente.proveedor,
        unidad_base: ingrediente.unidadBase,
        temporada: ingrediente.temporadas.join(','),
        kcal_100: ingrediente.kcal100,
        prot_100: ingrediente.prot100,
        carb_100: ingrediente.carb100,
        grasa_100: ingrediente.grasa100
      })
      return resultado as { id_ingrediente: number }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

export function useIngredienteDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number }) =>
      sheetsClient.apiPost('ingrediente.delete', { id_ingrediente: args.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

interface LineaIngredientePlatoInput {
  idIngrediente: number
  cantidad: number
  unidad: string
}

export function usePlatoIngredientesReplace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { idPlato: number; ingredientes: LineaIngredientePlatoInput[] }) =>
      sheetsClient.apiPost('platoIngredientes.replace', {
        id_plato: args.idPlato,
        ingredientes: args.ingredientes.map((linea) => ({
          id_ingrediente: linea.idIngrediente,
          cantidad: linea.cantidad,
          unidad: linea.unidad
        }))
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

interface ReglaInput {
  id?: number
  etiqueta: string
  tipo: TipoRegla
  valor: number
  activa: boolean
}

export function useReglaUpsert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (regla: ReglaInput) => {
      const resultado = await sheetsClient.apiPost('regla.upsert', {
        id: regla.id,
        etiqueta: regla.etiqueta,
        tipo: regla.tipo,
        valor: regla.valor,
        activa: regla.activa
      })
      return resultado as { id: number }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

export function useReglaDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number }) => sheetsClient.apiPost('regla.delete', { id: args.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

// ---------- Autenticación ----------

export interface Usuario {
  id: number
  nombre: string
}

interface UsuariosEnvelope {
  usuarios: { id_usuario: number; nombre: string }[]
}

async function fetchUsuarios(): Promise<Usuario[]> {
  const raw = (await sheetsClient.apiGet('auth.usuarios')) as UsuariosEnvelope
  return raw.usuarios.map((u) => ({ id: u.id_usuario, nombre: u.nombre }))
}

// Público (no exige sesión): alimenta el selector de nombre de la pantalla
// de login, por eso vive junto al resto de queries y no detrás de AuthGate.
export function useUsuarios() {
  return useQuery({ queryKey: ['usuarios'], queryFn: fetchUsuarios })
}

interface LoginInput {
  idUsuario: number
  pin: string
  dispositivo: string
}

interface LoginRespuesta {
  token: string
  usuario: { id_usuario: number; nombre: string }
  id_sesion: number
}

export function useLogin() {
  return useMutation({
    mutationFn: async (datos: LoginInput) => {
      const resultado = await sheetsClient.apiPost('auth.login', {
        id_usuario: datos.idUsuario,
        pin: datos.pin,
        dispositivo: datos.dispositivo
      })
      return resultado as LoginRespuesta
    },
    onSuccess: (resultado) => {
      guardarSesion({
        token: resultado.token,
        idUsuario: resultado.usuario.id_usuario,
        nombre: resultado.usuario.nombre
      })
    }
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => sheetsClient.apiPost('auth.logout'),
    // onSettled, no onSuccess: si la revocación en el servidor falla (p.ej.
    // sin conexión), igualmente queremos sacar a la persona de la app y
    // vaciar la caché — quedarse "atascado" logueado localmente sería peor
    // que un token que sigue activo en el servidor hasta que expire.
    onSettled: () => {
      borrarSesion()
      queryClient.clear()
    }
  })
}
