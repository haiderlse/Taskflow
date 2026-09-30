import { useId, useState, type FormEvent } from 'react';
import type { Blocker } from '../../shared/exec/deepWorkSchemas';

type Props = { pending: boolean; submitLabel?: string; onSubmit: (blocker: Blocker) => void; onCancel: () => void };

const FIELD = 'w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink';

/** The three answers a Blocked exit asks for (spec C "Deep Work"): what blocks it, who owns the unblock, the next action. */
export function BlockerForm({ pending, submitLabel = 'File the next action and stop', onSubmit, onCancel }: Props) {
  const id = useId();
  const [what, setWhat] = useState('');
  const [owner, setOwner] = useState('');
  const [nextAction, setNextAction] = useState('');
  const blocker = { what: what.trim(), owner: owner.trim(), nextAction: nextAction.trim() };
  const complete = blocker.what !== '' && blocker.owner !== '' && blocker.nextAction !== '';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (complete && !pending) onSubmit(blocker);
  };
  return (
    <form aria-label="Blocked" onSubmit={submit} className="space-y-2 rounded-lg border border-line p-4 dark:border-ink-muted">
      <label htmlFor={`${id}-what`} className="block text-sm">What blocks it?</label>
      <input id={`${id}-what`} value={what} maxLength={500} onChange={(e) => setWhat(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-owner`} className="block text-sm">Who owns the unblock?</label>
      <input id={`${id}-owner`} value={owner} maxLength={120} onChange={(e) => setOwner(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-next`} className="block text-sm">What is the next action?</label>
      <input id={`${id}-next`} value={nextAction} maxLength={200} onChange={(e) => setNextAction(e.target.value)} className={FIELD} />
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!complete || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
          {submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
      </div>
    </form>
  );
}
