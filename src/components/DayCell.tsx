import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, Minus } from 'lucide-react'
import { usePlannerStore } from '@/store/plannerStore'
import { ISODate } from '@/domain/types'
import { DishPicker } from './DishPicker'

interface Props {
  date: ISODate
}

export const DayCell = ({ date }: Props) => {
  const dish = usePlannerStore(state => {
    const id = state.planByDate[date]
    return id ? state.dishesById[id] : undefined
  })
  const setEntry = usePlannerStore(s => s.setEntry)
  const [open, setOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: date })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-4 bg-white rounded-xl shadow flex flex-col gap-2"
    >
      <div className="text-xs text-gray-500">{date}</div>

      {dish ? (
        <div className="relative flex-1">
          <button className="text-left w-full h-full" onClick={() => setOpen(true)}>
            {dish.name}
          </button>
          <button
            onClick={() => void setEntry(date, null)}
            aria-label="Eliminar"
            className="absolute bottom-0 right-0 text-red-500"
          >
            <Minus size={16} />
          </button>
        </div>
      ) : (
        <button
          className="flex-1 flex items-center justify-center text-3xl text-gray-400 hover:text-gray-600"
          onClick={() => setOpen(true)}
          aria-label="Asignar plato"
        >
          <Plus size={32} />
        </button>
      )}

      {open && <DishPicker date={date} onClose={() => setOpen(false)} />}
    </div>
  )
}
