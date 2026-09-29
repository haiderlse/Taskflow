import { useState } from 'react';
import { useSetSecondaries } from '../../api/days';
import { useTasks, useUpdateTask } from '../../api/tasks';
import { useReportError } from '../../api/errors';
import { LoadError } from '../LoadError';
import type { Task, TaskStatus } from '../../shared/exec/schemas';
import type { Secondary } from '../../shared/exec/todaySchemas';

type Props = { date: string; secondaries: Secondary[] };

const CHOOSABLE: readonly TaskStatus[] = ['inbox', 'this_week', 'later'];
const SMALL = 'rounded border border-line px-2 py-1 text-xs text-ink-muted dark:border-ink-muted';

function Chooser({ date, taken, onPick, onClose }: { date: string; taken: string[]; onPick: (task: Task) => void; onClose: () => void }) {
  const committed = useTasks({ week: date });
  const inbox = useTasks({ status: ['inbox'] });
  const all = [...(committed.data ?? []), ...(inbox.data ?? [])];
  const choices = all.filter((task, index) => CHOOSABLE.includes(task.status) && !taken.includes(task.id) && all.findIndex((other) => other.id === task.id) === index);
  const failed = committed.error ?? inbox.error;
  const retry = () => {
    void committed.refetch();
    void inbox.refetch();
  };
  return (
    <div className="space-y-2 rounded-lg border border-line p-3 dark:border-ink-muted">
      {failed ? (
        <LoadError what="your tasks" error={failed} onRetry={retry} />
      ) : !committed.isSuccess || !inbox.isSuccess ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : choices.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing to choose. Capture it, or commit it on the Week.</p>
      ) : (
        <ul aria-label="Choose a secondary" className="space-y-1">
          {choices.map((task) => (
            <li key={task.id}>
              <button type="button" onClick={() => onPick(task)} className="text-left hover:underline">{task.title}</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onClose} className="text-sm text-ink-muted">Cancel</button>
    </div>
  );
}

/** Spec C "Today" item 3: at most two rows with a checkbox; an empty slot offers "add". There is no third row. */
export function Secondaries({ date, secondaries }: Props) {
  const set = useSetSecondaries();
  const update = useUpdateTask();
  const report = useReportError();
  const [choosing, setChoosing] = useState(false);
  const ids = secondaries.map((secondary) => secondary.task.id);
  const save = (taskIds: string[]) => set.mutate({ date, taskIds }, { onSuccess: () => setChoosing(false), onError: report('set the secondaries') });
  const toggle = (task: Task, done: boolean) => update.mutate({ id: task.id, patch: { status: done ? 'done' : 'this_week' } }, { onError: report('update the task') });
  return (
    <section aria-label="Secondary" className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Secondary</h2>
      <ul className="space-y-1">
        {secondaries.map(({ task }) => (
          <li key={task.id} className="flex items-center gap-2">
            <input type="checkbox" aria-label={task.title} checked={task.status === 'done'} onChange={(e) => toggle(task, e.target.checked)} />
            <span className={task.status === 'done' ? 'flex-1 text-ink-muted line-through' : 'flex-1'}>{task.title}</span>
            <button type="button" aria-label={`Remove "${task.title}"`} onClick={() => save(ids.filter((id) => id !== task.id))} className={SMALL}>Remove</button>
          </li>
        ))}
      </ul>
      {secondaries.length < 2 &&
        (choosing ? (
          <Chooser date={date} taken={ids} onPick={(task) => save([...ids, task.id])} onClose={() => setChoosing(false)} />
        ) : (
          <button type="button" onClick={() => setChoosing(true)} className={SMALL}>Add a secondary</button>
        ))}
    </section>
  );
}
