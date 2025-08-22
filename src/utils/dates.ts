import { DateTime } from 'luxon';

export const WEEKDAYS = [1, 2, 3, 4, 5];

export function getWeekdaysOfMonth(year: number, month: number): string[] {
  const dt = DateTime.fromObject({ year, month, zone: 'Europe/Madrid' }).startOf('month');
  const days: string[] = [];
  let cursor = dt;
  while (cursor.month === month) {
    if (WEEKDAYS.includes(cursor.weekday)) {
      days.push(cursor.toISODate()!);
    }
    cursor = cursor.plus({ days: 1 });
  }
  return days;
}

export function isWeekday(isoDate: string): boolean {
  const dt = DateTime.fromISO(isoDate, { zone: 'Europe/Madrid' });
  return WEEKDAYS.includes(dt.weekday);
}
