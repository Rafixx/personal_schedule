import { describe, it, expect } from 'vitest';
import { getWeekdaysOfMonth, isWeekday } from '../utils/dates';

describe('dates utils', () => {
  it('returns weekdays for September 2025', () => {
    const days = getWeekdaysOfMonth(2025, 9);
    expect(days[0]).toBe('2025-09-01');
    expect(days).not.toContain('2025-09-06');
  });

  it('validates weekday', () => {
    expect(isWeekday('2025-09-01')).toBe(true);
    expect(isWeekday('2025-09-06')).toBe(false);
  });
});
