import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { WeekSlots } from '../components/week/WeekSlots';
import { WeekTasks } from '../components/week/WeekTasks';
import { useWeekLookup } from '../api/weeks';
import { useToday } from '../lib/useToday';
import { weekNumber, weekRangeLabel } from '../shared/exec/week';
import { weekStartOf } from '../shared/exec/time';

/** Spec C "Week": the three outcomes, how far they are, and what is committed or waiting. */
export default function Week() {
  const { today, weekStartDay, ready } = useToday();
  const lookup = useWeekLookup(today, { enabled: ready });
  const view = lookup.data?.current ?? null;
  const startDate = view?.week.startDate ?? weekStartOf(today, weekStartDay);
  const planned = (view?.outcomes ?? []).some((outcome) => outcome.slot !== null);
  return (
    <ScreenShell title="Week">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-ink-muted">Week {weekNumber(startDate)} · {weekRangeLabel(startDate)}</p>
        {planned ? <span className="text-sm text-ink-muted">Planned</span> : <Link to="/plan" className="text-sm underline">Plan this week</Link>}
      </div>
      <WeekSlots view={view} today={today} weekStartDate={startDate} />
      <WeekTasks weekStartDate={startDate} outcomes={view?.outcomes ?? []} />
    </ScreenShell>
  );
}
