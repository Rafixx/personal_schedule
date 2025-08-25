import { db } from './db'
import { Dish, Ingredient, PlanEntry, ISODate, Slot } from '@/domain/types'

export const getDishes = (): Promise<Dish[]> => db.dishes.toArray()

export const putDish = (d: Dish): Promise<void> => db.dishes.put(d).then(() => {})

export const getIngredients = (): Promise<Ingredient[]> => db.ingredients.toArray()

export const putIngredient = (i: Ingredient): Promise<void> => db.ingredients.put(i).then(() => {})

export const getPlanEntriesByDates = (dates: ISODate[]): Promise<PlanEntry[]> =>
  db.planEntries.where('date').anyOf(dates).toArray()

export const upsertPlanEntry = (entry: PlanEntry): Promise<void> =>
  db.planEntries.put(entry).then(() => {})

export const deletePlanEntry = (date: ISODate, slot: Slot): Promise<void> =>
  db.planEntries.delete([date, slot])

interface SeedSample {
  dishes: Dish[]
  ingredients: Ingredient[]
}

export const bulkSeed = async (sample: SeedSample): Promise<void> => {
  await db.transaction('rw', db.dishes, db.ingredients, db.planEntries, async () => {
    await db.dishes.bulkPut(sample.dishes)
    await db.ingredients.bulkPut(sample.ingredients)
  })
}
