import { ISODate } from '@/domain/types'

export const toISO = (d: Date): ISODate => d.toISOString().slice(0, 10) as ISODate

export function weeksRange(startMondayISO: ISODate, weeks: number): ISODate[] {
  const start = new Date(startMondayISO)
  const dates: ISODate[] = []
  for (let w = 0; w < weeks; w++) {
    for (let i = 0; i < 5; i++) {
      const day = new Date(start)
      day.setDate(start.getDate() + w * 7 + i)
      dates.push(toISO(day))
    }
  }
  return dates
}
