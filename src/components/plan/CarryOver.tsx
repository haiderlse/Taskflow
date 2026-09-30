import { useRollOutcome } from '../../api/weeks';
import { useScoreboard } from '../../api/review';
import { useReportError } from '../../api/errors';
import { scoreLine } from '../../shared/exec/scoreboard';
import type { Outcome } from '../../shared/exec/schemas';
import { LoadError } from '../LoadError';

type Props = { outcomes: Outcome[]; today: string; weekId?: string; previousWeekId: string; reviewed: boolean; onNext: () => void };

/** Last week at a glance (spec C "Sunday planning" step 1): its numbers in one line. */
function LastWeekGlance({ weekId }: { weekId: string }) {
  const board = useScoreboard(weekId);
  if (board.isError) return <LoadError what="last week's numbers" error={board.error} onRetry={() => void board.refetch()} />;
  if (!board.isSuccess) return <p className="text-sm text-ink-muted">Loading last week's numbers…</p>;
  return <p className="text-sm text-ink-muted">Last week: {scoreLine(board.data)}</p>;
}

/** Step 1 (§4): last week's numbers, then its outcomes to carry. After a Friday review, only the ones it rolled forward. */
export function CarryOver({ outcomes, today, weekId, previousWeekId, reviewed, onNext }: Props) {
  const roll = useRollOutcome();
  const report = useReportError();
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Last week</h2>
      <LastWeekGlance weekId={previousWeekId} />
      <p className="text-ink-muted">
        {reviewed ? "Friday's review rolled these forward. Carry the ones that still matter." : 'These were still open. Carry the ones that still matter.'}
      </p>
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
