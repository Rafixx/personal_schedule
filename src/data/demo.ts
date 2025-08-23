import { Dish, Ingredient } from '@/domain/types'

export const demoIngredients: Ingredient[] = [
  { id: 'pollo', name: 'Pechuga de pollo', unit: 'g' },
  { id: 'lechuga', name: 'Lechuga', unit: 'u' },
  { id: 'tomate', name: 'Tomate', unit: 'u' },
  { id: 'arroz', name: 'Arroz', unit: 'g' }
]

export const demoDishes: Dish[] = [
  {
    id: 'pollo-ensalada',
    name: 'Pollo + ensalada',
    ingredients: [
      { ingredientId: 'pollo', qty: 300 },
      { ingredientId: 'lechuga', qty: 1 },
      { ingredientId: 'tomate', qty: 2 }
    ]
  },
  {
    id: 'arroz-verduras',
    name: 'Arroz con verduras',
    ingredients: [
      { ingredientId: 'arroz', qty: 200 },
      { ingredientId: 'tomate', qty: 1 }
    ]
  }
]
