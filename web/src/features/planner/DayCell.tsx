import type { DiaSemana } from '../../domain/semana'
import type { Orden } from '../../domain/types'
import { Slot } from './Slot'

const NOMBRE_HUECO: Record<Orden, string> = { 1: 'Primero', 2: 'Segundo' }

export interface DayCellProps {
  dia: DiaSemana
  nombreDia: string
  numeroDia: number
  esHoy: boolean
  onAbrirPicker: (orden: Orden) => void
  onQuitar: (orden: Orden) => void
}

export function DayCell({ dia, nombreDia, numeroDia, esHoy, onAbrirPicker, onQuitar }: DayCellProps) {
  return (
    <div
      data-today={esHoy}
      className="flex min-h-[328px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div className={`border-b border-neutral-200 px-3.5 pb-2.5 pt-3 dark:border-neutral-700 ${esHoy ? 'bg-amber-50 dark:bg-amber-950' : ''}`}>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{nombreDia}</div>
        <div className="text-2xl font-bold tabular-nums">{numeroDia}</div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {dia.huecos.map((asignacion) => (
          <Slot
            key={asignacion.orden}
            asignacion={asignacion}
            etiquetaHueco={NOMBRE_HUECO[asignacion.orden]}
            onAbrirPicker={() => onAbrirPicker(asignacion.orden)}
            onQuitar={() => onQuitar(asignacion.orden)}
          />
        ))}
      </div>
    </div>
  )
}
