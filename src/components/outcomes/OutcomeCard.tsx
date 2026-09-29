import { useEffect, useState } from 'react';
import type { Outcome, OutcomePatch, ReviewReason } from '../../shared/exec/schemas';
import { CATEGORY_LABELS } from '../../lib/labels';
import { OutcomeForm } from './OutcomeForm';
import { ReasonSelect } from './ReasonSelect';

type Props = { outcome: Outcome; onUpdate: (patch: OutcomePatch) => void; onKill: (reason: ReviewReason) => void };

const BUTTON = 'rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink dark:border-ink-muted dark:hover:text-paper';

function KillPrompt({ onConfirm, onCancel }: { onConfirm: (reason: ReviewReason) => void; onCancel: () => void }) {
  const [reason, setReason] = useState<ReviewReason>('priority_changed');
  return (
    <div className="space-y-2 pt-2">
      <ReasonSelect label="Why does it go?" value={reason} onChange={setReason} />
      <div className="flex gap-2">
        <button type="button" className={BUTTON} onClick={() => onConfirm(reason)}>Kill outcome</button>
        <button type="button" className={BUTTON} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** One of the week's three outcomes (spec C "Week" item 2). Progress is set by hand, committed when released. */
export function OutcomeCard({ outcome, onUpdate, onKill }: Props) {
  const [mode, setMode] = useState<'view' | 'edit' | 'kill'>('view');
  const [progress, setProgress] = useState(outcome.progress);
  useEffect(() => setProgress(outcome.progress), [outcome.progress]);
  const done = outcome.status === 'done';
  const commit = () => progress !== outcome.progress && onUpdate({ progress });

  if (mode === 'edit') {
    return (
      <OutcomeForm
        initial={outcome}
        defaultTargetDate={outcome.targetDate ?? ''}
        submitLabel="Save outcome"
        onCancel={() => setMode('view')}
        onSubmit={(input) => {
          onUpdate({ title: input.title, category: input.category, definitionOfDone: input.definitionOfDone, targetDate: input.targetDate, projectId: input.projectId });
          setMode('view');
        }}
      />
    );
  }
  return (
    <article aria-label={outcome.title} className="space-y-2 rounded-lg border border-line bg-paper-raised p-4 dark:border-ink-muted dark:bg-ink">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{CATEGORY_LABELS[outcome.category]} · Outcome {outcome.slot}{done && ' · Done'}</p>
      <h3 className="text-lg font-medium">{outcome.title}</h3>
      <div className="flex items-center gap-3">
        <input type="range" min={0} max={100} step={10} value={progress} disabled={done} aria-label={`Progress for ${outcome.title}`} onChange={(e) => setProgress(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} className="flex-1" />
        <span className="w-12 text-right text-sm text-ink-muted">{progress}%</span>
      </div>
      {outcome.definitionOfDone && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-muted">Definition of done</summary>
          <p className="pt-1">{outcome.definitionOfDone}</p>
        </details>
      )}
      {outcome.targetDate && <p className="text-sm text-ink-muted">Target {outcome.targetDate}</p>}
      {mode === 'kill' ? (
        <KillPrompt onCancel={() => setMode('view')} onConfirm={(reason) => { onKill(reason); setMode('view'); }} />
      ) : (
        <div className="flex gap-2 pt-1">
          <button type="button" className={BUTTON} onClick={() => onUpdate({ status: done ? 'active' : 'done' })}>{done ? 'Reopen' : 'Mark done'}</button>
          <button type="button" className={BUTTON} onClick={() => setMode('edit')}>Edit</button>
          {!done && <button type="button" className={BUTTON} onClick={() => setMode('kill')}>Kill</button>}
        </div>
      )}
    </article>
  );
}
