import { DateTime } from 'luxon';
import { useMenuStore } from '../state/useMenuStore';

export default function Header() {
  const { currentMonth, setCurrentMonth } = useMenuStore((s) => ({
    currentMonth: s.currentMonth,
    setCurrentMonth: s.setCurrentMonth
  }));
  const dt = DateTime.fromObject(
    { year: currentMonth.year, month: currentMonth.month },
    { zone: 'Europe/Madrid' }
  );
  return (
    <header style={{ display: 'flex', gap: 8, padding: 8 }}>
      <button
        onClick={() =>
          setCurrentMonth({ year: dt.minus({ months: 1 }).year, month: dt.minus({ months: 1 }).month })
        }
      >
        «
      </button>
      <span style={{ flex: 1, textAlign: 'center' }}>{dt.toFormat('LLLL yyyy')}</span>
      <button
        onClick={() =>
          setCurrentMonth({ year: dt.plus({ months: 1 }).year, month: dt.plus({ months: 1 }).month })
        }
      >
        »
      </button>
      <button onClick={() => {
        const now = DateTime.now();
        setCurrentMonth({ year: now.year, month: now.month });
      }}>Hoy</button>
    </header>
  );
}
