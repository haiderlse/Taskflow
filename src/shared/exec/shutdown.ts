import { WAITING_STATUSES } from './schemas';
import type { Task, TaskStatus } from './schemas';

export type OpenAtShutdown = { tasks: Task[]; waiting: Task[] };

const OPEN: readonly TaskStatus[] = ['inbox', 'this_week', 'later'];

/** Still due today: not done, not handed off, not moved to a later day, and not parked without a date. */
function stillToday(task: Task, date: string): boolean {
  if (!OPEN.includes(task.status)) return false;
  if (task.scheduledDate !== null && task.scheduledDate > date) return false;
  return !(task.status === 'later' && task.scheduledDate === null);
}

/**
 * Spec C "Shutdown" step 2: today's secondaries not done and the tasks scheduled today, then the waiting items due for
 * follow-up. A task in both lists shows once, and each row drops out as soon as it has been dealt with.
 */
export function openAtShutdown(date: string, secondaries: Task[], scheduled: Task[], waiting: Task[]): OpenAtShutdown {
  const tasks = [...secondaries, ...scheduled].filter(
    (task, index, all) => all.findIndex((other) => other.id === task.id) === index && stillToday(task, date)
  );
  const due = waiting.filter(
    (task) => WAITING_STATUSES.includes(task.status) && task.followUpDate !== null && task.followUpDate <= date && !tasks.some((other) => other.id === task.id)
  );
  return { tasks, waiting: due };
}
