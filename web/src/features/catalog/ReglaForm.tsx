import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'
import type { Regla } from '../../domain/types'
import { useReglaUpsert } from '../../data/queries'
import { normalizarEtiqueta, reglaFormSchema, type ReglaFormValues } from './schemas'

export interface ReglaFormProps {
  regla?: Regla
  onGuardado: () => void
  onCancelar: () => void
}

const CAMPO =
  'w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900'

export function ReglaForm({ regla, onGuardado, onCancelar }: ReglaFormProps) {
  const reglaUpsert = useReglaUpsert()
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<z.input<typeof reglaFormSchema>, unknown, ReglaFormValues>({
    resolver: zodResolver(reglaFormSchema),
    defaultValues: regla
      ? { etiqueta: regla.etiqueta, tipo: regla.tipo, valor: regla.valor, activa: regla.activa }
      : { etiqueta: '', tipo: 'MAX_SEMANA', valor: 1, activa: true }
  })

  function onSubmit(valores: ReglaFormValues) {
    reglaUpsert.mutate(
      { id: regla?.id, ...valores, etiqueta: normalizarEtiqueta(valores.etiqueta) },
      { onSuccess: onGuardado }
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div>
        <label htmlFor="regla-etiqueta" className="mb-1 block text-sm font-semibold">
          Etiqueta
        </label>
        <input id="regla-etiqueta" {...register('etiqueta')} className={CAMPO} />
        {errors.etiqueta && <p className="mt-1 text-sm text-red-600">{errors.etiqueta.message}</p>}
      </div>
      <div>
        <label htmlFor="regla-tipo" className="mb-1 block text-sm font-semibold">
          Tipo
        </label>
        <select id="regla-tipo" {...register('tipo')} className={CAMPO}>
          <option value="MAX_SEMANA">Máximo por semana</option>
          <option value="MIN_SEMANA">Mínimo por semana</option>
          <option value="NO_CONSECUTIVO">No consecutivo</option>
        </select>
      </div>
      <div>
        <label htmlFor="regla-valor" className="mb-1 block text-sm font-semibold">
          Valor
        </label>
        <input id="regla-valor" type="number" {...register('valor')} className={CAMPO} />
        {errors.valor && <p className="mt-1 text-sm text-red-600">{errors.valor.message}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" {...register('activa')} className="h-5 w-5" />
        Activa
      </label>
      {reglaUpsert.isError && <p className="text-sm text-red-600">No se pudo guardar. Inténtalo de nuevo.</p>}
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
          disabled={reglaUpsert.isPending}
          className="rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {reglaUpsert.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
