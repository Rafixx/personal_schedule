import { DndContext, DragEndEvent } from '@dnd-kit/core';
import { useMenuStore } from '../../state/useMenuStore';
import DayCell from '../DayCell/DayCell';
import { getWeekdaysOfMonth } from '../../utils/dates';
import { useAppSensors } from '../../utils/dnd';
import styles from './MonthGrid.module.css';

export default function MonthGrid() {
  const { plan, currentMonth, rules, setPlan, removeDishFromDate } = useMenuStore(
    (s) => ({
      plan: s.plan,
      currentMonth: s.currentMonth,
      rules: s.rules,
      setPlan: s.setPlan,
      removeDishFromDate: s.removeDishFromDate
    })
  );
  const days = getWeekdaysOfMonth(currentMonth.year, currentMonth.month);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 5) weeks.push(days.slice(i, i + 5));
  const sensors = useAppSensors();

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.data.current) {
      const from = active.data.current.date as string;
      const dishId = active.id as string;
      if (from) removeDishFromDate(from, dishId);
      const current = plan[over.id as string] || [];
      if (rules.maxPerDay === 1) {
        setPlan(over.id as string, [dishId]);
      } else {
        setPlan(over.id as string, [...current, dishId]);
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className={styles.grid}>
        {weeks.map((week, i) => (
          <div key={i} className={styles.row}>
            {week.map((date) => (
              <DayCell key={date} date={date} dishes={plan[date] || []} />
            ))}
          </div>
        ))}
      </div>
    </DndContext>
  );
}
