import { z } from 'zod'

export const reglaFormSchema = z.object({
  etiqueta: z.string().trim().min(1, 'La etiqueta es obligatoria'),
  tipo: z.enum(['MAX_SEMANA', 'MIN_SEMANA', 'NO_CONSECUTIVO']),
  valor: z.coerce.number().int().min(0, 'El valor no puede ser negativo'),
  activa: z.boolean()
})

export type ReglaFormValues = z.infer<typeof reglaFormSchema>
