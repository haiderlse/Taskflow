import { useState } from 'react';
import { useUpdateTask } from '../../api/tasks';
import { useReportError } from '../../api/errors';
import { nextWorkDay } from '../../shared/exec/today';
import type { Task, TaskPatch } from '../../shared/exec/schemas';

type Props = { today: string; workDays: readonly number[]; waiting: Task[] };

const SMALL = 'rounded border border-line px-2 py-1 text-xs text-ink-muted dark:border-ink-muted';

/** Spec C "Today" item 4: delegated and waiting items due for follow-up; "Followed up" moves the date on, "Received" closes it. */
export function Waiting({ today, workDays, waiting }: Props) {
  const update = useUpdateTask();
  const report = useReportError();
  const [open, setOpen] = useState(false);
  const act = (task: Task, patch: TaskPatch, verb: string) => update.mutate({ id: task.id, patch }, { onError: report(verb) });
  const summary = waiting.length === 1 ? '1 delegated item needs follow-up' : `${waiting.length} delegated items need follow-up`;
  return (
    <section aria-label="Waiting" className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Waiting</h2>
      {waiting.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing to follow up today.</p>
      ) : (
        <>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-left hover:underline">{summary}</button>
          {open && (
            <ul className="space-y-2">
              {waiting.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center gap-2">
                  <span className="flex-1">{task.title} — {task.ownerName}</span>
                  <button type="button" aria-label={`Followed up on "${task.title}"`} onClick={() => act(task, { followUpDate: nextWorkDay(today, workDays) }, 'record the follow-up')} className={SMALL}>Followed up</button>
                  <button type="button" aria-label={`Received "${task.title}"`} onClick={() => act(task, { status: 'done' }, 'mark it received')} className={SMALL}>Received</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
