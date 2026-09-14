import type { DiaSemana } from '../../domain/semana'
import type { Orden } from '../../domain/types'
import { DIAS_SEMANA } from '../../shared/semanaDates'
import { DayCell } from './DayCell'

export interface WeekBoardProps {
  dias: DiaSemana[]
  hoyIso: string
  onAbrirPicker: (fecha: string, orden: Orden) => void
  onQuitar: (fecha: string, orden: Orden) => void
}

export function WeekBoard({ dias, hoyIso, onAbrirPicker, onQuitar }: WeekBoardProps) {
  return (
    <section
      aria-label="Días de la semana"
      className="grid grid-cols-2 gap-4 min-[480px]:flex min-[480px]:snap-x min-[480px]:snap-mandatory min-[480px]:gap-3 min-[480px]:overflow-x-auto min-[480px]:pb-2"
    >
      {dias.map((dia, i) => (
        <div key={dia.fecha} className="min-[480px]:min-w-[160px] min-[480px]:flex-1 min-[480px]:shrink-0 min-[480px]:snap-start">
          <DayCell
            dia={dia}
            nombreDia={DIAS_SEMANA[i]}
            numeroDia={Number(dia.fecha.slice(8, 10))}
            esHoy={dia.fecha === hoyIso}
            onAbrirPicker={(orden) => onAbrirPicker(dia.fecha, orden)}
            onQuitar={(orden) => onQuitar(dia.fecha, orden)}
          />
        </div>
      ))}
    </section>
  )
}
