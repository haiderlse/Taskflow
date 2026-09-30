import { Link } from 'react-router-dom';
import { useTasks, useUpdateTask } from '../../api/tasks';
import { useReportError } from '../../api/errors';
import { openAtShutdown } from '../../shared/exec/shutdown';
import type { Task, TaskPatch } from '../../shared/exec/schemas';
import type { DayView } from '../../shared/exec/todaySchemas';
import { LoadError } from '../LoadError';
import { OpenRow } from './OpenRow';

type Props = { today: string; next: string; weekStartDay: number; view: DayView; onNext: () => void };

const SMALL = 'rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-40 dark:border-ink-muted dark:hover:text-paper';
const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

/** A delegated or waiting item due for follow-up: follow up tomorrow, mark it received, or kill it. */
function WaitingRow({ task, next }: { task: Task; next: string }) {
  const update = useUpdateTask();
  const report = useReportError();
  const act = (patch: TaskPatch, verb: string) => update.mutate({ id: task.id, patch }, { onError: report(verb) });
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-line py-2 dark:border-ink-muted">
      <span className="flex-1">{task.title} — {task.ownerName}</span>
      <button type="button" disabled={update.isPending} aria-label={`Follow up on "${task.title}" tomorrow`} onClick={() => act({ followUpDate: next }, 'move the follow-up')} className={SMALL}>Tomorrow</button>
      <button type="button" disabled={update.isPending} aria-label={`Received "${task.title}"`} onClick={() => act({ status: 'done' }, 'mark it received')} className={SMALL}>Received</button>
      <button type="button" disabled={update.isPending} aria-label={`Kill "${task.title}"`} onClick={() => act({ status: 'killed' }, 'kill it')} className={SMALL}>Kill</button>
    </li>
  );
}

const captured = (count: number): string => (count === 1 ? '1 captured item' : `${count} captured items`);

/** Shutdown step 2 (spec C): every open row is dealt with before tomorrow is chosen. Captures are counted and may wait. */
export function OpenItems({ today, next, weekStartDay, view, onNext }: Props) {
  const week = useTasks({ week: today });
  const scheduled = week.isSuccess ? week.data.filter((task) => task.scheduledDate === today) : [];
  const open = openAtShutdown(today, view.secondaries.map((secondary) => secondary.task), scheduled, view.waiting);
  const remaining = open.tasks.length + open.waiting.length;
  return (
    <section aria-label="What remains open?" className="space-y-3">
      <h2 className="text-xl font-medium">What remains open?</h2>
      {week.isError && <LoadError what="today's tasks" error={week.error} onRetry={() => void week.refetch()} />}
      {week.isPending && <p className="text-ink-muted">Loading today's tasks…</p>}
      {week.isSuccess && remaining === 0 && <p className="text-ink-muted">Nothing left open today.</p>}
      {week.isSuccess && open.tasks.length > 0 && (
        <ul aria-label="Open tasks">
          {open.tasks.map((task) => <OpenRow key={task.id} task={task} today={today} next={next} weekStartDay={weekStartDay} />)}
        </ul>
      )}
      {week.isSuccess && open.waiting.length > 0 && (
        <ul aria-label="Waiting on others">
          {open.waiting.map((task) => <WaitingRow key={task.id} task={task} next={next} />)}
        </ul>
      )}
      {view.inboxCount > 0 && (
        <p>
          {captured(view.inboxCount)} in the Inbox. <Link to="/inbox" className="underline">Process now</Link>, or leave them for tomorrow.
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="button" disabled={!week.isSuccess || remaining > 0} onClick={onNext} className={PRIMARY}>Next: tomorrow's Must Ship</button>
        {week.isSuccess && remaining > 0 && <p className="text-sm text-ink-muted">{remaining} still open.</p>}
      </div>
    </section>
  );
}
