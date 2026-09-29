import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { ContextToggle } from '../components/ContextToggle';
import { LoadError } from '../components/LoadError';
import { useCreateProject, useProjects } from '../api/projects';
import { useReportError } from '../api/errors';
import { PROJECT_STATUS_LABELS } from '../lib/labels';
import type { Context, ProjectSummary } from '../shared/exec/schemas';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function NewProject() {
  const create = useCreateProject();
  const report = useReportError();
  const [name, setName] = useState('');
  const [context, setContext] = useState<Context>('work');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) create.mutate({ name: name.trim(), context }, { onSuccess: () => setName(''), onError: report('create the project') });
  };
  return (
    <form aria-label="New project" onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New project" className="min-w-0 flex-1 rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink" />
      <ContextToggle value={context} onChange={setContext} />
      <button type="submit" disabled={!name.trim() || create.isPending} className="rounded bg-ink px-3 py-2 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
        Create project
      </button>
    </form>
  );
}

function Group({ label, projects }: { label: 'Work' | 'Build'; projects: ProjectSummary[] }) {
  return (
    <section aria-label={label} className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">{label}</h2>
      {projects.length === 0 && <p className="text-ink-muted">No {label.toLowerCase()} projects yet.</p>}
      <ul className="space-y-1">
        {projects.map((project) => (
          <li key={project.id} className="flex justify-between gap-3 border-t border-line py-2 dark:border-ink-muted">
            <Link to={`/projects/${project.id}`} className="font-medium">{project.name}</Link>
            <span className="text-sm text-ink-muted">
              {project.status !== 'active' && `${PROJECT_STATUS_LABELS[project.status]} · `}
              {plural(project.activeOutcomes, 'outcome')} · {plural(project.openTasks, 'open task')}
              {project.mustShipCandidates > 0 && ` · ${plural(project.mustShipCandidates, 'candidate')}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Spec C "Projects": a list, never a board, with work and build kept apart (§16). */
export default function Projects() {
  const query = useProjects();
  const projects = query.data;
  return (
    <ScreenShell title="Projects">
      <NewProject />
      {query.isError && <LoadError what="projects" error={query.error} onRetry={() => void query.refetch()} />}
      {projects && (
        <>
          <Group label="Work" projects={projects.filter((project) => project.context === 'work')} />
          <Group label="Build" projects={projects.filter((project) => project.context === 'build')} />
        </>
      )}
    </ScreenShell>
  );
}
