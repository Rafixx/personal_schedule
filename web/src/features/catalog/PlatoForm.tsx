import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Ingrediente, IngredientePlato, Plato, Temporada } from '../../domain/types'
import { usePlatoIngredientesReplace, usePlatoUpsert } from '../../data/queries'
import { normalizarEtiqueta, platoFormSchema, type PlatoFormValues } from './schemas'
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
    .map((t) => normalizarEtiqueta(t))
    .filter((t) => t.length > 0)
}

function lineasIguales(a: LineaEditor[], b: LineaEditor[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
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
  const [lineasIniciales] = useState<LineaEditor[]>(
    ingredientesPlato.map((ip) => ({ idIngrediente: ip.idIngrediente, cantidad: ip.cantidad, unidad: ip.unidad }))
  )
  const [lineas, setLineas] = useState<LineaEditor[]>(lineasIniciales)
  const [idCreado, setIdCreado] = useState<number | undefined>(undefined)
  const [errorLineas, setErrorLineas] = useState<string | null>(null)
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

  async function onSubmit(valores: PlatoFormValues) {
    const lineaInvalida = lineas.some((l) => l.cantidad <= 0 || l.unidad.trim().length === 0)
    if (lineaInvalida) {
      setErrorLineas('Revisa los ingredientes: la cantidad debe ser mayor que 0 y la unidad no puede estar vacía.')
      return
    }
    setErrorLineas(null)

    const idExistente = plato?.id ?? idCreado
    try {
      const resultado = await platoUpsert.mutateAsync({
        id: idExistente,
        nombre: valores.nombre,
        temporadas: valores.temporadas,
        etiquetas: textoAEtiquetas(valores.etiquetas),
        notas: valores.notas,
        activo: valores.activo
      })
      const idPlato = idExistente ?? resultado.id_plato
      if (!idExistente) setIdCreado(idPlato)

      if (!lineasIguales(lineas, lineasIniciales)) {
        await platoIngredientesReplace.mutateAsync({ idPlato, ingredientes: lineas })
      }
      onGuardado()
    } catch {
      // el error ya se refleja vía platoUpsert.isError / platoIngredientesReplace.isError
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
    >
      <fieldset disabled={platoUpsert.isPending || platoIngredientesReplace.isPending} className="contents">
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
      </fieldset>
      {errorLineas && <p className="text-sm text-red-600">{errorLineas}</p>}
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
