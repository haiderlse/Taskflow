import { useState, type FormEvent } from 'react';
import type { Outcome, ReviewReason } from '../../shared/exec/schemas';
import { ReasonSelect } from './ReasonSelect';

type Props = { outcomes: Outcome[]; pending?: boolean; onPick: (outcomeId: string, reason: ReviewReason) => void; onCancel: () => void };

/** A fourth outcome is never added, only swapped in (§4). */
export function ReplacePicker({ outcomes, pending = false, onPick, onCancel }: Props) {
  const [choice, setChoice] = useState(outcomes[0]?.id ?? '');
  const [reason, setReason] = useState<ReviewReason>('priority_changed');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (choice) onPick(choice, reason);
  };
  return (
    <form aria-label="Replace an outcome" onSubmit={submit} className="space-y-3 rounded-lg border border-line p-4 dark:border-ink-muted">
      <p>This week already has three outcomes. Which one gives up its slot?</p>
      <fieldset className="space-y-1">
        <legend className="sr-only">Outcome to replace</legend>
        {outcomes.map((outcome) => (
          <label key={outcome.id} className="flex items-center gap-2">
            <input type="radio" name="replace-outcome" value={outcome.id} checked={choice === outcome.id} onChange={() => setChoice(outcome.id)} />
            {outcome.title}
          </label>
        ))}
      </fieldset>
      <ReasonSelect label="Why does it give way?" value={reason} onChange={setReason} />
      <div className="flex gap-2">
        <button type="submit" disabled={!choice || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
          Replace
        </button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}
