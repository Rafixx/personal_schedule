import { useState } from 'react'
import { ISODate } from '@/domain/types'
import { usePlannerStore } from '@/store/plannerStore'

interface Props {
  date: ISODate
  onClose: () => void
}

export const DishPicker = ({ date, onClose }: Props) => {
  const dishes = usePlannerStore(s => Object.values(s.dishesById))
  const setEntry = usePlannerStore(s => s.setEntry)
  const [filter, setFilter] = useState('')
  const filtered = dishes.filter(d => d.name.toLowerCase().includes(filter.toLowerCase()))

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-xl shadow w-80 max-h-[80vh] overflow-auto">
        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Buscar..."
          className="w-full border p-1 mb-2"
        />
        <ul className="flex flex-col gap-1">
          {filtered.map(d => (
            <li key={d.id}>
              <button
                className="w-full text-left hover:bg-gray-100 p-2 rounded"
                onClick={() => {
                  void setEntry(date, d.id)
                  onClose()
                }}
              >
                {d.name}
              </button>
            </li>
          ))}
        </ul>
        <button onClick={onClose} className="mt-2 text-sm text-gray-500">
          Cerrar
        </button>
      </div>
    </div>
  )
}
