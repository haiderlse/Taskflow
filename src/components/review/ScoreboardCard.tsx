import { MUST_SHIP_STATUS_LABELS } from '../../lib/labels';
import { deepWorkLabel } from '../../shared/exec/scoreboard';
import type { Scoreboard } from '../../shared/exec/reviewSchemas';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const shortDay = (date: string): string => SHORT_DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** Spec C "Review" item 1: the week's numbers, and the strip of its work days' Must Ships. */
export function ScoreboardCard({ board }: { board: Scoreboard }) {
  const numbers: [string, string][] = [
    ['Outcomes shipped', `${board.outcomes.shipped} of ${board.outcomes.total}`],
    ['Must Ships shipped', `${board.mustShips.shipped} of ${board.mustShips.total}`],
    ['Deep work', deepWorkLabel(board.deepWorkMinutes)],
    ['Rolled forward', String(board.rolledForward)],
    ['Killed', String(board.killed)],
    ['Delegated', String(board.delegated)],
  ];
  return (
    <section aria-label="Scoreboard" className="space-y-4 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {numbers.map(([term, value]) => (
          <div key={term}>
            <dt className="text-sm text-ink-muted">{term}</dt>
            <dd className="text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <ol aria-label="Day strip" className="flex flex-wrap gap-2">
        {board.strip.map((day) => (
          <li key={day.date} className="rounded border border-line px-2 py-1 text-sm dark:border-ink-muted">
            {shortDay(day.date)} · {day.status ? MUST_SHIP_STATUS_LABELS[day.status] : 'None'}
          </li>
        ))}
      </ol>
    </section>
  );
}
