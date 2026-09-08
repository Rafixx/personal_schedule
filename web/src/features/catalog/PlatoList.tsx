import { useState } from 'react'
import type { Ingrediente, IngredientePlato, Plato } from '../../domain/types'
import { usePlatoDelete, usePlatoUpsert } from '../../data/queries'
import { PlatoForm } from './PlatoForm'

export interface PlatoListProps {
  platos: Plato[]
  ingredientesDisponibles: Ingrediente[]
  ingredientesPlato: IngredientePlato[]
}

export function PlatoList({ platos, ingredientesDisponibles, ingredientesPlato }: PlatoListProps) {
  const [editando, setEditando] = useState<Plato | 'nuevo' | null>(null)
  const platoDelete = usePlatoDelete()
  const platoUpsert = usePlatoUpsert()

  function alternarActivo(plato: Plato) {
    if (plato.activo) {
      platoDelete.mutate({ id: plato.id })
    } else {
      platoUpsert.mutate({
        id: plato.id,
        nombre: plato.nombre,
        temporadas: plato.temporadas,
        etiquetas: plato.etiquetas,
        notas: plato.notas,
        activo: true
      })
    }
  }

  if (editando) {
    const plato = editando === 'nuevo' ? undefined : editando
    return (
      <PlatoForm
        plato={plato}
        ingredientesDisponibles={ingredientesDisponibles}
        ingredientesPlato={plato ? ingredientesPlato.filter((ip) => ip.idPlato === plato.id) : []}
        onGuardado={() => setEditando(null)}
        onCancelar={() => setEditando(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setEditando('nuevo')}
        className="self-start rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900"
      >
        + Nuevo plato
      </button>
      <ul className="flex flex-col gap-2">
        {platos.map((plato) => (
          <li
            key={plato.id}
            className={`flex items-center justify-between gap-3 rounded-lg border-[1.5px] p-3 ${
              plato.activo
                ? 'border-neutral-200 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900'
                : 'border-neutral-200 bg-neutral-100 opacity-60 dark:border-neutral-700 dark:bg-neutral-800'
            }`}
          >
            <div>
              <p className="font-semibold">{plato.nombre}</p>
              <p className="text-sm text-neutral-500">{plato.activo ? 'Activo' : 'Inactivo'}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditando(plato)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => alternarActivo(plato)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                {plato.activo ? 'Desactivar' : 'Reactivar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
