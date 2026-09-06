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
    <section aria-label="Días de la semana" className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      {dias.map((dia, i) => (
        <DayCell
          key={dia.fecha}
          dia={dia}
          nombreDia={DIAS_SEMANA[i]}
          numeroDia={Number(dia.fecha.slice(8, 10))}
          esHoy={dia.fecha === hoyIso}
          onAbrirPicker={(orden) => onAbrirPicker(dia.fecha, orden)}
          onQuitar={(orden) => onQuitar(dia.fecha, orden)}
        />
      ))}
    </section>
  )
}
