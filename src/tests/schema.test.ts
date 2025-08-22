import { describe, it, expect } from 'vitest';
import Ajv from 'ajv';
import schema from '../data/schema';
import menu from '../../public/data/menu.json';
import { isWeekday } from '../utils/dates';

const ajv = new Ajv();
const validate = ajv.compile(schema);

describe('menu schema', () => {
  it('matches schema', () => {
    const valid = validate(menu);
    expect(valid).toBe(true);
  });

  it('only weekdays in plan and known dishes', () => {
    const dishIds = new Set(menu.dishes.map((d) => d.id));
    menu.months.forEach((m) => {
      Object.entries(m.plan).forEach(([date, ids]) => {
        expect(isWeekday(date)).toBe(true);
        (ids as string[]).forEach((id) => {
          expect(dishIds.has(id)).toBe(true);
        });
      });
    });
  });
});
