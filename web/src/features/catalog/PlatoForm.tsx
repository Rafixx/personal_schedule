import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Ingrediente, IngredientePlato, Plato, Temporada } from '../../domain/types'
import { usePlatoIngredientesReplace, usePlatoUpsert } from '../../data/queries'
import { platoFormSchema, type PlatoFormValues } from './schemas'
import { PlatoIngredientesEditor, type LineaEditor } from './PlatoIngredientesEditor'

export interface PlatoFormProps {
  plato?: Plato
  ingredientesDisponibles: Ingrediente[]
  ingredientesPlato: IngredientePlato[]
  onGuardado: () => void
  onCancelar: () => void
}

const CAMPO =
  'w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900'

const TEMPORADAS: Temporada[] = ['TODAS', 'PRIMAVERA', 'VERANO', 'OTOÑO', 'INVIERNO']
const NOMBRE_TEMPORADA: Record<Temporada, string> = {
  TODAS: 'Todas',
  PRIMAVERA: 'Primavera',
  VERANO: 'Verano',
  OTOÑO: 'Otoño',
  INVIERNO: 'Invierno'
}

function etiquetasATexto(etiquetas: string[]): string {
  return etiquetas.join(', ')
}

function textoAEtiquetas(texto: string): string[] {
  return texto
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
}

export function PlatoForm({
  plato,
  ingredientesDisponibles,
  ingredientesPlato,
  onGuardado,
  onCancelar
}: PlatoFormProps) {
  const platoUpsert = usePlatoUpsert()
  const platoIngredientesReplace = usePlatoIngredientesReplace()
  const [lineas, setLineas] = useState<LineaEditor[]>(
    ingredientesPlato.map((ip) => ({ idIngrediente: ip.idIngrediente, cantidad: ip.cantidad, unidad: ip.unidad }))
  )
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<PlatoFormValues>({
    resolver: zodResolver(platoFormSchema),
    defaultValues: plato
      ? {
          nombre: plato.nombre,
          temporadas: plato.temporadas,
          etiquetas: etiquetasATexto(plato.etiquetas),
          notas: plato.notas,
          activo: plato.activo
        }
      : { nombre: '', temporadas: ['TODAS'], etiquetas: '', notas: '', activo: true }
  })

  function onSubmit(valores: PlatoFormValues) {
    platoUpsert.mutate(
      {
        id: plato?.id,
        nombre: valores.nombre,
        temporadas: valores.temporadas,
        etiquetas: textoAEtiquetas(valores.etiquetas),
        notas: valores.notas,
        activo: valores.activo
      },
      {
        onSuccess: (resultado) => {
          const idPlato = plato?.id ?? resultado.id_plato
          platoIngredientesReplace.mutate({ idPlato, ingredientes: lineas }, { onSuccess: onGuardado })
        }
      }
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div>
        <label htmlFor="plato-nombre" className="mb-1 block text-sm font-semibold">
          Nombre
        </label>
        <input id="plato-nombre" {...register('nombre')} className={CAMPO} />
        {errors.nombre && <p className="mt-1 text-sm text-red-600">{errors.nombre.message}</p>}
      </div>
      <div>
        <span className="mb-1 block text-sm font-semibold">Temporadas</span>
        <Controller
          name="temporadas"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-3">
              {TEMPORADAS.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={field.value.includes(t)}
                    onChange={(e) => {
                      field.onChange(
                        e.target.checked ? [...field.value, t] : field.value.filter((v) => v !== t)
                      )
                    }}
                  />
                  {NOMBRE_TEMPORADA[t]}
                </label>
              ))}
            </div>
          )}
        />
        {errors.temporadas && <p className="mt-1 text-sm text-red-600">{errors.temporadas.message}</p>}
      </div>
      <div>
        <label htmlFor="plato-etiquetas" className="mb-1 block text-sm font-semibold">
          Etiquetas (separadas por comas)
        </label>
        <input id="plato-etiquetas" {...register('etiquetas')} className={CAMPO} placeholder="pasta, carne…" />
      </div>
      <div>
        <label htmlFor="plato-notas" className="mb-1 block text-sm font-semibold">
          Notas
        </label>
        <textarea id="plato-notas" {...register('notas')} rows={2} className={CAMPO} />
      </div>
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={lineas}
        onCambiar={setLineas}
      />
      {(platoUpsert.isError || platoIngredientesReplace.isError) && (
        <p className="text-sm text-red-600">No se pudo guardar. Inténtalo de nuevo.</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full px-4.5 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={platoUpsert.isPending || platoIngredientesReplace.isPending}
          className="rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {platoUpsert.isPending || platoIngredientesReplace.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
