import { z } from 'zod'

const booleanFlexible = z.preprocess((valor) => {
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'string') {
    const texto = valor.trim().toLowerCase()
    return texto !== '' && texto !== 'false'
  }
  return Boolean(valor)
}, z.boolean())

const numeroOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === null || valor === undefined) return undefined
  return valor
}, z.coerce.number().optional())

const textoFlexible = z.preprocess((valor) => {
  if (valor === null || valor === undefined) return ''
  if (typeof valor === 'string') return valor
  return String(valor)
}, z.string())

export const platoRowSchema = z.object({
  id_plato: z.coerce.number().int(),
  nombre: textoFlexible.pipe(z.string().min(1)),
  temporada: textoFlexible,
  etiquetas: textoFlexible,
  notas: textoFlexible,
  activo: booleanFlexible
})

export const ingredienteRowSchema = z.object({
  id_ingrediente: z.coerce.number().int(),
  nombre: textoFlexible.pipe(z.string().min(1)),
  proveedor: textoFlexible,
  unidad_base: textoFlexible,
  temporada: textoFlexible,
  kcal_100: numeroOpcional,
  prot_100: numeroOpcional,
  carb_100: numeroOpcional,
  grasa_100: numeroOpcional
})

export const ingredientePlatoRowSchema = z.object({
  id: z.coerce.number().int(),
  id_plato: z.coerce.number().int(),
  id_ingrediente: z.coerce.number().int(),
  cantidad: z.coerce.number().positive(),
  unidad: textoFlexible.pipe(z.string().min(1))
})

export const planEntryRowSchema = z.object({
  id: z.coerce.number().int(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turno: textoFlexible.pipe(z.string().min(1)),
  id_plato: z.coerce.number().int(),
  notas: textoFlexible
})

export const reglaRowSchema = z.object({
  id: z.coerce.number().int(),
  etiqueta: textoFlexible.pipe(z.string().min(1)),
  tipo: z.enum(['MAX_SEMANA', 'MIN_SEMANA', 'NO_CONSECUTIVO']),
  valor: z.coerce.number(),
  activa: booleanFlexible
})

export const proveedorRowSchema = z.object({
  nombre: textoFlexible.pipe(z.string().min(1)),
  orden: z.coerce.number()
})

export const bootstrapEnvelopeSchema = z.object({
  ok: z.literal(true),
  platos: z.array(z.unknown()),
  ingredientes: z.array(z.unknown()),
  ingredientesPlatos: z.array(z.unknown()),
  reglas: z.array(z.unknown()),
  proveedores: z.array(z.unknown())
})

export const planEnvelopeSchema = z.object({
  ok: z.literal(true),
  entries: z.array(z.unknown())
})

export interface FilaInvalida {
  row: unknown
  error: string
}

export function parseRows<T>(
  schema: z.ZodType<T>,
  rows: unknown[]
): { valid: T[]; invalid: FilaInvalida[] } {
  const valid: T[] = []
  const invalid: FilaInvalida[] = []
  for (const row of rows) {
    const resultado = schema.safeParse(row)
    if (resultado.success) {
      valid.push(resultado.data)
    } else {
      invalid.push({ row, error: resultado.error.message })
    }
  }
  return { valid, invalid }
}
