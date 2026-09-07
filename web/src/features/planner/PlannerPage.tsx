import { useState } from 'react'
import { addWeeks } from 'date-fns'
import type { Orden } from '../../domain/types'
import { fechasSemana, formatearRangoSemana, hoyIso, lunesDe } from '../../shared/semanaDates'
import { useWeekPlan } from './useWeekPlan'
import { useMonthPlan } from './useMonthPlan'
import { Toolbar } from './Toolbar'
import type { VistaPlanner } from './Toolbar'
import { RulesStrip } from './RulesStrip'
import { WeekBoard } from './WeekBoard'
import { Recetario } from './Recetario'
import { PlatoPicker } from './PlatoPicker'
import { MonthView } from './MonthView'

const NOMBRE_HUECO: Record<Orden, string> = { 1: 'Primero', 2: 'Segundo' }

export function PlannerPage() {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [vista, setVista] = useState<VistaPlanner>('semana')
  const [picker, setPicker] = useState<{ fecha: string; orden: Orden } | null>(null)

  const semana = useWeekPlan(lunes)
  const mes = useMonthPlan(lunes)

  return (
    <div className="mx-auto max-w-[1560px] pb-7">
      <Toolbar
        rangoSemana={formatearRangoSemana(lunes)}
        vista={vista}
        guardando={semana.guardando}
        error={semana.error}
        onSemanaAnterior={() => setLunes((actual) => addWeeks(actual, -1))}
        onSemanaSiguiente={() => setLunes((actual) => addWeeks(actual, 1))}
        onCambiarVista={setVista}
      />

      {vista === 'semana' && <RulesStrip estados={semana.estadosRegla} />}

      {vista === 'semana' ? (
        <main className="grid grid-cols-1 gap-4 px-5 pt-3.5 lg:grid-cols-[1fr_300px]">
          <WeekBoard
            dias={semana.dias}
            hoyIso={hoyIso()}
            onAbrirPicker={(fecha, orden) => setPicker({ fecha, orden })}
            onQuitar={(fecha, orden) => semana.quitarPlato(fecha, orden)}
          />
          <Recetario platos={semana.platosActivos} />
        </main>
      ) : (
        <div className="px-5 pt-3.5">
          <MonthView
            dias={mes.dias}
            fechasSemanaActual={fechasSemana(lunes)}
            onSeleccionarDia={(fecha) => {
              setLunes(lunesDe(new Date(`${fecha}T00:00:00`)))
              setVista('semana')
            }}
          />
        </div>
      )}

      <PlatoPicker
        abierto={picker !== null}
        tituloHueco={picker ? NOMBRE_HUECO[picker.orden] : ''}
        platos={semana.platosActivos}
        onElegir={(idPlato) => {
          if (!picker) return
          semana.asignarPlato(picker.fecha, picker.orden, idPlato)
          setPicker(null)
        }}
        onCerrar={() => setPicker(null)}
      />
    </div>
  )
}
