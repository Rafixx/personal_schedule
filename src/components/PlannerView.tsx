// PlannerView.tsx
import { useEffect, useMemo } from 'react'
import { ISODate } from '@/domain/types'
import { weeksRange } from '@/utils/date'
import { usePlannerStore } from '@/store/plannerStore'
import { WeekRow } from './WeekRow'

interface Props {
  startMondayISO: ISODate
  weeks?: number
}

export const PlannerView = ({ startMondayISO, weeks = 4 }: Props) => {
  const dates = useMemo(() => weeksRange(startMondayISO, weeks), [startMondayISO, weeks])

  useEffect(() => {
    void usePlannerStore.getState().loadRange(dates)
  }, [dates])

  const weeksDates = useMemo(() => {
    const out: ISODate[][] = []
    for (let i = 0; i < dates.length; i += 5) out.push(dates.slice(i, i + 5))
    return out
  }, [dates])

  return (
    <div className="flex flex-col gap-4">
      {weeksDates.map(d => (
        <WeekRow key={d[0]} dates={d} />
      ))}
    </div>
  )
}
