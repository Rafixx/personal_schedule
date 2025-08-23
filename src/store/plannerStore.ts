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

    const nextDishesById = Object.fromEntries(dishes.map(d => [d.id, d]))
    const nextPlanByDate: Record<ISODate, string | null> = {}
    for (const date of dates) nextPlanByDate[date] = null
    for (const e of entries) nextPlanByDate[e.date as ISODate] = e.dishId

    // ✅ evita set si no cambia nada
    set(prev => {
      const sameDishes =
        Object.keys(prev.dishesById).length === Object.keys(nextDishesById).length &&
        Object.keys(prev.dishesById).every(k => prev.dishesById[k] === nextDishesById[k])
      const samePlan =
        Object.keys(prev.planByDate).length === Object.keys(nextPlanByDate).length &&
        Object.keys(prev.planByDate).every(
          k => prev.planByDate[k as ISODate] === nextPlanByDate[k as ISODate]
        )
      if (sameDishes && samePlan && prev.loading === false) return prev
      return { dishesById: nextDishesById, planByDate: nextPlanByDate, loading: false }
    })
  },

  async setEntry(date, dishId) {
    const current = get().planByDate[date] ?? null
    if (current === dishId) return // ✅ nada que hacer

    if (dishId) await upsertPlanEntry({ date, slot: 'comida', dishId })
    else await deletePlanEntry(date, 'comida')

    set(s => ({ planByDate: { ...s.planByDate, [date]: dishId } }))
  },

  async moveEntry(from, to) {
    if (from === to) return // ✅ sin cambios
    const { planByDate } = get()
    const fromDish = planByDate[from] ?? null
    const toDish = planByDate[to] ?? null

    // swap (o cambia a mover simple si prefieres)
    if (fromDish) await upsertPlanEntry({ date: to, slot: 'comida', dishId: fromDish })
    else await deletePlanEntry(to, 'comida')

    if (toDish) await upsertPlanEntry({ date: from, slot: 'comida', dishId: toDish })
    else await deletePlanEntry(from, 'comida')

    set(s => ({ planByDate: { ...s.planByDate, [from]: toDish, [to]: fromDish } }))
  },
  async seedDemo() {
    const dishes = await getDishes()
    if (dishes.length === 0) {
      await bulkSeed({ dishes: demoDishes, ingredients: demoIngredients })
    }
  }
}))
