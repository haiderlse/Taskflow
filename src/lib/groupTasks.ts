import type { Outcome, Task } from '../shared/exec/schemas';

export type TaskGroup = { key: string; label: string; tasks: Task[] };

/** Spec C "Week" item 5: tasks by outcome, then by project, unlinked last. Input order is kept inside a group. */
export function groupTasks(tasks: Task[], outcomes: Outcome[], projects: { id: string; name: string }[]): TaskGroup[] {
  const outcomeTitles = new Map(outcomes.map((outcome) => [outcome.id, outcome.title]));
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const byOutcome = new Map<string, Task[]>();
  const byProject = new Map<string, Task[]>();
  const unlinked: Task[] = [];
  for (const task of tasks) {
    if (task.outcomeId && outcomeTitles.has(task.outcomeId)) byOutcome.set(task.outcomeId, [...(byOutcome.get(task.outcomeId) ?? []), task]);
    else if (task.projectId && projectNames.has(task.projectId)) byProject.set(task.projectId, [...(byProject.get(task.projectId) ?? []), task]);
    else unlinked.push(task);
  }
  return [
    ...[...byOutcome].map(([id, list]) => ({ key: `outcome:${id}`, label: outcomeTitles.get(id) ?? '', tasks: list })),
    ...[...byProject].map(([id, list]) => ({ key: `project:${id}`, label: projectNames.get(id) ?? '', tasks: list })),
    ...(unlinked.length > 0 ? [{ key: 'unlinked', label: 'Not linked', tasks: unlinked }] : []),
  ];
}
