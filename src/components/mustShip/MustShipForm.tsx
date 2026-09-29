import { useId, useRef, useState, type FormEvent } from 'react';
import type { Outcome } from '../../shared/exec/schemas';
import { isActivityTitle, needsNudge } from '../../shared/exec/nudge';
import { NudgeLine } from '../outcomes/NudgeLine';

export type MustShipFields = { title: string; definitionOfDone: string; outcomeId: string | null };

type Props = {
  outcomes: Outcome[];
  submitLabel: string;
  initial?: Partial<MustShipFields>;
  pending?: boolean;
  onSubmit: (fields: MustShipFields) => void;
  onCancel?: () => void;
};

const FIELD = 'w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink';

/** One output that must exist by the end of the day (§6). The nudge coaches an activity title (§9); it never blocks. */
export function MustShipForm({ outcomes, submitLabel, initial = {}, pending = false, onSubmit, onCancel }: Props) {
  const id = useId();
  const [title, setTitle] = useState(initial.title ?? '');
  const [definition, setDefinition] = useState(initial.definitionOfDone ?? '');
  const [outcomeId, setOutcomeId] = useState(initial.outcomeId ?? '');
  const definitionRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = title.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed && !pending) onSubmit({ title: trimmed, definitionOfDone: definition.trim(), outcomeId: outcomeId || null });
  };
  return (
    <form aria-label={submitLabel} onSubmit={submit} className="space-y-2">
      <label htmlFor={`${id}-title`} className="block text-sm">Must Ship</label>
      <input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => isActivityTitle(title) && definitionRef.current?.focus()} placeholder="What will exist by the end of today?" className={FIELD} />
      <NudgeLine show={needsNudge(title, definition)} />
      <label htmlFor={`${id}-definition`} className="block text-sm">Definition of done</label>
      <textarea id={`${id}-definition`} ref={definitionRef} rows={2} value={definition} onChange={(e) => setDefinition(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-outcome`} className="block text-sm">Serves outcome</label>
      <select id={`${id}-outcome`} value={outcomeId} onChange={(e) => setOutcomeId(e.target.value)} className={FIELD}>
        <option value="">No outcome</option>
        {outcomes.map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.title}</option>)}
      </select>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!trimmed || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>}
      </div>
    </form>
  );
}
