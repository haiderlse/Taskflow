import { useWeekHistory } from '../../api/review';
import { scoreLine } from '../../shared/exec/scoreboard';
import { weekNumber, weekRangeLabel } from '../../shared/exec/week';
import { LoadError } from '../LoadError';

type Props = { before: string; enabled: boolean; selected: string | null; onSelect: (weekId: string) => void };

const ROW = 'w-full rounded-lg border border-line px-4 py-3 text-left hover:border-ink aria-pressed:border-ink dark:border-ink-muted';

/** Spec C "Review" item 2: earlier weeks as rows; choosing one shows its scoreboard. */
export function WeekHistory({ before, enabled, selected, onSelect }: Props) {
  const history = useWeekHistory(before, { enabled });
  return (
    <section aria-label="Earlier weeks" className="space-y-2">
      <h2 className="text-xl font-medium">Earlier weeks</h2>
      {history.isError && <LoadError what="earlier weeks" error={history.error} onRetry={() => void history.refetch()} />}
      {history.isPending && <p className="text-ink-muted">Loading earlier weeks…</p>}
      {history.isSuccess && history.data.length === 0 && <p className="text-ink-muted">No earlier weeks yet.</p>}
      {history.isSuccess && history.data.length > 0 && (
        <ul className="space-y-2">
          {history.data.map((board) => (
            <li key={board.weekId}>
              <button type="button" aria-pressed={selected === board.weekId} onClick={() => onSelect(board.weekId)} className={ROW}>
                <span className="block font-medium">Week {weekNumber(board.startDate)} · {weekRangeLabel(board.startDate)}</span>
                <span className="block text-sm text-ink-muted">
                  {scoreLine(board)} · {board.rolledForward} rolled · {board.killed} killed · {board.delegated} delegated
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
