import type { AsignacionSemana } from '../../domain/reglas'
import { DishTile } from './DishTile'

export interface SlotProps {
  asignacion: AsignacionSemana
  etiquetaHueco: string
  onAbrirPicker: () => void
  onQuitar: () => void
}

export function Slot({ asignacion, etiquetaHueco, onAbrirPicker, onQuitar }: SlotProps) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="pl-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-neutral-400">{etiquetaHueco}</span>
      <div className="flex flex-1">
        {asignacion.plato ? (
          <DishTile plato={asignacion.plato} fecha={asignacion.fecha} onQuitar={onQuitar} />
        ) : (
          <button
            type="button"
            onClick={onAbrirPicker}
            className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-300 text-sm font-semibold text-neutral-400 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 dark:border-neutral-600 dark:hover:bg-amber-950"
          >
            <span className="text-xl font-normal leading-none">+</span>
            <span>Añadir</span>
          </button>
        )}
      </div>
    </div>
  )
}
