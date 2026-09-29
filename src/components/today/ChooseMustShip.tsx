import type { Outcome } from '../../shared/exec/schemas';
import { MustShipPicker } from '../mustShip/MustShipPicker';

type Props = { date: string; outcomes: Outcome[] };

/** No work Must Ship yet: pick a candidate or write one (spec C "Today is time-aware"). */
export function ChooseMustShip({ date, outcomes }: Props) {
  return (
    <section aria-label="Choose today's Must Ship" className="space-y-3 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <h2 className="text-2xl font-semibold">Choose today's Must Ship</h2>
      <p className="text-ink-muted">One output that must exist by the end of today.</p>
      <MustShipPicker date={date} context="work" outcomes={outcomes} />
    </section>
  );
}
