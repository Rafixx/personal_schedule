import { useState } from 'react'
import type { Plato } from '../../domain/types'
import { DishChip } from './DishChip'

export interface RecetarioProps {
  platos: Plato[]
}

export function Recetario({ platos }: RecetarioProps) {
  const [busqueda, setBusqueda] = useState('')
  const filtrados = platos.filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))

  return (
    <aside className="sticky top-3.5 flex max-h-[calc(100vh-200px)] flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <div>
        <h2 className="mb-2.5 text-base font-semibold">Recetario</h2>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar plato…"
          className="w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900"
        />
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto pr-0.5">
        {filtrados.length === 0 && <p className="py-3.5 text-center text-sm text-neutral-400">Ningún plato coincide</p>}
        {filtrados.map((plato) => (
          <DishChip key={plato.id} plato={plato} />
        ))}
      </div>
    </aside>
  )
}
