import { Dish, ISODate } from './types'

export interface ShoppingItem {
  ingredientId: string
  qty: number
}

export function computeShoppingList(
  planByDate: Record<ISODate, string | null>,
  dishesById: Record<string, Dish>,
  rangeISO: ISODate[]
): ShoppingItem[] {
  const totals: Record<string, number> = {}
  for (const date of rangeISO) {
    const dishId = planByDate[date]
    if (!dishId) continue
    const dish = dishesById[dishId]
    if (!dish) continue
    for (const { ingredientId, qty } of dish.ingredients) {
      totals[ingredientId] = (totals[ingredientId] || 0) + qty
    }
  }
  return Object.entries(totals).map(([ingredientId, qty]) => ({ ingredientId, qty }))
}
