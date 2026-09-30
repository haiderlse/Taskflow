import { useState } from 'react';
import { useRollTask, useUpdateTask } from '../../api/tasks';
import { useReportError } from '../../api/errors';
import { scheduleStatus } from '../../lib/inboxRules';
import type { Task, TaskPatch } from '../../shared/exec/schemas';
import { DelegatePanel } from '../inbox/DelegatePanel';
import { SchedulePanel } from '../inbox/SchedulePanel';

type Props = { task: Task; today: string; next: string; weekStartDay: number };

const SMALL = 'rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-40 dark:border-ink-muted dark:hover:text-paper';

/** One open task at shutdown (spec C step 2): Tomorrow, Schedule, Delegate, Later or Kill. */
export function OpenRow({ task, today, next, weekStartDay }: Props) {
  const update = useUpdateTask();
  const roll = useRollTask();
  const report = useReportError();
  const [panel, setPanel] = useState<'schedule' | 'delegate' | null>(null);
  const patch = (fields: TaskPatch) => update.mutate({ id: task.id, patch: fields }, { onSuccess: () => setPanel(null), onError: report('update the task') });
  const actions: { label: string; name: string; act: () => void }[] = [
    { label: 'Tomorrow', name: `Move "${task.title}" to tomorrow`, act: () => roll.mutate({ id: task.id, date: next }, { onError: report('move it to tomorrow') }) },
    { label: 'Schedule', name: `Schedule "${task.title}"`, act: () => setPanel('schedule') },
    { label: 'Delegate', name: `Delegate "${task.title}"`, act: () => setPanel('delegate') },
    { label: 'Later', name: `Park "${task.title}" for later`, act: () => patch({ status: 'later', scheduledDate: null }) },
    { label: 'Kill', name: `Kill "${task.title}"`, act: () => patch({ status: 'killed' }) },
  ];
  return (
    <li className="space-y-2 border-t border-line py-2 dark:border-ink-muted">
      <span className="block">{task.title}</span>
      <div className="flex flex-wrap gap-1">
        {actions.map((action) => (
          <button key={action.label} type="button" aria-label={action.name} disabled={update.isPending || roll.isPending} onClick={action.act} className={SMALL}>
            {action.label}
          </button>
        ))}
      </div>
      {panel === 'schedule' && (
        <SchedulePanel task={task} defaultDate={next} onCancel={() => setPanel(null)} onSubmit={(date) => patch({ status: scheduleStatus(date, today, weekStartDay), scheduledDate: date })} />
      )}
      {panel === 'delegate' && (
        <DelegatePanel task={task} defaultFollowUp={next} onCancel={() => setPanel(null)} onSubmit={(fields) => patch({ status: 'delegated', ...fields })} />
      )}
    </li>
  );
}
