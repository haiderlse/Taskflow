import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { ScreenShell } from '../components/ScreenShell';
import { LoadError } from '../components/LoadError';
import { ScoreboardCard } from '../components/review/ScoreboardCard';
import { WeekHistory } from '../components/review/WeekHistory';
import { FridayReview } from '../components/review/FridayReview';
import { useWeekLookup } from '../api/weeks';
import { useScoreboard } from '../api/review';
import { useSettings } from '../api/settings';
import type { ApiError } from '../api/client';
import { useToday } from '../lib/useToday';
import { weekNumber, weekRangeLabel } from '../shared/exec/week';
import type { Scoreboard } from '../shared/exec/reviewSchemas';

const WAIT = 'text-ink-muted';

type SelectedProps = { board: UseQueryResult<Scoreboard, ApiError>; current: boolean; onBack: () => void };

/** The selected week's numbers, or why they are not there. */
function Board({ board }: { board: UseQueryResult<Scoreboard, ApiError> }) {
  if (board.isError) return <LoadError what="the scoreboard" error={board.error} onRetry={() => void board.refetch()} />;
  if (!board.isSuccess) return <p className={WAIT}>Loading the scoreboard…</p>;
  return (
    <div className="space-y-3">
      <h2 className="text-xl font-medium">Week {weekNumber(board.data.startDate)} · {weekRangeLabel(board.data.startDate)}</h2>
      <ScoreboardCard board={board.data} />
    </div>
  );
}

/** The selected week, with a way back when it is not the current week, whatever state its numbers are in. */
function SelectedWeek({ board, current, onBack }: SelectedProps) {
  return (
    <div className="space-y-3">
      {!current && <button type="button" onClick={onBack} className="text-sm underline">Back to this week</button>}
      <Board board={board} />
    </div>
  );
}

/** Review (spec C): what shipped, what slipped, and why. The selected week defaults to the current one. */
export default function Review() {
  const settings = useSettings();
  const { today, ready } = useToday();
  const lookup = useWeekLookup(today, { enabled: ready });
  const [picked, setPicked] = useState<string | null>(null);
  const currentId = lookup.data?.current?.week.id ?? null;
  const weekId = picked ?? currentId;
  const board = useScoreboard(weekId);
  return (
    <ScreenShell title="Review">
      {settings.isError && <LoadError what="the schedule" error={settings.error} onRetry={() => void settings.refetch()} />}
      {lookup.isError && <LoadError what="the week" error={lookup.error} onRetry={() => void lookup.refetch()} />}
      {!lookup.isSuccess && !lookup.isError && !settings.isError && <p className={WAIT}>Loading the week…</p>}
      {lookup.isSuccess && weekId === null && (
        <p>
          This week has no plan yet. <Link to="/plan" className="underline">Plan this week</Link>
        </p>
      )}
      {weekId !== null && <SelectedWeek board={board} current={weekId === currentId} onBack={() => setPicked(null)} />}
      {weekId !== null && <FridayReview weekId={weekId} today={today} />}
      <WeekHistory before={today} enabled={ready} selected={picked} onSelect={setPicked} />
    </ScreenShell>
  );
}
