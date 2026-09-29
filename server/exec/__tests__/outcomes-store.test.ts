import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome, getOutcome, patchOutcome, rollOutcome } from '../outcomes/store';
import { ApiError } from '../http';
import type { OutcomeCreate } from '../../../src/shared/exec/schemas';

const T0 = '2026-09-22T03:00:00.000Z';
const T1 = '2026-09-22T03:05:00.000Z';
let db: Database.Database;
let weekId: string;

const input = (title: string, overrides: Partial<OutcomeCreate> = {}): OutcomeCreate => ({
  title,
  category: 'office',
  description: '',
  definitionOfDone: 'It exists',
  targetDate: null,
  projectId: null,
  notes: '',
  ...overrides,
});
const fill = (...titles: string[]) => titles.map((title) => addOutcome(db, weekId, input(title), T0));

beforeEach(() => {
  db = prepareExecDb(':memory:');
  weekId = ensureWeek(db, '2026-09-22', 0, T0).view.week.id;
});

describe('addOutcome', () => {
  it('fills the lowest free slot with server-set fields', () => {
    const a = addOutcome(db, weekId, input('A', { targetDate: '2026-09-25' }), T0);
    expect(a).toMatchObject({ weekId, slot: 1, title: 'A', status: 'active', progress: 0, targetDate: '2026-09-25', rolledFromId: null, closedAt: null, createdAt: T0 });
    expect(addOutcome(db, weekId, input('B'), T0).slot).toBe(2);
  });

  it('refuses a fourth outcome with WEEK_FULL listing the three', () => {
    fill('A', 'B', 'C');
    let caught: unknown;
    try {
      addOutcome(db, weekId, input('D'), T0);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ status: 409, code: 'WEEK_FULL', message: 'the week already has three outcomes' });
    expect((caught as ApiError).details).toMatchObject({ outcomes: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] });
  });

  it('reuses the slot a killed outcome released', () => {
    const [, b] = fill('A', 'B', 'C');
    patchOutcome(db, b.id, { status: 'killed' }, T1);
    expect(addOutcome(db, weekId, input('D'), T1).slot).toBe(2);
  });

  it('replaces atomically: kills the named outcome with its reason and takes its slot', () => {
    const [, b] = fill('A', 'B', 'C');
    const d = addOutcome(db, weekId, input('D', { replace: { outcomeId: b.id, reason: 'priority_changed' } }), T1);
    expect(d.slot).toBe(2);
    expect(getOutcome(db, b.id)).toMatchObject({ status: 'killed', slot: null, reviewReason: 'priority_changed', closedAt: T1 });
  });

  it('refuses to replace an outcome from another week and changes nothing', () => {
    const otherWeek = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
    const foreign = addOutcome(db, otherWeek, input('Elsewhere'), T0);
    fill('A', 'B', 'C');
    expect(() => addOutcome(db, weekId, input('D', { replace: { outcomeId: foreign.id, reason: 'other' } }), T1)).toThrow(
      /the outcome to replace is not in this week/
    );
    expect(getOutcome(db, foreign.id)?.status).toBe('active');
  });
});

describe('patchOutcome', () => {
  it('edits fields and returns null for an unknown id', () => {
    const [a] = fill('A');
    expect(patchOutcome(db, a.id, { title: 'A2', progress: 60, notes: 'n' }, T1)).toMatchObject({ title: 'A2', progress: 60, notes: 'n', updatedAt: T1 });
    expect(patchOutcome(db, 'missing', { title: 'x' }, T1)).toBeNull();
  });

  it('marking done sets progress 100 and closedAt; reopening clears closedAt and keeps the slot', () => {
    const [a] = fill('A');
    expect(patchOutcome(db, a.id, { status: 'done' }, T1)).toMatchObject({ status: 'done', progress: 100, closedAt: T1, slot: 1 });
    expect(patchOutcome(db, a.id, { status: 'active' }, T1)).toMatchObject({ status: 'active', closedAt: null, slot: 1 });
  });

  it('keeps a done outcome at progress 100 when it is edited, still applying the other fields', () => {
    const [a] = fill('A');
    patchOutcome(db, a.id, { status: 'done' }, T1);
    expect(patchOutcome(db, a.id, { progress: 40, title: 'A2' }, T1)).toMatchObject({ status: 'done', progress: 100, title: 'A2' });
    expect(patchOutcome(db, a.id, { status: 'done', progress: 40 }, T1)).toMatchObject({ status: 'done', progress: 100 });
  });

  it('killing frees the slot and stamps closedAt, and a killed outcome cannot be reopened', () => {
    const [a] = fill('A');
    expect(patchOutcome(db, a.id, { status: 'killed', reviewReason: 'no_longer_important' }, T1)).toMatchObject({
      status: 'killed',
      slot: null,
      closedAt: T1,
      reviewReason: 'no_longer_important',
    });
    expect(() => patchOutcome(db, a.id, { status: 'active' }, T1)).toThrow(/a killed outcome cannot be reopened/);
    expect(patchOutcome(db, a.id, { notes: 'why' }, T1)?.notes).toBe('why');
  });
});

describe('rollOutcome', () => {
  let nextWeekId: string;
  beforeEach(() => {
    nextWeekId = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
  });

  it('copies into the target week with lineage, progress and a Friday target', () => {
    const [a] = fill('A');
    patchOutcome(db, a.id, { progress: 40 }, T0);
    const result = rollOutcome(db, a.id, nextWeekId, T1);
    expect(result?.created).toBe(true);
    expect(result?.outcome).toMatchObject({ weekId: nextWeekId, slot: 1, title: 'A', progress: 40, rolledFromId: a.id, targetDate: '2026-10-02', status: 'active', createdAt: T1 });
    expect(getOutcome(db, a.id)).toMatchObject({ status: 'active', slot: 1 });
  });

  it('returns the existing copy when rolled into the same week again', () => {
    const [a] = fill('A');
    const first = rollOutcome(db, a.id, nextWeekId, T1);
    const second = rollOutcome(db, a.id, nextWeekId, T1);
    expect(second).toMatchObject({ created: false, outcome: { id: first?.outcome.id } });
  });

  it('refuses a finished outcome, its own week and a full target week', () => {
    const [a, b] = fill('A', 'B');
    patchOutcome(db, a.id, { status: 'done' }, T1);
    expect(() => rollOutcome(db, a.id, nextWeekId, T1)).toThrow(/a finished outcome is not rolled forward/);
    expect(() => rollOutcome(db, b.id, weekId, T1)).toThrow(/cannot be rolled into its own week/);
    ['X', 'Y', 'Z'].forEach((title) => addOutcome(db, nextWeekId, input(title), T0));
    expect(() => rollOutcome(db, b.id, nextWeekId, T1)).toThrow(/the week already has three outcomes/);
  });

  it('returns null for an unknown outcome and refuses an unknown week', () => {
    const [a] = fill('A');
    expect(rollOutcome(db, 'missing', nextWeekId, T1)).toBeNull();
    expect(() => rollOutcome(db, a.id, 'missing', T1)).toThrow(/no such week/);
  });
});
