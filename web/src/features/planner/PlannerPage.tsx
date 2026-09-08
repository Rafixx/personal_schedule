import { useState } from 'react'
import { addWeeks } from 'date-fns'
import type { Dispatch, SetStateAction } from 'react'
import type { Orden } from '../../domain/types'
import { fechasSemanaCompleta, formatearRangoSemana, hoyIso, lunesDe } from '../../shared/semanaDates'
import { AppBar } from '../../shared/AppBar'
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

export interface PlannerPageProps {
  lunes: Date
  setLunes: Dispatch<SetStateAction<Date>>
  vista: VistaPlanner
  setVista: Dispatch<SetStateAction<VistaPlanner>>
}

export function PlannerPage({ lunes, setLunes, vista, setVista }: PlannerPageProps) {
  const [picker, setPicker] = useState<{ fecha: string; orden: Orden } | null>(null)

  const semana = useWeekPlan(lunes)
  const mes = useMonthPlan(lunes)

  return (
    <div className="mx-auto max-w-[1560px] pb-7">
      <AppBar>
        <Toolbar
          rangoSemana={formatearRangoSemana(lunes)}
          vista={vista}
          guardando={semana.guardando}
          error={semana.error}
          onSemanaAnterior={() => setLunes((actual) => addWeeks(actual, -1))}
          onSemanaSiguiente={() => setLunes((actual) => addWeeks(actual, 1))}
          onCambiarVista={setVista}
        />
      </AppBar>

      {vista === 'semana' && <RulesStrip estados={semana.estadosRegla} />}

      {vista === 'semana' ? (
        semana.cargando ? (
          <p className="px-5 pt-3.5 text-center text-neutral-500">Cargando…</p>
        ) : (
          <main className="grid grid-cols-1 gap-4 px-5 pt-3.5 lg:grid-cols-[1fr_300px]">
            <WeekBoard
              dias={semana.dias}
              hoyIso={hoyIso()}
              onAbrirPicker={(fecha, orden) => setPicker({ fecha, orden })}
              onQuitar={(fecha, orden) => semana.quitarPlato(fecha, orden)}
            />
            <Recetario platos={semana.platosActivos} />
          </main>
        )
      ) : (
        <div className="px-5 pt-3.5">
          <MonthView
            dias={mes.dias}
            fechasSemanaActual={fechasSemanaCompleta(lunes)}
            onSeleccionarDia={(fecha) => {
              setLunes(lunesDe(new Date(`${fecha}T00:00:00`)))
              setVista('semana')
            }}
          />
        </div>
      )}

      <PlatoPicker
        key={picker ? `${picker.fecha}-${picker.orden}` : 'cerrado'}
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
