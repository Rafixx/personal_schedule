import { useState } from 'react'
import type { Regla, TipoRegla } from '../../domain/types'
import { useReglaDelete } from '../../data/queries'
import { ReglaForm } from './ReglaForm'

export interface ReglaListProps {
  reglas: Regla[]
}

const NOMBRE_TIPO: Record<TipoRegla, string> = {
  MAX_SEMANA: 'Máximo por semana',
  MIN_SEMANA: 'Mínimo por semana',
  NO_CONSECUTIVO: 'No consecutivo'
}

export function ReglaList({ reglas }: ReglaListProps) {
  const [editando, setEditando] = useState<Regla | 'nueva' | null>(null)
  const reglaDelete = useReglaDelete()

  function eliminar(regla: Regla) {
    if (!window.confirm(`¿Eliminar la regla "${regla.etiqueta}"? Esta acción no se puede deshacer.`)) return
    reglaDelete.mutate({ id: regla.id })
  }

  if (editando) {
    return (
      <ReglaForm
        regla={editando === 'nueva' ? undefined : editando}
        onGuardado={() => setEditando(null)}
        onCancelar={() => setEditando(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setEditando('nueva')}
        className="self-start rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900"
      >
        + Nueva regla
      </button>
      <ul className="flex flex-col gap-2">
        {reglas.map((regla) => (
          <li
            key={regla.id}
            className="flex items-center justify-between gap-3 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-900"
          >
            <div>
              <p className="font-semibold">{regla.etiqueta}</p>
              <p className="text-sm text-neutral-500">
                {NOMBRE_TIPO[regla.tipo]} · {regla.valor} · {regla.activa ? 'Activa' : 'Inactiva'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditando(regla)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => eliminar(regla)}
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
