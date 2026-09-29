import { useId, useRef, useState, type FormEvent } from 'react';
import { OUTCOME_CATEGORIES, type OutcomeCategory, type OutcomeInput } from '../../shared/exec/schemas';
import { isActivityTitle, needsNudge } from '../../shared/exec/nudge';
import { CATEGORY_LABELS } from '../../lib/labels';
import { useProjects } from '../../api/projects';
import { NudgeLine } from './NudgeLine';

type Props = {
  initial?: Partial<OutcomeInput>;
  defaultTargetDate: string;
  submitLabel: string;
  requireDefinition?: boolean;
  pending?: boolean;
  onSubmit: (input: OutcomeInput) => void;
  onCancel?: () => void;
};

const FIELD = 'w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink';

function useOutcomeFields(initial: Partial<OutcomeInput>, defaultTargetDate: string) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [category, setCategory] = useState<OutcomeCategory>(initial.category ?? 'office');
  const [definition, setDefinition] = useState(initial.definitionOfDone ?? '');
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? defaultTargetDate);
  const [projectId, setProjectId] = useState(initial.projectId ?? '');
  const value: OutcomeInput = {
    title: title.trim(),
    category,
    definitionOfDone: definition.trim(),
    targetDate: targetDate || null,
    projectId: projectId || null,
  };
  return { title, setTitle, category, setCategory, definition, setDefinition, targetDate, setTargetDate, projectId, setProjectId, value };
}

/** Title, category, definition of done, target date, project. The nudge coaches (§9); it never blocks. */
export function OutcomeForm({ initial = {}, defaultTargetDate, submitLabel, requireDefinition = false, pending = false, onSubmit, onCancel }: Props) {
  const id = useId();
  const f = useOutcomeFields(initial, defaultTargetDate);
  const projects = (useProjects().data ?? []).filter((project) => project.status === 'active');
  const definitionRef = useRef<HTMLTextAreaElement>(null);
  const blocked = f.value.title === '' || (requireDefinition && f.value.definitionOfDone === '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!blocked && !pending) onSubmit(f.value);
  };
  return (
    <form aria-label={submitLabel} onSubmit={submit} className="space-y-2 rounded-lg border border-line p-4 dark:border-ink-muted">
      <label htmlFor={`${id}-title`} className="block text-sm">Outcome</label>
      <input id={`${id}-title`} value={f.title} onChange={(e) => f.setTitle(e.target.value)} onBlur={(e) => e.relatedTarget === null && isActivityTitle(f.title) && f.definition.trim() === '' && definitionRef.current?.focus()} placeholder="What will exist when this is finished?" className={FIELD} />
      <NudgeLine show={needsNudge(f.title, f.definition)} />
      <label htmlFor={`${id}-category`} className="block text-sm">Category</label>
      <select id={`${id}-category`} value={f.category} onChange={(e) => f.setCategory(e.target.value as OutcomeCategory)} className={FIELD}>
        {OUTCOME_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
      </select>
      <label htmlFor={`${id}-definition`} className="block text-sm">Definition of done</label>
      <textarea id={`${id}-definition`} ref={definitionRef} rows={2} value={f.definition} onChange={(e) => f.setDefinition(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-target`} className="block text-sm">Target date</label>
      <input id={`${id}-target`} type="date" value={f.targetDate} onChange={(e) => f.setTargetDate(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-project`} className="block text-sm">Project</label>
      <select id={`${id}-project`} value={f.projectId} onChange={(e) => f.setProjectId(e.target.value)} className={FIELD}>
        <option value="">No project</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={blocked || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>}
      </div>
    </form>
  );
}
