import { useTasks } from '../../api/tasks';
import { useProjects } from '../../api/projects';
import { groupTasks } from '../../lib/groupTasks';
import type { Outcome } from '../../shared/exec/schemas';

type Props = { weekStartDate: string; outcomes: Outcome[] };

/** Spec C "Week" items 5 and 6: this week's committed tasks, grouped, and everything waiting on someone else. */
export function WeekTasks({ weekStartDate, outcomes }: Props) {
  const committed = useTasks({ week: weekStartDate });
  const waiting = useTasks({ status: ['delegated', 'waiting'] });
  const projects = useProjects();
  const groups = groupTasks(committed.data ?? [], outcomes, projects.data ?? []);
  const owed = waiting.data ?? [];
  return (
    <>
      <section aria-label="This week's tasks" className="space-y-2">
        <h2 className="text-xl font-medium">This week's tasks</h2>
        {groups.length === 0 && <p className="text-ink-muted">Nothing committed to this week yet.</p>}
        {groups.map((group) => (
          <div key={group.key}>
            <h3 className="text-sm uppercase tracking-wide text-ink-muted">{group.label}</h3>
            <ul className="space-y-1">{group.tasks.map((task) => <li key={task.id}>{task.title}</li>)}</ul>
          </div>
        ))}
      </section>
      <section aria-label="Waiting on others" className="space-y-2">
        <h2 className="text-xl font-medium">Waiting on others</h2>
        {owed.length === 0 && <p className="text-ink-muted">Nothing is waiting on anyone.</p>}
        <ul className="space-y-1">
          {owed.map((task) => (
            <li key={task.id}>
              {task.title} — {task.ownerName}
              {task.followUpDate && <span className="text-ink-muted"> · follow up {task.followUpDate}</span>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
