import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { createProject, getProjectDetail, listProjectSummaries, patchProject } from '../projects/store';
import { ensureWeek } from '../weeks/store';
import { addOutcome, patchOutcome } from '../outcomes/store';
import { createTask, patchTask } from '../tasks/store';
import { createMustShip } from '../mustShips/store';

const T0 = '2026-09-22T03:00:00.000Z';
const T1 = '2026-09-22T03:05:00.000Z';
let db: Database.Database;

const outcome = (weekId: string, title: string, projectId: string) =>
  addOutcome(db, weekId, { title, category: 'office', description: '', definitionOfDone: 'x', targetDate: null, projectId, notes: '' }, T0);
const task = (title: string, projectId: string) => {
  const created = createTask(db, { title, context: 'work', notes: '' }, T0);
  return patchTask(db, created.id, { projectId, status: 'later' }, T0);
};

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('projects store', () => {
  it('creates a project with defaults and patches it', () => {
    const p = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    expect(p).toMatchObject({ name: 'Supply plan', context: 'work', status: 'active', notes: '', createdAt: T0 });
    expect(patchProject(db, p.id, { status: 'done', notes: 'Shipped' }, T1)).toMatchObject({ status: 'done', notes: 'Shipped', updatedAt: T1 });
    expect(patchProject(db, 'missing', { name: 'x' }, T1)).toBeNull();
  });

  it('summarises each project with active outcomes and open tasks, active projects first', () => {
    const supply = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    const archive = createProject(db, { name: 'Archive me', context: 'work', notes: '' }, T0);
    const pinkbox = createProject(db, { name: 'pinkbox dashboard', context: 'build', notes: '' }, T0);
    patchProject(db, archive.id, { status: 'archived' }, T0);
    const weekId = ensureWeek(db, '2026-09-22', 0, T0).view.week.id;
    const kept = outcome(weekId, 'Delivery plan', supply.id);
    const killed = outcome(weekId, 'Old idea', supply.id);
    patchOutcome(db, killed.id, { status: 'killed' }, T1);
    task('Call supplier', supply.id);
    const done = task('Send tracker', supply.id);
    patchTask(db, done!.id, { status: 'done' }, T1);

    expect(listProjectSummaries(db).map((p) => [p.name, p.activeOutcomes, p.openTasks])).toEqual([
      ['pinkbox dashboard', 0, 0],
      ['Supply plan', 1, 1],
      ['Archive me', 0, 0],
    ]);
    expect(kept.projectId).toBe(supply.id);
    expect(pinkbox.context).toBe('build');
  });

  it('details a project with outcomes by week and open tasks, or null', () => {
    const supply = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    const earlier = ensureWeek(db, '2026-09-15', 0, T0).view.week.id;
    const later = ensureWeek(db, '2026-09-22', 0, T0).view.week.id;
    outcome(earlier, 'First', supply.id);
    outcome(later, 'Second', supply.id);
    task('Call supplier', supply.id);

    const detail = getProjectDetail(db, supply.id);
    expect(detail?.project.name).toBe('Supply plan');
    expect(detail?.outcomes.map((o) => [o.title, o.weekStartDate])).toEqual([
      ['Second', '2026-09-20'],
      ['First', '2026-09-13'],
    ]);
    expect(detail?.tasks.map((t) => t.title)).toEqual(['Call supplier']);
    expect(getProjectDetail(db, 'missing')).toBeNull();
  });
});

describe('Must Ship candidates on projects', () => {
  it('counts planned, undated Must Ships linked to each project', () => {
    const project = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    const base = { context: 'work' as const, definitionOfDone: '', outcomeId: null, projectId: project.id, notes: '' };
    createMustShip(db, { ...base, title: 'Candidate', date: null }, T0);
    createMustShip(db, { ...base, title: 'Dated', date: '2026-09-29' }, T0);
    const shipped = createMustShip(db, { ...base, title: 'Old', date: null }, T0);
    db.prepare("UPDATE must_ships SET status = 'shipped' WHERE id = ?").run(shipped.id);
    expect(listProjectSummaries(db).find((summary) => summary.id === project.id)?.mustShipCandidates).toBe(1);
  });
});
