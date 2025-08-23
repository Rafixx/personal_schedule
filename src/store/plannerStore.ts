import { create } from 'zustand'
import { Dish, ISODate } from '@/domain/types'
import {
  getDishes,
  getPlanEntriesByDates,
  upsertPlanEntry,
  deletePlanEntry,
  bulkSeed
} from '@/data/repositories'
import { demoDishes, demoIngredients } from '@/data/demo'

interface PlannerState {
  dishesById: Record<string, Dish>
  planByDate: Record<ISODate, string | null>
  loading: boolean
  loadRange: (dates: ISODate[]) => Promise<void>
  setEntry: (date: ISODate, dishId: string | null) => Promise<void>
  moveEntry: (from: ISODate, to: ISODate) => Promise<void>
  seedDemo: () => Promise<void>
}

export const usePlannerStore = create<PlannerState>((set, get) => ({
  dishesById: {},
  planByDate: {},
  loading: false,
  async loadRange(dates) {
    set({ loading: true })
    const [dishes, entries] = await Promise.all([getDishes(), getPlanEntriesByDates(dates)])
    const dishesById = Object.fromEntries(dishes.map(d => [d.id, d]))
    const planByDate: Record<ISODate, string | null> = {}
    for (const date of dates) planByDate[date] = null
    for (const e of entries) planByDate[e.date] = e.dishId
    set({ dishesById, planByDate, loading: false })
  },
  async setEntry(date, dishId) {
    if (dishId) {
      await upsertPlanEntry({ date, slot: 'comida', dishId })
    } else {
      await deletePlanEntry(date, 'comida')
    }
    set(state => ({ planByDate: { ...state.planByDate, [date]: dishId } }))
  },
  async moveEntry(from, to) {
    const { planByDate } = get()
    const fromDish = planByDate[from] ?? null
    const toDish = planByDate[to] ?? null
    if (from === to) return
    if (fromDish) {
      await upsertPlanEntry({ date: to, slot: 'comida', dishId: fromDish })
    } else {
      await deletePlanEntry(to, 'comida')
    }
    if (toDish) {
      await upsertPlanEntry({ date: from, slot: 'comida', dishId: toDish })
    } else {
      await deletePlanEntry(from, 'comida')
    }
    set(state => ({ planByDate: { ...state.planByDate, [from]: toDish, [to]: fromDish } }))
  },
  async seedDemo() {
    const dishes = await getDishes()
    if (dishes.length === 0) {
      await bulkSeed({ dishes: demoDishes, ingredients: demoIngredients })
    }
  }
}))
