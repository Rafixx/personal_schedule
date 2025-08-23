import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
      <button className="text-left flex-1" onClick={() => setOpen(true)}>
        {dish ? dish.name : '— vacío —'}
      </button>
      {dish && (
        <button
          onClick={() => void setEntry(date, null)}
          aria-label="Eliminar"
          className="text-red-500 text-xs self-end"
        >
          Eliminar
        </button>
      )}
      {open && <DishPicker date={date} onClose={() => setOpen(false)} />}
    </div>
  )
}
