import { useDroppable } from '@dnd-kit/core';
import DishCard from '../DishCard/DishCard';
import styles from './DayCell.module.css';

interface Props {
  date: string;
  dishes: string[];
}

export default function DayCell({ date, dishes }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  return (
    <div ref={setNodeRef} className={styles.cell} data-over={isOver ? '' : undefined}>
      <div className={styles.date}>{date.slice(-2)}</div>
      {dishes.map((id) => (
        <DishCard key={id} id={id} date={date} />
      ))}
    </div>
  );
}
