import { useState } from 'react'
import { ISODate } from '@/domain/types'
import { weeksRange } from '@/utils/date'
import { computeShoppingList } from '@/domain/shopping'
import { usePlannerStore } from '@/store/plannerStore'
import { db } from '@/data/db'
import { bulkSeed } from '@/data/repositories'

interface Props {
  startMondayISO: ISODate
  weeks: number
  onPrev: () => void
  onNext: () => void
}

export const Toolbar = ({ startMondayISO, weeks, onPrev, onNext }: Props) => {
  const planByDate = usePlannerStore(s => s.planByDate)
  const dishesById = usePlannerStore(s => s.dishesById)
  const [showList, setShowList] = useState(false)

  const range = weeksRange(startMondayISO, weeks)
  const shopping = computeShoppingList(planByDate, dishesById, range)

  const handleExport = async () => {
    const [dishes, ingredients, planEntries] = await Promise.all([
      db.dishes.toArray(),
      db.ingredients.toArray(),
      db.planEntries.toArray()
    ])
    const data = {
      version: 1,
      exportedAtISO: new Date().toISOString().slice(0, 10),
      dishes,
      ingredients,
      planEntries
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'meal-planner-backup.json'
    a.click()
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    const json = JSON.parse(text)
    if (json.version !== 1) return
    await bulkSeed({ dishes: json.dishes, ingredients: json.ingredients })
    await db.planEntries.bulkPut(json.planEntries)
    window.location.reload()
  }

  return (
    <div className="flex gap-2 mb-4">
      <button onClick={onPrev} className="px-2 py-1 border rounded">
        Semana anterior
      </button>
      <button onClick={onNext} className="px-2 py-1 border rounded">
        Siguiente semana
      </button>
      <button onClick={handleExport} className="px-2 py-1 border rounded">
        Exportar
      </button>
      <label className="px-2 py-1 border rounded cursor-pointer">
        Importar
        <input type="file" className="hidden" onChange={handleImport} />
      </label>
      <button onClick={() => setShowList(true)} className="px-2 py-1 border rounded">
        Lista de la compra
      </button>
      {showList && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-xl shadow max-h-[80vh] overflow-auto">
            <h2 className="font-semibold mb-2">Lista de la compra</h2>
            <table className="table-auto text-sm">
              <tbody>
                {shopping.map(item => (
                  <tr key={item.ingredientId}>
                    <td className="px-2 py-1 border">{item.ingredientId}</td>
                    <td className="px-2 py-1 border text-right">{item.qty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={() => setShowList(false)} className="mt-2 text-sm text-gray-500">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
