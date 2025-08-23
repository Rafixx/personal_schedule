import Dexie, { Table } from 'dexie'
import { Dish, Ingredient, PlanEntry } from '@/domain/types'

class MealDB extends Dexie {
  dishes!: Table<Dish, string>
  ingredients!: Table<Ingredient, string>
  planEntries!: Table<PlanEntry, [string, string]>

  constructor() {
    super('meal-planner')
    this.version(1).stores({
      dishes: 'id',
      ingredients: 'id',
      planEntries: '[date+slot], date, slot, dishId'
    })
  }
}

export const db = new MealDB()
