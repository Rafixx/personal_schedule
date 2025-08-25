// DishesPage.tsx
import { useEffect, useMemo, useState, FormEvent } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { usePlannerStore } from '@/store/plannerStore'
import { getIngredients, putIngredient } from '@/data/repositories'
import { DishIngredient, Ingredient } from '@/domain/types'

export const DishesPage = () => {
  const dishesById = usePlannerStore(s => s.dishesById)
  const dishes = useMemo(() => Object.values(dishesById), [dishesById])
  const addDish = usePlannerStore(s => s.addDish)

  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [ingredientName, setIngredientName] = useState('')
  const [ingredientUnit, setIngredientUnit] = useState('')

  const [dishName, setDishName] = useState('')
  const [dishIngredients, setDishIngredients] = useState<DishIngredient[]>([])
  const [selectedIngredient, setSelectedIngredient] = useState('')
  const [qty, setQty] = useState('')

  useEffect(() => {
    void getIngredients().then(setIngredients)
    if (dishes.length === 0) {
      void usePlannerStore.getState().seedDemo()
    }
  }, [])

  const handleAddIngredient = async (e: FormEvent) => {
    e.preventDefault()
    if (!ingredientName.trim()) return
    const ing: Ingredient = {
      id: uuidv4(),
      name: ingredientName.trim(),
      unit: ingredientUnit || undefined
    }
    await putIngredient(ing)
    setIngredients(prev => [...prev, ing])
    setIngredientName('')
    setIngredientUnit('')
  }

  const handleAddDishIngredient = () => {
    if (!selectedIngredient || !qty) return
    setDishIngredients(prev => [...prev, { ingredientId: selectedIngredient, qty: Number(qty) }])
    setSelectedIngredient('')
    setQty('')
  }

  const handleAddDish = async (e: FormEvent) => {
    e.preventDefault()
    if (!dishName.trim()) return
    const dish = { id: uuidv4(), name: dishName.trim(), ingredients: dishIngredients }
    await addDish(dish)
    setDishName('')
    setDishIngredients([])
  }

  const nameOfIngredient = (id: string) => ingredients.find(i => i.id === id)?.name || id

  return (
    <div className="p-4 space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-2">Platos</h2>
        <form onSubmit={handleAddDish} className="mb-4 space-y-2">
          <input
            value={dishName}
            onChange={e => setDishName(e.target.value)}
            placeholder="Nombre del plato"
            className="border p-1 w-full"
          />
          <div className="flex items-center gap-2">
            <select
              value={selectedIngredient}
              onChange={e => setSelectedIngredient(e.target.value)}
              className="border p-1 flex-1"
            >
              <option value="">Ingrediente...</option>
              {ingredients.map(i => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="border p-1 w-24"
              placeholder="Cantidad"
            />
            <button
              type="button"
              onClick={handleAddDishIngredient}
              className="px-2 py-1 border rounded"
            >
              Añadir
            </button>
          </div>
          <ul className="list-disc pl-5">
            {dishIngredients.map(di => (
              <li key={di.ingredientId}>
                {nameOfIngredient(di.ingredientId)} – {di.qty}
              </li>
            ))}
          </ul>
          <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded">
            Guardar plato
          </button>
        </form>
        <ul className="list-disc pl-5">
          {dishes.map(d => (
            <li key={d.id}>{d.name}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-2">Ingredientes</h2>
        <form onSubmit={handleAddIngredient} className="mb-4 flex gap-2">
          <input
            value={ingredientName}
            onChange={e => setIngredientName(e.target.value)}
            placeholder="Nombre"
            className="border p-1 flex-1"
          />
          <input
            value={ingredientUnit}
            onChange={e => setIngredientUnit(e.target.value)}
            placeholder="Unidad"
            className="border p-1 w-24"
          />
          <button type="submit" className="px-3 py-1 bg-blue-500 text-white rounded">
            Añadir
          </button>
        </form>
        <ul className="list-disc pl-5">
          {ingredients.map(i => (
            <li key={i.id}>
              {i.name} {i.unit && `(${i.unit})`}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
