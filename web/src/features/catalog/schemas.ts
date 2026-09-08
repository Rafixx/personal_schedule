import { z } from 'zod'

export const reglaFormSchema = z.object({
  etiqueta: z.string().trim().min(1, 'La etiqueta es obligatoria'),
  tipo: z.enum(['MAX_SEMANA', 'MIN_SEMANA', 'NO_CONSECUTIVO']),
  valor: z.coerce.number().int().min(0, 'El valor no puede ser negativo'),
  activa: z.boolean()
})

export type ReglaFormValues = z.infer<typeof reglaFormSchema>

const numeroFormOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === null || valor === undefined) return undefined
  return valor
}, z.coerce.number().optional())

export const ingredienteFormSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  proveedor: z.string().trim().min(1, 'El proveedor es obligatorio'),
  unidadBase: z.string().trim().min(1, 'La unidad es obligatoria'),
  temporadas: z
    .array(z.enum(['TODAS', 'PRIMAVERA', 'VERANO', 'OTOÑO', 'INVIERNO']))
    .min(1, 'Elige al menos una temporada'),
  kcal100: numeroFormOpcional,
  prot100: numeroFormOpcional,
  carb100: numeroFormOpcional,
  grasa100: numeroFormOpcional
})

export type IngredienteFormValues = z.infer<typeof ingredienteFormSchema>
