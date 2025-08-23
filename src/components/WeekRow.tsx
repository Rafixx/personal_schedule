// WeekRow.tsx
import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import { DayCell } from './DayCell'
import { usePlannerStore } from '@/store/plannerStore'
import { ISODate } from '@/domain/types'

interface Props {
  dates: ISODate[]
}

export const WeekRow = ({ dates }: Props) => {
  const moveEntry = usePlannerStore(s => s.moveEntry)

  const handleDragEnd = (e: DragEndEvent) => {
    const from = e.active.id as ISODate
    const to = e.over?.id as ISODate | undefined
    if (!to || from === to) return
    void moveEntry(from, to)
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <SortableContext items={dates} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-5 gap-4">
          {dates.map(date => (
            <DayCell key={date} date={date} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}
