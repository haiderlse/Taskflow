import { Link } from 'react-router-dom';
import { dayLabel } from '../../shared/exec/today';
import { weekNumber } from '../../shared/exec/week';
import { weekStartOf } from '../../shared/exec/time';
import type { WeekView } from '../../shared/exec/schemas';

type Props = { date: string; weekStartDay: number; week: WeekView | null };

/** Spec C "Today" item 1: the date, the week number and one line for the week, linking to it. */
export function TodayHeader({ date, weekStartDay, week }: Props) {
  const slotted = (week?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  const done = slotted.filter((outcome) => outcome.status === 'done').length;
  const startDate = week?.week.startDate ?? weekStartOf(date, weekStartDay);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-ink-muted">
      <p>{dayLabel(date)} · Week {weekNumber(startDate)}</p>
      <Link to="/week" className="text-sm underline">
        {slotted.length > 0 ? `${done} of ${slotted.length} outcomes done` : 'No outcomes yet'}
      </Link>
    </div>
  );
}
