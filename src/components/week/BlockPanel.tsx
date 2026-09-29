import { useId, useState, type FormEvent } from 'react';
import { BLOCK_RESULT_LABELS } from '../../lib/labels';
import { dayLabel } from '../../shared/exec/today';
import { contextOf } from '../../shared/exec/week';
import type { ProposedBlock } from '../../shared/exec/deepWork';
import type { Context, Outcome } from '../../shared/exec/schemas';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';
import { ContextToggle } from '../ContextToggle';

export type PanelTarget = { kind: 'block'; block: DeepWorkBlock } | { kind: 'proposal'; proposal: ProposedBlock } | { kind: 'new'; date: string };
export type PanelFields = { context: Context; plannedStart: string; plannedMinutes: number; outcomeId: string | null };
type Props = { target: PanelTarget; outcomes: Outcome[]; pending: boolean; onSave: (fields: PanelFields) => void; onClose: () => void };

const FIELD = 'w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink';

function initial(target: PanelTarget): PanelFields & { date: string } {
  if (target.kind === 'block') {
    const { date, context, plannedStart, plannedMinutes, outcomeId } = target.block;
    return { date, context, plannedStart, plannedMinutes, outcomeId };
  }
  if (target.kind === 'proposal') return { ...target.proposal, outcomeId: null };
  return { date: target.date, context: 'work', plannedStart: '09:00', plannedMinutes: 60, outcomeId: null };
}

function ReadOnly({ block, onClose }: { block: DeepWorkBlock; onClose: () => void }) {
  const finished = block.endedAt !== null;
  return (
    <section aria-label="Deep work block" className="space-y-2 rounded-lg border border-line p-4 dark:border-ink-muted">
      <h3 className="font-medium">{dayLabel(block.date)}</h3>
      <p>{finished ? `Finished: ${block.result ? BLOCK_RESULT_LABELS[block.result] : 'stopped'}` : 'Running now.'}</p>
      <button type="button" onClick={onClose} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">Close</button>
    </section>
  );
}

function Editor({ target, outcomes, pending, onSave, onClose }: Props) {
  const id = useId();
  const start = initial(target);
  const [context, setContext] = useState<Context>(start.context);
  const [plannedStart, setPlannedStart] = useState(start.plannedStart);
  const [plannedMinutes, setPlannedMinutes] = useState(String(start.plannedMinutes));
  const [outcomeId, setOutcomeId] = useState(start.outcomeId ?? '');
  const minutes = Number(plannedMinutes);
  const valid = plannedStart !== '' && Number.isInteger(minutes) && minutes >= 15 && minutes <= 600;
  const choices = outcomes.filter((outcome) => outcome.slot !== null && outcome.status === 'active' && contextOf(outcome.category) === context);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid && !pending) onSave({ context, plannedStart, plannedMinutes: minutes, outcomeId: outcomeId || null });
  };
  return (
    <form aria-label="Deep work block" onSubmit={submit} className="space-y-2 rounded-lg border border-line p-4 dark:border-ink-muted">
      <h3 className="font-medium">{dayLabel(start.date)} · {context === 'work' ? 'Work' : 'Build'}</h3>
      {target.kind === 'new' && <ContextToggle value={context} onChange={(next) => { setContext(next); setOutcomeId(''); }} />}
      <label htmlFor={`${id}-outcome`} className="block text-sm">Outcome</label>
      <select id={`${id}-outcome`} value={outcomeId} onChange={(e) => setOutcomeId(e.target.value)} className={FIELD}>
        <option value="">No outcome</option>
        {choices.map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.title}</option>)}
      </select>
      <label htmlFor={`${id}-start`} className="block text-sm">Start</label>
      <input id={`${id}-start`} type="time" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-minutes`} className="block text-sm">Minutes</label>
      <input id={`${id}-minutes`} type="number" min={15} max={600} value={plannedMinutes} onChange={(e) => setPlannedMinutes(e.target.value)} className={FIELD} />
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!valid || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">Save block</button>
        <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
      </div>
    </form>
  );
}

/** Assign a block to an outcome, or change its time before it starts (spec C "Week" item 4). Once started it is history. */
export function BlockPanel(props: Props) {
  const { target, onClose } = props;
  if (target.kind === 'block' && target.block.startedAt !== null) return <ReadOnly block={target.block} onClose={onClose} />;
  return <Editor {...props} />;
}
