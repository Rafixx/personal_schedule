import type { Plato } from '../../domain/types'
import { colorVarDePlato } from '../../shared/tagColors'

export interface DishChipProps {
  plato: Plato
}

export function DishChip({ plato }: DishChipProps) {
  const etiqueta = plato.etiquetas[0]
  const colorVar = colorVarDePlato(plato)
  const fueraDeTodas = !plato.temporadas.includes('TODAS') && plato.temporadas.length > 0

  return (
    <div
      style={{ borderLeft: `6px solid ${colorVar}` }}
      className="flex min-h-12 items-center gap-2.5 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-900"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{plato.nombre}</span>
        {etiqueta && (
          <span className="text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: colorVar }}>
            {etiqueta}
          </span>
        )}
      </div>
      {fueraDeTodas && (
        <span className="ml-auto text-sm opacity-70" title={`Temporada: ${plato.temporadas.join(', ')}`}>
          🌿
        </span>
      )}
    </div>
  )
}
