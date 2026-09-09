import type { Plato } from '../../domain/types'
import { estaEnTemporada, temporadaDe } from '../../domain/temporadas'
import { colorVarDePlato } from '../../shared/tagColors'

export interface DishTileProps {
  plato: Plato
  fecha: string
  onQuitar: () => void
}

export function DishTile({ plato, fecha, onQuitar }: DishTileProps) {
  const etiqueta = plato.etiquetas[0]
  const colorVar = colorVarDePlato(plato)
  const fueraDeTemporada = !estaEnTemporada(plato.temporadas, fecha)

  return (
    <div
      className="relative flex min-h-12 flex-1 flex-col justify-center gap-1 rounded-xl border-[1.5px] border-neutral-200 bg-white p-2.5 pl-3 dark:border-neutral-700 dark:bg-neutral-800"
      style={{ borderLeft: `6px solid ${colorVar}` }}
    >
      {etiqueta && (
        <span className="text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: colorVar }}>
          {etiqueta}
        </span>
      )}
      <span className="font-semibold leading-tight">{plato.nombre}</span>
      {fueraDeTemporada && (
        <span className="mt-auto flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          🌿 Fuera de temporada ({temporadaDe(fecha).toLowerCase()})
        </span>
      )}
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${plato.nombre}`}
        className="absolute right-2 top-2 grid h-6.5 w-6.5 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600"
      >
        ×
      </button>
    </div>
  )
}
