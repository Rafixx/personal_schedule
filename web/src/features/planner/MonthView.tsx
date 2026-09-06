import type { DiaMes } from './useMonthPlan'
import { colorVarDeEtiqueta } from '../../shared/tagColors'

const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export interface MonthViewProps {
  dias: DiaMes[]
  fechasSemanaActual: string[]
  onSeleccionarDia: (fecha: string) => void
}

export function MonthView({ dias, fechasSemanaActual, onSeleccionarDia }: MonthViewProps) {
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 shadow-sm dark:border-neutral-700 dark:bg-neutral-700">
      {DIAS_CORTOS.map((d) => (
        <div key={d} className="bg-neutral-50 py-2 text-center text-xs font-bold uppercase text-neutral-400 dark:bg-neutral-900">
          {d}
        </div>
      ))}
      {dias.map((dia) => {
        const enSemanaActual = fechasSemanaActual.includes(dia.fecha)
        return (
          <button
            type="button"
            key={dia.fecha}
            onClick={() => onSeleccionarDia(dia.fecha)}
            data-other-month={dia.esOtroMes}
            data-current-week={enSemanaActual}
            className={`relative min-h-[76px] p-2 text-left ${dia.esOtroMes ? 'bg-neutral-50 dark:bg-neutral-900' : 'bg-white dark:bg-neutral-800'} ${enSemanaActual ? 'ring-2 ring-inset ring-amber-500' : ''}`}
          >
            <span className={`text-sm font-bold tabular-nums ${dia.esOtroMes ? 'text-neutral-400' : ''}`}>{Number(dia.fecha.slice(8, 10))}</span>
            {dia.platos.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {dia.platos.map((plato, i) => (
                  <span
                    key={i}
                    data-testid="dia-punto"
                    className="h-1.75 w-1.75 rounded-full"
                    style={{ backgroundColor: colorVarDeEtiqueta(plato.etiquetas[0] ?? '') }}
                  />
                ))}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
