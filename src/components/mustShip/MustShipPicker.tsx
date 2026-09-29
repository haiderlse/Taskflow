import { useCreateMustShip, useMustShips, useUpdateMustShip } from '../../api/mustShips';
import { useReportError } from '../../api/errors';
import type { Context, Outcome } from '../../shared/exec/schemas';
import { MustShipForm } from './MustShipForm';

type Props = { date: string; context: Context; outcomes: Outcome[]; onDone?: () => void };

/** Pick a candidate (§17) or write one; either way it becomes the Must Ship for `date`. */
export function MustShipPicker({ date, context, outcomes, onDone }: Props) {
  const candidates = useMustShips({ date: 'none', context, status: ['planned'] });
  const create = useCreateMustShip();
  const update = useUpdateMustShip();
  const report = useReportError();
  const settle = { onSuccess: () => onDone?.(), onError: report('set the Must Ship') };
  const list = candidates.data ?? [];
  return (
    <div className="space-y-4">
      {list.length > 0 && (
        <ul aria-label="Candidates" className="space-y-1">
          {list.map((candidate) => (
            <li key={candidate.id} className="flex items-center justify-between gap-3 border-t border-line py-2 dark:border-ink-muted">
              <span>{candidate.title}</span>
              <button
                type="button"
                aria-label={`Use "${candidate.title}"`}
                disabled={update.isPending}
                onClick={() => update.mutate({ id: candidate.id, patch: { date } }, settle)}
                className="rounded border border-line px-2 py-1 text-sm dark:border-ink-muted"
              >
                Use this
              </button>
            </li>
          ))}
        </ul>
      )}
      <MustShipForm outcomes={outcomes} submitLabel="Set Must Ship" pending={create.isPending} onSubmit={(fields) => create.mutate({ ...fields, context, date }, settle)} />
    </div>
  );
}
