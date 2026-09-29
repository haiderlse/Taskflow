import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { createProject } from '../projects/store';
import { createMustShip, getMustShip, listMustShips, patchMustShip, rollMustShip } from '../mustShips/store';
import { ApiError } from '../http';
import type { MustShipCreate } from '../../../src/shared/exec/todaySchemas';

const T0 = '2026-09-29T03:00:00.000Z';
const T1 = '2026-09-29T03:05:00.000Z';
let db: Database.Database;

const input = (title: string, overrides: Partial<MustShipCreate> = {}): MustShipCreate => ({
  title,
  context: 'work',
  date: '2026-09-29',
  definitionOfDone: '',
  outcomeId: null,
  projectId: null,
  notes: '',
  ...overrides,
});

function refusal(run: () => unknown): ApiError {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('createMustShip', () => {
  it('creates a planned Must Ship with server-set fields', () => {
    const made = createMustShip(db, input('Supplier tracker sent'), T0);
    expect(made).toMatchObject({ title: 'Supplier tracker sent', context: 'work', date: '2026-09-29', status: 'planned', rollCount: 0, rolledFromId: null, closedAt: null, createdAt: T0 });
    expect(getMustShip(db, made.id)).toEqual(made);
  });

  it('refuses a second Must Ship for the same day and context with DAY_TAKEN naming the first', () => {
    createMustShip(db, input('First'), T0);
    const error = refusal(() => createMustShip(db, input('Second'), T0));
    expect(error).toMatchObject({ status: 409, code: 'DAY_TAKEN', message: 'that day already has a must ship' });
    expect(error.details).toMatchObject({ mustShip: { title: 'First' } });
    expect(createMustShip(db, input('Build it', { context: 'build' }), T0).context).toBe('build');
  });

  it('keeps any number of undated candidates', () => {
    createMustShip(db, input('A', { date: null }), T0);
    createMustShip(db, input('B', { date: null }), T0);
    expect(listMustShips(db, { date: 'none' })).toHaveLength(2);
  });
});

describe('listMustShips', () => {
  it('filters by candidates, date, week, status, outcome, project and context', () => {
    const weekId = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
    const outcome = addOutcome(db, weekId, { title: 'Supplier plan confirmed', category: 'office', description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, T0);
    const project = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    createMustShip(db, input('Old candidate', { date: null, projectId: project.id }), T0);
    createMustShip(db, input('New candidate', { date: null }), T1);
    createMustShip(db, input('Tuesday', { outcomeId: outcome.id }), T0);
    createMustShip(db, input('Monday', { date: '2026-09-28' }), T0);
    createMustShip(db, input('Next week', { date: '2026-10-05' }), T0);
    createMustShip(db, input('Build Tuesday', { context: 'build' }), T0);
    const titles = (query: Parameters<typeof listMustShips>[1]) => listMustShips(db, query).map((mustShip) => mustShip.title);
    expect(titles({ date: 'none' })).toEqual(['New candidate', 'Old candidate']);
    expect(titles({ date: '2026-09-29' })).toEqual(['Tuesday', 'Build Tuesday']);
    expect(titles({ week: '2026-10-01' })).toEqual(['Monday', 'Tuesday', 'Build Tuesday']);
    expect(titles({ outcome: outcome.id })).toEqual(['Tuesday']);
    expect(titles({ date: 'none', project: project.id })).toEqual(['Old candidate']);
    expect(titles({ context: 'build' })).toEqual(['Build Tuesday']);
    expect(titles({ status: ['shipped'] })).toEqual([]);
  });
});

describe('patchMustShip', () => {
  it('refuses moving onto a taken day but lets a Must Ship keep its own', () => {
    createMustShip(db, input('Monday', { date: '2026-09-28' }), T0);
    const tuesday = createMustShip(db, input('Tuesday'), T0);
    expect(refusal(() => patchMustShip(db, tuesday.id, { date: '2026-09-28' }, T1))).toMatchObject({ code: 'DAY_TAKEN' });
    expect(patchMustShip(db, tuesday.id, { date: '2026-09-29', title: 'Tuesday, renamed' }, T1)?.title).toBe('Tuesday, renamed');
    expect(patchMustShip(db, tuesday.id, { date: null }, T1)?.date).toBeNull();
  });

  it('closes on leaving planned and reopens on returning', () => {
    const made = createMustShip(db, input('Ship it'), T0);
    expect(patchMustShip(db, made.id, { status: 'shipped' }, T1)).toMatchObject({ status: 'shipped', closedAt: T1 });
    expect(patchMustShip(db, made.id, { status: 'partial' }, T0)?.closedAt).toBe(T1);
    expect(patchMustShip(db, made.id, { status: 'planned' }, T1)).toMatchObject({ status: 'planned', closedAt: null });
  });

  it('needs all three blocker fields to block', () => {
    const made = createMustShip(db, input('Ship it'), T0);
    expect(refusal(() => patchMustShip(db, made.id, { status: 'blocked', blockerWhat: 'Supplier silent' }, T1))).toMatchObject({
      status: 400,
      code: 'VALIDATION',
      message: 'a blocked must ship needs what blocks it, who owns it and the next action',
    });
    expect(getMustShip(db, made.id)?.status).toBe('planned');
    const blocked = patchMustShip(db, made.id, { status: 'blocked', blockerWhat: 'Supplier silent', blockerOwner: 'Bilal', blockerNextAction: 'Call the supplier' }, T1);
    expect(blocked).toMatchObject({ status: 'blocked', blockerOwner: 'Bilal' });
  });

  it('returns null for an unknown id', () => {
    expect(patchMustShip(db, '40000000-0000-4000-8000-000000000999', { title: 'x' }, T1)).toBeNull();
  });
});

describe('rollMustShip', () => {
  it('copies to the new date with lineage and one more roll; the original keeps its status', () => {
    const made = createMustShip(db, input('Tracker sent', { definitionOfDone: 'Sent to all 20' }), T0);
    patchMustShip(db, made.id, { status: 'partial' }, T0);
    const copy = rollMustShip(db, made.id, '2026-09-30', T1);
    expect(copy).toMatchObject({ title: 'Tracker sent', definitionOfDone: 'Sent to all 20', date: '2026-09-30', status: 'planned', rolledFromId: made.id, rollCount: 1, createdAt: T1 });
    expect(getMustShip(db, made.id)?.status).toBe('partial');
    expect(rollMustShip(db, copy!.id, '2026-10-01', T1)?.rollCount).toBe(2);
  });

  it('refuses shipped and killed Must Ships, its own day, and a taken day', () => {
    const shipped = createMustShip(db, input('Done', { date: '2026-09-28' }), T0);
    patchMustShip(db, shipped.id, { status: 'shipped' }, T0);
    expect(refusal(() => rollMustShip(db, shipped.id, '2026-09-30', T1))).toMatchObject({ code: 'VALIDATION', message: 'a shipped or killed must ship is not rolled forward' });
    const today = createMustShip(db, input('Today'), T0);
    expect(refusal(() => rollMustShip(db, today.id, '2026-09-29', T1))).toMatchObject({ code: 'VALIDATION', message: 'a must ship cannot be rolled onto its own day' });
    createMustShip(db, input('Tomorrow', { date: '2026-09-30' }), T0);
    expect(refusal(() => rollMustShip(db, today.id, '2026-09-30', T1))).toMatchObject({ code: 'DAY_TAKEN' });
    expect(rollMustShip(db, '40000000-0000-4000-8000-000000000999', '2026-09-30', T1)).toBeNull();
  });
});
