import type { WeekView } from '../../shared/exec/schemas';
import { WeekDeepWork } from '../week/WeekDeepWork';

type Props = { view: WeekView | null; today: string; weekStartDate: string; onDone: () => void };

/** Step 3 (spec C "Sunday planning"): "if it has no time it is an aspiration". Outcomes without a block are flagged, not blocked. */
export function PlanTime({ view, today, weekStartDate, onDone }: Props) {
  return (
    <section aria-label="Deep work time" className="space-y-3">
      <h2 className="text-xl font-medium">When will you actually work on these?</h2>
      <p className="text-ink-muted">Click a block to give it an outcome. An outcome with no time is an aspiration.</p>
      <WeekDeepWork weekStartDate={weekStartDate} today={today} outcomes={view?.outcomes ?? []} flagMissing />
      <button type="button" onClick={onDone} className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">
        Done planning time
      </button>
    </section>
  );
}
