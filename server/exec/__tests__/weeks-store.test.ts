import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek, lookupWeek, getWeekView, findWeekByStart } from '../weeks/store';
import { addOutcome, patchOutcome } from '../outcomes/store';
import type { OutcomeCreate } from '../../../src/shared/exec/schemas';

const T0 = '2026-09-22T03:00:00.000Z';
const T1 = '2026-09-22T03:05:00.000Z';
let db: Database.Database;

const input = (title: string): OutcomeCreate => ({
  title,
  category: 'office',
  description: '',
  definitionOfDone: 'It exists',
  targetDate: null,
  projectId: null,
  notes: '',
});

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('ensureWeek', () => {
  it('creates the week containing the date once, starting on the configured weekday', () => {
    const first = ensureWeek(db, '2026-09-23', 0, T0);
    expect(first.created).toBe(true);
    expect(first.view.week).toMatchObject({ startDate: '2026-09-20', reviewedAt: null, reviewNotes: '', createdAt: T0, updatedAt: T0 });
    expect(first.view.outcomes).toEqual([]);

    const again = ensureWeek(db, '2026-09-26', 0, T1);
    expect(again.created).toBe(false);
    expect(again.view.week.id).toBe(first.view.week.id);

    expect(ensureWeek(db, '2026-09-23', 1, T0).view.week.startDate).toBe('2026-09-21');
  });
});

describe('lookupWeek', () => {
  it('finds nothing and creates nothing on a fresh database', () => {
    expect(lookupWeek(db, '2026-09-23', 0)).toEqual({ current: null, previous: null, hasHistory: false });
    expect(findWeekByStart(db, '2026-09-20')).toBeNull();
  });

  it('returns the current and previous views and reports history from an earlier week', () => {
    const previous = ensureWeek(db, '2026-09-15', 0, T0).view.week;
    addOutcome(db, previous.id, input('Last week'), T0);
    const current = ensureWeek(db, '2026-09-22', 0, T0).view.week;

    const lookup = lookupWeek(db, '2026-09-24', 0);
    expect(lookup.current?.week.id).toBe(current.id);
    expect(lookup.previous?.week.id).toBe(previous.id);
    expect(lookup.previous?.outcomes.map((o) => o.title)).toEqual(['Last week']);
    expect(lookup.hasHistory).toBe(true);
  });

  it("does not count the current week's own outcomes as history", () => {
    const current = ensureWeek(db, '2026-09-22', 0, T0).view.week;
    addOutcome(db, current.id, input('This week'), T0);
    expect(lookupWeek(db, '2026-09-22', 0).hasHistory).toBe(false);
  });
});

describe('getWeekView', () => {
  it('lists slotted outcomes by slot with killed ones last, and returns null for an unknown id', () => {
    const week = ensureWeek(db, '2026-09-22', 0, T0).view.week;
    const a = addOutcome(db, week.id, input('A'), T0);
    addOutcome(db, week.id, input('B'), T0);
    patchOutcome(db, a.id, { status: 'killed' }, T1);
    addOutcome(db, week.id, input('C'), T1); // takes the slot A released
    expect(getWeekView(db, week.id)?.outcomes.map((o) => [o.title, o.slot])).toEqual([
      ['C', 1],
      ['B', 2],
      ['A', null],
    ]);
    expect(getWeekView(db, 'missing')).toBeNull();
  });
});
