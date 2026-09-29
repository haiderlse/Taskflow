import { dayLabel } from '../../shared/exec/today';
import type { MustShip } from '../../shared/exec/todaySchemas';

type Props = { date: string; mustShip: MustShip | null };

/** After the shutdown: tomorrow's Must Ship and "Tomorrow is ready" (spec C, §12). */
export function TomorrowCard({ date, mustShip }: Props) {
  return (
    <section aria-label="Tomorrow" className="space-y-2 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <h2 className="text-2xl font-semibold">Tomorrow is ready</h2>
      <p>{mustShip ? `${dayLabel(date)}: ${mustShip.title}` : `No Must Ship for ${dayLabel(date)} yet`}</p>
    </section>
  );
}
