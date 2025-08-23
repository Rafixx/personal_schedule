import { useEffect, useState } from 'react'
import { Toolbar } from '@/components/Toolbar'
import { PlannerView } from '@/components/PlannerView'
import { ISODate } from '@/domain/types'
import { toISO } from '@/utils/date'
import { usePlannerStore } from '@/store/plannerStore'

const mondayOf = (d: Date): Date => {
  const copy = new Date(d) // <- no mutar d
  const day = copy.getDay()
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1)
  copy.setDate(diff)
  return copy
}

const shiftISO = (iso: ISODate, days: number): ISODate => {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

export const PlannerPage = () => {
  const [startMondayISO, setStartMondayISO] = useState<ISODate>(() => toISO(mondayOf(new Date())))
  const weeks = 4

  useEffect(() => {
    // establece lunes de esta semana una sola vez
    const today = new Date()
    const day = today.getDay()
    const diff = today.getDate() - day + (day === 0 ? -6 : 1) // lunes
    const monday = new Date(today)
    monday.setDate(diff)
    setStartMondayISO(toISO(monday))

    // si siembras demo, hazlo una sola vez
    void usePlannerStore.getState().seedDemo()
  }, [])

  return (
    <div>
      <Toolbar
        startMondayISO={startMondayISO}
        weeks={weeks}
        onPrev={() => setStartMondayISO(s => shiftISO(s, -7))}
        onNext={() => setStartMondayISO(s => shiftISO(s, 7))}
      />
      <PlannerView startMondayISO={startMondayISO} weeks={weeks} />
    </div>
  )
}
