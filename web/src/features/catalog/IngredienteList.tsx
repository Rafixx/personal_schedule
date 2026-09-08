import { useState } from 'react'
import type { Ingrediente } from '../../domain/types'
import { useIngredienteDelete } from '../../data/queries'
import { IngredienteForm } from './IngredienteForm'

export interface IngredienteListProps {
  ingredientes: Ingrediente[]
}

export function IngredienteList({ ingredientes }: IngredienteListProps) {
  const [editando, setEditando] = useState<Ingrediente | 'nuevo' | null>(null)
  const ingredienteDelete = useIngredienteDelete()

  function eliminar(ingrediente: Ingrediente) {
    if (!window.confirm(`¿Eliminar "${ingrediente.nombre}"? Esta acción no se puede deshacer.`)) return
    ingredienteDelete.mutate({ id: ingrediente.id })
  }

  if (editando) {
    return (
      <IngredienteForm
        ingrediente={editando === 'nuevo' ? undefined : editando}
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
        + Nuevo ingrediente
      </button>
      <ul className="flex flex-col gap-2">
        {ingredientes.map((ingrediente) => (
          <li
            key={ingrediente.id}
            className="flex items-center justify-between gap-3 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-900"
          >
            <div>
              <p className="font-semibold">{ingrediente.nombre}</p>
              <p className="text-sm text-neutral-500">
                {ingrediente.proveedor} · {ingrediente.unidadBase}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditando(ingrediente)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => eliminar(ingrediente)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
