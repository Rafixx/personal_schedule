import { useMenuStore } from '../../state/useMenuStore';
import DishCard from '../DishCard/DishCard';
import styles from './DishDrawer.module.css';

export default function DishDrawer() {
  const dishes = useMenuStore((s) => Object.values(s.dishes));
  return (
    <aside className={styles.drawer}>
      <h2>Platos</h2>
      {dishes.map((d) => (
        <DishCard key={d.id} id={d.id} date="" />
      ))}
    </aside>
  );
}
