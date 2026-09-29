import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { toEntity, insertRow, updateRow, placeholders } from '../rows';
import { OPEN_STATUSES } from '../../../src/shared/exec/schemas';
import type { Outcome, Project, ProjectCreate, ProjectDetail, ProjectPatch, ProjectSummary, Task } from '../../../src/shared/exec/schemas';

export function getProject(db: Database.Database, id: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return row ? toEntity<Project>(row) : null;
}

/** Active projects first, then done, then archived; each with its active outcomes and open tasks. */
export function listProjectSummaries(db: Database.Database): ProjectSummary[] {
  return db
    .prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM outcomes o WHERE o.project_id = p.id AND o.status = 'active') AS active_outcomes,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status IN (${placeholders(OPEN_STATUSES.length)})) AS open_tasks
       FROM projects p
       ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'done' THEN 1 ELSE 2 END, p.name COLLATE NOCASE, p.id`
    )
    .all(...OPEN_STATUSES)
    .map((row) => toEntity<ProjectSummary>(row));
}

/** A project page: outcomes newest week first with the week's start date, and its open tasks. */
export function getProjectDetail(db: Database.Database, id: string): ProjectDetail | null {
  const project = getProject(db, id);
  if (!project) return null;
  const outcomes = db
    .prepare(
      `SELECT o.*, w.start_date AS week_start_date FROM outcomes o JOIN weeks w ON w.id = o.week_id
       WHERE o.project_id = ? ORDER BY w.start_date DESC, o.slot IS NULL, o.slot, o.created_at`
    )
    .all(id)
    .map((row) => toEntity<Outcome & { weekStartDate: string }>(row));
  const tasks = db
    .prepare(`SELECT * FROM tasks WHERE project_id = ? AND status IN (${placeholders(OPEN_STATUSES.length)}) ORDER BY captured_at DESC, id`)
    .all(id, ...OPEN_STATUSES)
    .map((row) => toEntity<Task>(row));
  return { project, outcomes, tasks };
}

export function createProject(db: Database.Database, input: ProjectCreate, now: string): Project {
  const id = randomUUID();
  insertRow(db, 'projects', { ...input, id, createdAt: now, updatedAt: now });
  return getProject(db, id) as Project;
}

export function patchProject(db: Database.Database, id: string, patch: ProjectPatch, now: string): Project | null {
  if (!getProject(db, id)) return null;
  updateRow(db, 'projects', id, { ...patch, updatedAt: now });
  return getProject(db, id);
}
