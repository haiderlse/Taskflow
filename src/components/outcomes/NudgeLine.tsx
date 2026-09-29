import { NUDGE_MESSAGE } from '../../shared/exec/nudge';

/** One quiet line of coaching under a title (§9). It never blocks a save. */
export function NudgeLine({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="note" className="text-sm text-ink-muted">
      {NUDGE_MESSAGE}
    </p>
  );
}
