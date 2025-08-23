export type ISODate = `${number}-${number}-${number}`

export interface Ingredient {
  id: string
  name: string
  unit?: string
}

export interface DishIngredient {
  ingredientId: string
  qty: number
}

export interface Dish {
  id: string
  name: string
  ingredients: DishIngredient[]
  notes?: string
}

export type Slot = 'comida'

export interface PlanEntry {
  date: ISODate
  slot: Slot
  dishId: string
}
