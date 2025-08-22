import { DateTime } from 'luxon';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export interface Dish {
  id: string;
  name: string;
  tags: string[];
  time: number;
  ingredients: string[];
}

export type Plan = Record<string, string[]>;

export interface MenuData {
  version: number;
  metadata: { updatedAt: string; tz: string };
  dishes: Dish[];
  months: { year: number; month: number; plan: Plan }[];
  rules: { weekdaysOnly: boolean; maxPerDay: number };
}

interface MenuState {
  dishes: Record<string, Dish>;
  plan: Plan;
  rules: { weekdaysOnly: boolean; maxPerDay: number };
  currentMonth: { year: number; month: number };
  setMenu: (data: MenuData) => void;
  setPlan: (date: string, dishIds: string[]) => void;
  addDish: (dish: Dish) => void;
  removeDishFromDate: (date: string, dishId: string) => void;
  clearMonth: (year: number, month: number) => void;
  duplicateWeek: (weekIndex: number) => void;
  importLocalPlan: (json: { dishes: Dish[]; plan: Plan }) => void;
  exportLocalPlan: () => string;
  setCurrentMonth: (v: { year: number; month: number }) => void;
}

export const useMenuStore = create<MenuState>()(
  immer((set, get) => ({
    dishes: {},
    plan: {},
    rules: { weekdaysOnly: true, maxPerDay: 1 },
    currentMonth: { year: DateTime.now().year, month: DateTime.now().month },
    setMenu: (data) =>
      set((s) => {
        s.dishes = Object.fromEntries(data.dishes.map((d) => [d.id, d]));
        const all: Plan = {};
        data.months.forEach((m) => Object.assign(all, m.plan));
        s.plan = all;
        s.rules = data.rules;
      }),
    setPlan: (date, dishIds) =>
      set((s) => {
        s.plan[date] = dishIds;
      }),
    addDish: (dish) =>
      set((s) => {
        s.dishes[dish.id] = dish;
      }),
    removeDishFromDate: (date, dishId) =>
      set((s) => {
        s.plan[date] = (s.plan[date] || []).filter((id) => id !== dishId);
      }),
    clearMonth: (year, month) =>
      set((s) => {
        Object.keys(s.plan).forEach((d) => {
          const dt = DateTime.fromISO(d, { zone: 'Europe/Madrid' });
          if (dt.year === year && dt.month === month) delete s.plan[d];
        });
      }),
    duplicateWeek: (weekIndex) =>
      set((s) => {
        const dates = Object.keys(s.plan).sort();
        const weeks: string[][] = [];
        let current = -1;
        dates.forEach((date) => {
          const dt = DateTime.fromISO(date, { zone: 'Europe/Madrid' });
          const w = dt.weekNumber;
          if (w !== current) {
            current = w;
            weeks.push([]);
          }
          weeks[weeks.length - 1].push(date);
        });
        const src = weeks[weekIndex];
        if (!src) return;
        src.forEach((d) => {
          const next = DateTime.fromISO(d, { zone: 'Europe/Madrid' }).plus({
            weeks: 1
          });
          s.plan[next.toISODate()!] = [...(s.plan[d] || [])];
        });
      }),
    importLocalPlan: (json) =>
      set((s) => {
        s.dishes = Object.fromEntries(json.dishes.map((d) => [d.id, d]));
        s.plan = json.plan;
      }),
    exportLocalPlan: () =>
      JSON.stringify({
        dishes: Object.values(get().dishes),
        plan: get().plan
      }),
    setCurrentMonth: (v) =>
      set((s) => {
        s.currentMonth = v;
      })
  }))
);
