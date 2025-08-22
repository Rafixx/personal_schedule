import type { Dish, Plan } from '../state/useMenuStore';

export function shoppingListForWeek(
  plan: Plan,
  dishes: Record<string, Dish>,
  weekDates: string[]
): string[] {
  const items = new Set<string>();
  weekDates.forEach((date) => {
    (plan[date] || []).forEach((id) => {
      (dishes[id]?.ingredients || []).forEach((ing) => items.add(ing));
    });
  });
  return Array.from(items).sort((a, b) => a.localeCompare(b));
}
