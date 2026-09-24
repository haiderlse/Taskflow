import { useProjects } from '../../api/projects';
import type { Task } from '../../shared/exec/schemas';

type Props = { task: Task; onPick: (projectId: string) => void; onCancel: () => void };

export function ProjectPicker({ task, onPick, onCancel }: Props) {
  const projects = useProjects();
  const list = projects.data ?? [];
  return (
    <div role="group" aria-label={`Project for ${task.title}`} className="space-y-3 rounded-md border border-line p-4 dark:border-ink-muted">
      {list.length === 0 ? (
        <p className="text-ink-muted">No projects yet. Projects arrive in Phase 3.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => onPick(project.id)} className="w-full rounded border border-line px-3 py-2 text-left hover:border-ink dark:border-ink-muted">
                {project.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
    </div>
  );
}
