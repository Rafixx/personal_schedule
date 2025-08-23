import { useEffect, useState } from 'react'
import { Toolbar } from '@/components/Toolbar'
import { PlannerView } from '@/components/PlannerView'
import { ISODate } from '@/domain/types'
import { toISO } from '@/utils/date'
import { usePlannerStore } from '@/store/plannerStore'

const mondayOf = (d: Date): Date => {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
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
