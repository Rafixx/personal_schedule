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
  const loadRange = usePlannerStore(s => s.loadRange)
  const dates = useMemo(() => weeksRange(startMondayISO, weeks), [startMondayISO, weeks])

  useEffect(() => {
    void loadRange(dates)
  }, [dates, loadRange])

  const weeksDates: ISODate[][] = []
  for (let i = 0; i < dates.length; i += 5) {
    weeksDates.push(dates.slice(i, i + 5))
  }

  return (
    <div className="flex flex-col gap-4">
      {weeksDates.map((d, i) => (
        <WeekRow key={i} dates={d} />
      ))}
    </div>
  )
}
