import { useDraggable } from '@dnd-kit/core';
import { useMenuStore } from '../../state/useMenuStore';
import styles from './DishCard.module.css';

interface Props {
  id: string;
  date: string;
}

export default function DishCard({ id, date }: Props) {
  const dish = useMenuStore((s) => s.dishes[id]);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: { date }
  });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined
  };
  return (
    <div ref={setNodeRef} className={styles.card} style={style} {...listeners} {...attributes}>
      {dish?.name || id}
    </div>
  );
}
