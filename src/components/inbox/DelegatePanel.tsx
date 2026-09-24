import { useState, type FormEvent } from 'react';
import type { Task } from '../../shared/exec/schemas';

export type DelegateFields = { ownerName: string; expectedOutput: string | null; followUpDate: string };
type Props = { task: Task; defaultFollowUp: string; onSubmit: (fields: DelegateFields) => void; onCancel: () => void };

/** Owner, expected output, follow-up date (§11). Owner is the one required field. */
export function DelegatePanel({ task, defaultFollowUp, onSubmit, onCancel }: Props) {
  const [ownerName, setOwnerName] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUp);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const owner = ownerName.trim();
    if (!owner) {
      setError('Owner is required');
      return;
    }
    if (!followUpDate) {
      setError('Follow-up date is required');
      return;
    }
    onSubmit({ ownerName: owner, expectedOutput: expectedOutput.trim() || null, followUpDate });
  };

  return (
    <form aria-label={`Delegate ${task.title}`} onSubmit={submit} className="space-y-3 rounded-md border border-line p-4 dark:border-ink-muted">
      <label className="block text-sm" htmlFor="delegate-owner">Owner</label>
      <input id="delegate-owner" autoFocus value={ownerName} onChange={(e) => { setOwnerName(e.target.value); setError(null); }} className="w-full rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink" />
      <label className="block text-sm" htmlFor="delegate-output">Expected output</label>
      <input id="delegate-output" value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} className="w-full rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink" />
      <label className="block text-sm" htmlFor="delegate-follow-up">Follow up on</label>
      <input id="delegate-follow-up" type="date" value={followUpDate} onChange={(e) => { setFollowUpDate(e.target.value); setError(null); }} className="rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink" />
      {error && <p role="alert" className="text-sm text-ink-muted">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Delegate</button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
      </div>
    </form>
  );
}
