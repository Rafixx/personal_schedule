import { useEffect } from 'react'
import { usePlannerStore } from '@/store/plannerStore'

export const DishesPage = () => {
  const dishes = usePlannerStore(s => Object.values(s.dishesById))
  useEffect(() => {
    void usePlannerStore.getState().loadRange([])
  }, [])

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
