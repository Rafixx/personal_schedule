import { useEffect, useMemo } from 'react'
import { usePlannerStore } from '@/store/plannerStore'
import { weeksRange, toISO } from '@/utils/date'
import { computeShoppingList } from '@/domain/shopping'
import { ISODate } from '@/domain/types'

const mondayOf = (d: Date): Date => {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.setDate(diff))
}

export const ShoppingListPage = () => {
  const planByDate = usePlannerStore(s => s.planByDate)
  const dishesById = usePlannerStore(s => s.dishesById)
  const start: ISODate = toISO(mondayOf(new Date()))
  const dates = weeksRange(start, 4)

  useEffect(() => {
    void usePlannerStore.getState().loadRange(dates)
  }, [dates])

  const list = useMemo(
    () => computeShoppingList(planByDate, dishesById, dates),
    [planByDate, dishesById, dates]
  )

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold mb-2">Lista de la compra</h2>
      <table className="table-auto text-sm">
        <tbody>
          {list.map(item => (
            <tr key={item.ingredientId}>
              <td className="px-2 py-1 border">{item.ingredientId}</td>
              <td className="px-2 py-1 border text-right">{item.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
