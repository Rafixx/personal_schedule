import { useMenuStore } from '../../state/useMenuStore';
import { shoppingListForWeek } from '../../utils/shopping';
import { getWeekdaysOfMonth } from '../../utils/dates';
import styles from './ShoppingList.module.css';

export default function ShoppingList() {
  const { plan, dishes, currentMonth } = useMenuStore((s) => ({
    plan: s.plan,
    dishes: s.dishes,
    currentMonth: s.currentMonth
  }));
  const days = getWeekdaysOfMonth(currentMonth.year, currentMonth.month);
  const weeks: string[][] = [];
  for (let i = 0; i < days.length; i += 5) weeks.push(days.slice(i, i + 5));
  return (
    <section className={styles.list}>
      {weeks.map((week, i) => {
        const ingredients = shoppingListForWeek(plan, dishes, week);
        return (
          <div key={i}>
            <h3>Semana {i + 1}</h3>
            <ul>
              {ingredients.map((ing) => (
                <li key={ing}>{ing}</li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
