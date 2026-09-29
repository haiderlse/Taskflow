import { useNow } from '../../lib/useNow';
import { countdownLabel, elapsed } from '../../shared/exec/deepWork';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';

/** The large countdown, derived from the block's timestamps each second; quiet past zero, frozen while paused. */
export function FocusTimer({ block }: { block: DeepWorkBlock }) {
  const now = useNow(1000);
  const { remaining, paused } = elapsed(block, now);
  return (
    <div className="space-y-1 text-center">
      <p role="timer" aria-label="Time remaining" className={`text-7xl font-semibold tabular-nums ${remaining < 0 ? 'text-ink-muted' : ''}`}>
        {countdownLabel(remaining)}
      </p>
      <p className="h-5 text-sm text-ink-muted">{paused ? 'Paused' : ''}</p>
    </div>
  );
}
