import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUpdateMustShip } from '../../api/mustShips';
import { useReportError } from '../../api/errors';
import { MUST_SHIP_STATUS_LABELS } from '../../lib/labels';
import { hhmmToMinutes } from '../../shared/exec/time';
import type { Outcome, Settings } from '../../shared/exec/schemas';
import type { MustShip, MustShipPatch } from '../../shared/exec/todaySchemas';
import { MustShipForm } from '../mustShip/MustShipForm';

type Props = { mustShip: MustShip; outcome: Outcome | null; outcomes: Outcome[]; settings: Settings; mode: 'start' | 'grade' };

const BUTTON = 'rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink dark:border-ink-muted dark:hover:text-paper';

/** "08:35–10:05" from the settings' start and length. */
function windowLabel(start: string, minutes: number): string {
  const end = hhmmToMinutes(start) + minutes;
  return `${start}–${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/** Spec C "Today" item 2: title large, definition in one line, the outcome it serves, the window, the primary action. */
export function MustShipCard({ mustShip, outcome, outcomes, settings, mode }: Props) {
  const update = useUpdateMustShip();
  const report = useReportError();
  const [editing, setEditing] = useState(false);
  const planned = mustShip.status === 'planned';
  const save = (patch: MustShipPatch, onSuccess?: () => void) => update.mutate({ id: mustShip.id, patch }, { onSuccess, onError: report('update the Must Ship') });

  if (editing) {
    return (
      <div className="rounded-lg border border-line p-4 dark:border-ink-muted">
        <MustShipForm outcomes={outcomes} initial={mustShip} submitLabel="Save Must Ship" pending={update.isPending} onCancel={() => setEditing(false)} onSubmit={(fields) => save(fields, () => setEditing(false))} />
      </div>
    );
  }
  return (
    <section aria-label="Must Ship" className="space-y-2 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <p className="text-xs uppercase tracking-wide text-ink-muted">
        Must Ship{!planned && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-paper dark:bg-paper dark:text-ink">{MUST_SHIP_STATUS_LABELS[mustShip.status]}</span>}
      </p>
      <h2 className="text-2xl font-semibold">{mustShip.title}</h2>
      {mustShip.definitionOfDone && <p className="truncate text-ink-muted">{mustShip.definitionOfDone}</p>}
      {outcome && <p className="text-sm">For: {outcome.title}</p>}
      <p className="text-sm text-ink-muted">Deep work {windowLabel(settings.deepWorkStart, settings.deepWorkMinutes)}</p>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {planned && mode === 'start' && (
          <Link to="/focus" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Start deep work</Link>
        )}
        {planned && mode === 'grade' && (
          <>
            <button type="button" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink" onClick={() => save({ status: 'shipped' })}>Mark shipped</button>
            <Link to="/focus" className="rounded border border-line px-3 py-1.5 dark:border-ink-muted">Start another session</Link>
          </>
        )}
        {planned && <button type="button" className={BUTTON} onClick={() => setEditing(true)}>Edit</button>}
        {planned && <button type="button" className={BUTTON} onClick={() => save({ date: null })}>Put back</button>}
      </div>
    </section>
  );
}
