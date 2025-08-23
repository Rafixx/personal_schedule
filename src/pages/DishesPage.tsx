// DishesPage.tsx
import { useEffect, useMemo } from 'react'
import { usePlannerStore } from '@/store/plannerStore'

export const DishesPage = () => {
  // ✅ lee el objeto del store; no crees arrays en el selector
  const dishesById = usePlannerStore(s => s.dishesById)
  const dishes = useMemo(() => Object.values(dishesById), [dishesById])

  // ✅ si quieres seed de demo, hazlo una sola vez (sin loadRange)
  useEffect(() => {
    if (dishes.length === 0) {
      void usePlannerStore.getState().seedDemo()
    }
  }, []) // deps vacías → una sola vez

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Platos</h2>
      <ul className="list-disc pl-5">
        {dishes.map(d => (
          <li key={d.id}>{d.name}</li>
        ))}
      </ul>
    </div>
  )
}
