import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { createMustShip } from '../mustShips/store';
import { createBlock, getBlock, listBlocks, patchBlock, pauseBlock, resumeBlock, startBlock } from '../deepWork/store';
import { ApiError } from '../http';
import type { DeepWorkCreate } from '../../../src/shared/exec/deepWorkSchemas';

const T0 = '2026-09-29T03:00:00.000Z';
const T1 = '2026-09-29T03:35:00.000Z';
const T2 = '2026-09-29T03:45:00.000Z';
const T3 = '2026-09-29T03:50:00.000Z';
const MISSING = '50000000-0000-4000-8000-000000000999';
let db: Database.Database;
let weekId: string;

const plan = (overrides: Partial<DeepWorkCreate> = {}): DeepWorkCreate => ({
  date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null, ...overrides,
});
const outcome = (category: 'office' | 'business', title = 'Supplier plan confirmed') =>
  addOutcome(db, weekId, { title, category, description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, T0);
const mustShip = (context: 'work' | 'build' = 'work', date = '2026-09-29') =>
  createMustShip(db, { title: 'Delivery tracker sent', context, date, definitionOfDone: '', outcomeId: null, projectId: null, notes: '' }, T0);

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
  weekId = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
});

describe('createBlock', () => {
  it('plans an unstarted block with server-set fields', () => {
    const made = createBlock(db, plan(), T0);
    expect(made).toMatchObject({ date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null, startedAt: null, endedAt: null, pausedSeconds: 0, pauseStartedAt: null, result: null, notes: '', createdAt: T0 });
    expect(getBlock(db, made.id)).toEqual(made);
  });

  it('links an active outcome of the week and context, and a Must Ship of the day and context', () => {
    const linked = outcome('office');
    const ship = mustShip();
    const made = createBlock(db, plan({ outcomeId: linked.id, mustShipId: ship.id }), T0);
    expect(made).toMatchObject({ outcomeId: linked.id, mustShipId: ship.id });
  });

  it('refuses a block that overlaps an unfinished one, but not one that only touches it, or a finished one', () => {
    const first = createBlock(db, plan(), T0);
    expect(refusal(() => createBlock(db, plan({ plannedStart: '09:30', plannedMinutes: 30 }), T0))).toMatchObject({ status: 400, code: 'VALIDATION', message: 'that time overlaps another block' });
    expect(createBlock(db, plan({ plannedStart: '10:05', plannedMinutes: 30 }), T0).plannedStart).toBe('10:05');
    db.prepare("UPDATE deep_work_blocks SET started_at = ?, ended_at = ?, result = 'progress' WHERE id = ?").run(T1, T2, first.id);
    expect(createBlock(db, plan({ plannedStart: '08:45', plannedMinutes: 15 }), T0).plannedStart).toBe('08:45');
  });

  it('refuses a block that would run past midnight', () => {
    expect(refusal(() => createBlock(db, plan({ plannedStart: '23:00', plannedMinutes: 90 }), T0))).toMatchObject({ message: 'a block must end by midnight' });
    expect(createBlock(db, plan({ plannedStart: '22:30', plannedMinutes: 90 }), T0).plannedStart).toBe('22:30');
  });

  it('refuses an outcome that is unknown, killed, from another week, or of the other context', () => {
    expect(refusal(() => createBlock(db, plan({ outcomeId: MISSING }), T0))).toMatchObject({ message: 'no such outcome' });
    const killed = outcome('office', 'Killed one');
    db.prepare("UPDATE outcomes SET status = 'killed', slot = NULL WHERE id = ?").run(killed.id);
    expect(refusal(() => createBlock(db, plan({ outcomeId: killed.id }), T0))).toMatchObject({ message: 'that outcome is not active this week' });
    const office = outcome('office');
    expect(refusal(() => createBlock(db, plan({ date: '2026-10-06', outcomeId: office.id }), T0))).toMatchObject({ message: 'that outcome belongs to another week' });
    const business = outcome('business', 'Healify beta live');
    expect(refusal(() => createBlock(db, plan({ outcomeId: business.id }), T0))).toMatchObject({ message: 'that outcome belongs to the other context' });
    expect(createBlock(db, plan({ context: 'build', outcomeId: business.id }), T0).outcomeId).toBe(business.id);
  });

  it('refuses a Must Ship that is unknown or belongs to another day or context', () => {
    expect(refusal(() => createBlock(db, plan({ mustShipId: MISSING }), T0))).toMatchObject({ message: 'no such must ship' });
    const otherDay = mustShip('work', '2026-09-30');
    expect(refusal(() => createBlock(db, plan({ mustShipId: otherDay.id }), T0))).toMatchObject({ message: 'that must ship is for another day or context' });
    const build = mustShip('build');
    expect(refusal(() => createBlock(db, plan({ mustShipId: build.id }), T0))).toMatchObject({ message: 'that must ship is for another day or context' });
  });
});

describe('listBlocks', () => {
  it('lists a date range inclusively, by date then start', () => {
    createBlock(db, plan({ date: '2026-09-30' }), T0);
    createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    createBlock(db, plan(), T0);
    createBlock(db, plan({ date: '2026-10-05' }), T0);
    expect(listBlocks(db, { from: '2026-09-29', to: '2026-09-30' }).map((block) => `${block.date} ${block.plannedStart}`)).toEqual([
      '2026-09-29 08:35',
      '2026-09-29 14:00',
      '2026-09-30 08:35',
    ]);
  });
});

describe('patchBlock', () => {
  it('assigns an outcome and moves the time before the block starts', () => {
    const made = createBlock(db, plan(), T0);
    const linked = outcome('office');
    const patched = patchBlock(db, made.id, { outcomeId: linked.id, plannedStart: '09:00', plannedMinutes: 60 }, T1);
    expect(patched).toMatchObject({ outcomeId: linked.id, plannedStart: '09:00', plannedMinutes: 60, updatedAt: T1 });
    expect(patchBlock(db, made.id, { outcomeId: null }, T1)?.outcomeId).toBeNull();
  });

  it('checks the new time against the other blocks but not against itself', () => {
    const first = createBlock(db, plan(), T0);
    createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    expect(patchBlock(db, first.id, { plannedMinutes: 120 }, T1)?.plannedMinutes).toBe(120);
    expect(refusal(() => patchBlock(db, first.id, { plannedMinutes: 400 }, T1))).toMatchObject({ message: 'that time overlaps another block' });
    expect(getBlock(db, first.id)?.plannedMinutes).toBe(120);
  });

  it('refuses a started block and answers null for an unknown one', () => {
    const made = createBlock(db, plan(), T0);
    startBlock(db, made.id, T1);
    expect(refusal(() => patchBlock(db, made.id, { plannedMinutes: 30 }, T2))).toMatchObject({ message: 'a started block cannot be changed' });
    expect(patchBlock(db, MISSING, { plannedMinutes: 30 }, T2)).toBeNull();
  });
});

describe('startBlock', () => {
  it('starts once, and a second start changes nothing', () => {
    const made = createBlock(db, plan(), T0);
    expect(startBlock(db, made.id, T1)).toMatchObject({ startedAt: T1 });
    expect(startBlock(db, made.id, T2)?.startedAt).toBe(T1);
  });

  it('takes the day\'s Must Ship of the block\'s context, and its outcome when the block has none', () => {
    const linked = outcome('office');
    const ship = createMustShip(db, { title: 'Delivery tracker sent', context: 'work', date: '2026-09-29', definitionOfDone: '', outcomeId: linked.id, projectId: null, notes: '' }, T0);
    mustShip('build');
    const made = createBlock(db, plan(), T0);
    expect(startBlock(db, made.id, T1)).toMatchObject({ mustShipId: ship.id, outcomeId: linked.id });
  });

  it('keeps an outcome the block already has, and starts fine with no Must Ship at all', () => {
    const planned = outcome('office', 'Planned outcome');
    const made = createBlock(db, plan({ outcomeId: planned.id }), T0);
    expect(startBlock(db, made.id, T1)).toMatchObject({ outcomeId: planned.id, mustShipId: null });
  });

  it('refuses a second running block on the day, but ignores one left running on an earlier date', () => {
    const stale = createBlock(db, plan({ date: '2026-09-28' }), T0);
    startBlock(db, stale.id, '2026-09-28T03:35:00.000Z');
    const first = createBlock(db, plan(), T0);
    const second = createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    expect(startBlock(db, first.id, T1)).toMatchObject({ startedAt: T1 });
    expect(refusal(() => startBlock(db, second.id, T2))).toMatchObject({ status: 400, message: 'another block is already running' });
    expect(getBlock(db, second.id)?.startedAt).toBeNull();
  });

  it('refuses a finished block and answers null for an unknown one', () => {
    const made = createBlock(db, plan(), T0);
    db.prepare("UPDATE deep_work_blocks SET started_at = ?, ended_at = ?, result = 'progress' WHERE id = ?").run(T1, T2, made.id);
    expect(refusal(() => startBlock(db, made.id, T3))).toMatchObject({ message: 'that block has already finished' });
    expect(startBlock(db, MISSING, T3)).toBeNull();
  });
});

describe('pauseBlock and resumeBlock', () => {
  it('pauses, and pausing again changes nothing', () => {
    const made = createBlock(db, plan(), T0);
    startBlock(db, made.id, T1);
    expect(pauseBlock(db, made.id, T2)).toMatchObject({ pauseStartedAt: T2, pausedSeconds: 0 });
    expect(pauseBlock(db, made.id, T3)?.pauseStartedAt).toBe(T2);
  });

  it('folds the paused time into paused_seconds on resume, and resuming again changes nothing', () => {
    const made = createBlock(db, plan(), T0);
    startBlock(db, made.id, T1);
    pauseBlock(db, made.id, T2);
    expect(resumeBlock(db, made.id, T3)).toMatchObject({ pauseStartedAt: null, pausedSeconds: 300 });
    expect(resumeBlock(db, made.id, '2026-09-29T04:30:00.000Z')?.pausedSeconds).toBe(300);
  });

  it('refuses to pause a block that is not running, and answers null for an unknown one', () => {
    const made = createBlock(db, plan(), T0);
    expect(refusal(() => pauseBlock(db, made.id, T2))).toMatchObject({ message: 'that block is not running' });
    expect(pauseBlock(db, MISSING, T2)).toBeNull();
    expect(resumeBlock(db, MISSING, T2)).toBeNull();
  });
});
