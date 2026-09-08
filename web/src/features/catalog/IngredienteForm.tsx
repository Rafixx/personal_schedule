import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import type { Ingrediente, Temporada } from '../../domain/types'
import { useIngredienteUpsert } from '../../data/queries'
import { ingredienteFormSchema, type IngredienteFormValues } from './schemas'

export interface IngredienteFormProps {
  ingrediente?: Ingrediente
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

export function IngredienteForm({ ingrediente, onGuardado, onCancelar }: IngredienteFormProps) {
  const ingredienteUpsert = useIngredienteUpsert()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<z.input<typeof ingredienteFormSchema>, unknown, IngredienteFormValues>({
    resolver: zodResolver(ingredienteFormSchema),
    defaultValues: ingrediente
      ? {
          nombre: ingrediente.nombre,
          proveedor: ingrediente.proveedor,
          unidadBase: ingrediente.unidadBase,
          temporadas: ingrediente.temporadas,
          kcal100: ingrediente.kcal100,
          prot100: ingrediente.prot100,
          carb100: ingrediente.carb100,
          grasa100: ingrediente.grasa100
        }
      : { nombre: '', proveedor: '', unidadBase: '', temporadas: ['TODAS'] }
  })

  function onSubmit(valores: IngredienteFormValues) {
    ingredienteUpsert.mutate({ id: ingrediente?.id, ...valores }, { onSuccess: onGuardado })
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div>
        <label htmlFor="ingrediente-nombre" className="mb-1 block text-sm font-semibold">
          Nombre
        </label>
        <input id="ingrediente-nombre" {...register('nombre')} className={CAMPO} />
        {errors.nombre && <p className="mt-1 text-sm text-red-600">{errors.nombre.message}</p>}
      </div>
      <div>
        <label htmlFor="ingrediente-proveedor" className="mb-1 block text-sm font-semibold">
          Proveedor
        </label>
        <input id="ingrediente-proveedor" {...register('proveedor')} className={CAMPO} />
        {errors.proveedor && <p className="mt-1 text-sm text-red-600">{errors.proveedor.message}</p>}
      </div>
      <div>
        <label htmlFor="ingrediente-unidad" className="mb-1 block text-sm font-semibold">
          Unidad base
        </label>
        <input id="ingrediente-unidad" {...register('unidadBase')} className={CAMPO} placeholder="g, ml, ud…" />
        {errors.unidadBase && <p className="mt-1 text-sm text-red-600">{errors.unidadBase.message}</p>}
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="ingrediente-kcal" className="mb-1 block text-sm font-semibold">
            Kcal / 100g
          </label>
          <input id="ingrediente-kcal" type="number" {...register('kcal100')} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="ingrediente-prot" className="mb-1 block text-sm font-semibold">
            Proteína / 100g
          </label>
          <input id="ingrediente-prot" type="number" {...register('prot100')} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="ingrediente-carb" className="mb-1 block text-sm font-semibold">
            Carbohidrato / 100g
          </label>
          <input id="ingrediente-carb" type="number" {...register('carb100')} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="ingrediente-grasa" className="mb-1 block text-sm font-semibold">
            Grasa / 100g
          </label>
          <input id="ingrediente-grasa" type="number" {...register('grasa100')} className={CAMPO} />
        </div>
      </div>
      {ingredienteUpsert.isError && <p className="text-sm text-red-600">No se pudo guardar. Inténtalo de nuevo.</p>}
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
          disabled={ingredienteUpsert.isPending}
          className="rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {ingredienteUpsert.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
