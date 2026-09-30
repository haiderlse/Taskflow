import { useScoreboard } from '../../api/review';
import { scoreLine } from '../../shared/exec/scoreboard';
import { LoadError } from '../LoadError';

/** Last week at a glance (spec C "Sunday planning" step 1): its numbers in one line. */
export function LastWeekGlance({ weekId }: { weekId: string }) {
  const board = useScoreboard(weekId);
  if (board.isError) return <LoadError what="last week's numbers" error={board.error} onRetry={() => void board.refetch()} />;
  if (!board.isSuccess) return <p className="text-sm text-ink-muted">Loading last week's numbers…</p>;
  return <p className="text-sm text-ink-muted">Last week: {scoreLine(board.data)}</p>;
}
