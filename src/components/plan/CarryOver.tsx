import { useRollOutcome } from '../../api/weeks';
import { useReportError } from '../../api/errors';
import type { Outcome } from '../../shared/exec/schemas';

type Props = { outcomes: Outcome[]; today: string; weekId?: string; onNext: () => void };

/** Step 1 (§4): last week's open outcomes. Carrying is a conscious choice; the rest stay where they were. */
export function CarryOver({ outcomes, today, weekId, onNext }: Props) {
  const roll = useRollOutcome();
  const report = useReportError();
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Last week</h2>
      <p className="text-ink-muted">These were still open. Carry the ones that still matter.</p>
      <ul className="space-y-2">
        {outcomes.map((outcome) => (
          <li key={outcome.id} className="flex items-center justify-between gap-3">
            <span>{outcome.title} · {outcome.progress}%</span>
            <button
              type="button"
              aria-label={`Carry "${outcome.title}" into this week`}
              disabled={roll.isPending}
              onClick={() => roll.mutate({ id: outcome.id, date: today, weekId }, { onError: report('carry the outcome') })}
              className="rounded border border-line px-2 py-1 text-sm dark:border-ink-muted"
            >
              Carry into this week
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onNext} className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">
        Next: choose this week's outcomes
      </button>
    </section>
  );
}
