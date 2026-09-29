import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { useProject, useUpdateProject } from '../api/projects';
import { useCreateMustShip, useMustShips } from '../api/mustShips';
import { LoadError } from '../components/LoadError';
import { MustShipForm } from '../components/mustShip/MustShipForm';
import { errorMessage, useReportError } from '../api/errors';
import { PROJECT_STATUS_LABELS } from '../lib/labels';
import { weekNumber } from '../shared/exec/week';
import { PROJECT_STATUSES, type Outcome, type Project, type ProjectPatch, type ProjectStatus } from '../shared/exec/schemas';

function Notes({ notes, onSave }: { notes: string; onSave: (notes: string) => void }) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => setDraft(notes), [notes]);
  return (
    <label className="block space-y-1 text-sm">
      <span>Notes</span>
      <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== notes && onSave(draft)} className="w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink" />
    </label>
  );
}

/** Spec C "Projects" (§17): planned outputs with no date yet, waiting to become a day's Must Ship. */
function Candidates({ project, outcomes }: { project: Project; outcomes: Outcome[] }) {
  const candidates = useMustShips({ date: 'none', project: project.id, status: ['planned'] });
  const create = useCreateMustShip();
  const report = useReportError();
  const [formKey, setFormKey] = useState(0);
  const list = candidates.data ?? [];
  return (
    <section aria-label="Must Ship candidates" className="space-y-2">
      <h2 className="text-xl font-medium">Must Ship candidates</h2>
      {candidates.isError ? (
        <LoadError what="candidates" error={candidates.error} onRetry={() => void candidates.refetch()} />
      ) : !candidates.isSuccess ? (
        <p className="text-ink-muted">Loading candidates…</p>
      ) : (
        <>
          {list.length === 0 && <p className="text-ink-muted">No candidates yet. Planned outputs with no date wait here.</p>}
          <ul>{list.map((candidate) => <li key={candidate.id}>{candidate.title}</li>)}</ul>
        </>
      )}
      <MustShipForm
        key={formKey}
        outcomes={outcomes}
        submitLabel="Add candidate"
        pending={create.isPending}
        onSubmit={(fields) =>
          create.mutate({ ...fields, context: project.context, date: null, projectId: project.id }, { onSuccess: () => setFormKey((key) => key + 1), onError: report('add the candidate') })
        }
      />
    </section>
  );
}

/** One project: its outcomes week by week, its Must Ship candidates and its open tasks. */
export default function ProjectDetail() {
  const { id = '' } = useParams();
  const detail = useProject(id);
  const update = useUpdateProject();
  const report = useReportError();
  const save = (patch: ProjectPatch) => update.mutate({ id, patch }, { onError: report('update the project') });

  if (detail.isError) {
    return (
      <ScreenShell title="Project">
        <p className="text-ink-muted">
          {detail.error.code === 'NOT_FOUND' ? 'That project does not exist.' : `Could not load the project: ${errorMessage(detail.error)}`}
        </p>
        <Link to="/projects" className="underline">All projects</Link>
      </ScreenShell>
    );
  }
  if (!detail.data) return <ScreenShell title="Project"><p className="text-ink-muted">Loading…</p></ScreenShell>;
  const { project, outcomes, tasks } = detail.data;
  return (
    <ScreenShell title={project.name}>
      <Link to="/projects" className="text-sm underline">All projects</Link>
      <label className="flex items-center gap-2 text-sm">
        <span>Status</span>
        <select value={project.status} onChange={(e) => save({ status: e.target.value as ProjectStatus })} className="rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink">
          {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>)}
        </select>
      </label>
      <Notes notes={project.notes} onSave={(notes) => save({ notes })} />
      <section aria-label="Outcomes" className="space-y-1">
        <h2 className="text-xl font-medium">Outcomes</h2>
        {outcomes.length === 0 && <p className="text-ink-muted">No outcomes yet. Link one from the week.</p>}
        <ul>{outcomes.map((outcome) => <li key={outcome.id}>Week {weekNumber(outcome.weekStartDate)} · {outcome.title}</li>)}</ul>
      </section>
      <Candidates project={project} outcomes={outcomes.filter((outcome) => outcome.status === 'active' && outcome.slot !== null)} />
      <section aria-label="Open tasks" className="space-y-1">
        <h2 className="text-xl font-medium">Open tasks</h2>
        {tasks.length === 0 && <p className="text-ink-muted">No open tasks.</p>}
        <ul>{tasks.map((task) => <li key={task.id}>{task.title}</li>)}</ul>
      </section>
    </ScreenShell>
  );
}
