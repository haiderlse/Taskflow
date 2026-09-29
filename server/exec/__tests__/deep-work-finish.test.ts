import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { createMustShip, getMustShip, patchMustShip } from '../mustShips/store';
import { createBlock, getBlock, pauseBlock, startBlock } from '../deepWork/store';
import { finishBlock } from '../deepWork/finish';
import { ApiError } from '../http';
import type { DeepWorkCreate, DeepWorkFinish } from '../../../src/shared/exec/deepWorkSchemas';

const T0 = '2026-09-29T03:00:00.000Z';
const T1 = '2026-09-29T03:35:00.000Z';
const T2 = '2026-09-29T03:45:00.000Z';
const T3 = '2026-09-29T04:05:00.000Z';
const BLOCKER = { what: 'Supplier has not replied', owner: 'Bilal', nextAction: 'Call Bilal about the tracker' };
let db: Database.Database;
let weekId: string;

const plan = (overrides: Partial<DeepWorkCreate> = {}): DeepWorkCreate => ({ date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null, ...overrides });
const done = (result: DeepWorkFinish['result'], extra: Partial<DeepWorkFinish> = {}): DeepWorkFinish => ({ result, notes: '', ...extra });
const outcome = () =>
  addOutcome(db, weekId, { title: 'Supplier plan confirmed', category: 'office', description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, T0);
const ship = (outcomeId: string | null = null) =>
  createMustShip(db, { title: 'Delivery tracker sent', context: 'work', date: '2026-09-29', definitionOfDone: '', outcomeId, projectId: null, notes: '' }, T0);
/** A started block, linked to the day's Must Ship by the start. */
const running = (context: 'work' | 'build' = 'work') => {
  const made = createBlock(db, plan({ context }), T0);
  return startBlock(db, made.id, T1)!;
};

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

describe('finishBlock', () => {
  it('ends the block with its result and notes, and ships the Must Ship on completed', () => {
    const planned = ship();
    const block = running();
    const finished = finishBlock(db, block.id, done('completed', { notes: 'Sent to all 20' }), T3)!;
    expect(finished.block).toMatchObject({ endedAt: T3, result: 'completed', notes: 'Sent to all 20', mustShipId: planned.id });
    expect(finished.mustShip).toMatchObject({ id: planned.id, status: 'shipped', closedAt: T3 });
    expect(finished.task).toBeNull();
  });

  it('leaves the Must Ship planned on progress and on abandoned', () => {
    const planned = ship();
    const first = running();
    finishBlock(db, first.id, done('progress'), T2);
    expect(getMustShip(db, planned.id)?.status).toBe('planned');
    const second = createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    startBlock(db, second.id, T3);
    expect(finishBlock(db, second.id, done('abandoned'), '2026-09-29T04:30:00.000Z')!.mustShip?.status).toBe('planned');
  });

  it('never revives a killed Must Ship', () => {
    const killed = ship();
    const block = running();
    patchMustShip(db, killed.id, { status: 'killed' }, T2);
    expect(finishBlock(db, block.id, done('completed'), T3)!.mustShip?.status).toBe('killed');
  });

  it('blocks the Must Ship and files a waiting task owned by the blocker, due the next day', () => {
    const linked = outcome();
    const planned = ship(linked.id);
    const block = running();
    const finished = finishBlock(db, block.id, done('blocked', { blocker: BLOCKER }), T3)!;
    expect(finished.mustShip).toMatchObject({ status: 'blocked', blockerWhat: BLOCKER.what, blockerOwner: 'Bilal', blockerNextAction: BLOCKER.nextAction, closedAt: T3 });
    expect(finished.task).toMatchObject({
      title: 'Call Bilal about the tracker',
      notes: 'Blocked: Supplier has not replied',
      context: 'work',
      status: 'waiting',
      ownerName: 'Bilal',
      followUpDate: '2026-09-30',
      mustShipId: planned.id,
      outcomeId: linked.id,
      capturedAt: T3,
      processedAt: T3,
      delegatedAt: T3,
    });
  });

  it('still files the task when the block has no Must Ship, as a build session on an outcome would', () => {
    const made = createBlock(db, plan({ context: 'build' }), T0);
    startBlock(db, made.id, T1);
    const finished = finishBlock(db, made.id, done('blocked', { blocker: BLOCKER }), T3)!;
    expect(finished.mustShip).toBeNull();
    expect(finished.task).toMatchObject({ context: 'build', status: 'waiting', ownerName: 'Bilal', mustShipId: null });
  });

  it('folds an open pause into the paused seconds', () => {
    ship();
    const block = running();
    pauseBlock(db, block.id, T2);
    const finished = finishBlock(db, block.id, done('progress'), T3)!;
    expect(finished.block).toMatchObject({ pauseStartedAt: null, pausedSeconds: 1200, endedAt: T3 });
  });

  it('refuses a block that never started, one already finished, and a blocked result with no blocker, changing nothing', () => {
    const planned = ship();
    const idle = createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    expect(refusal(() => finishBlock(db, idle.id, done('progress'), T3))).toMatchObject({ status: 400, message: 'a block must be started before it can finish' });
    const block = running();
    expect(refusal(() => finishBlock(db, block.id, done('blocked'), T3))).toMatchObject({ message: 'a blocked session needs a blocker' });
    expect(getBlock(db, block.id)).toMatchObject({ endedAt: null, result: null });
    expect(getMustShip(db, planned.id)?.status).toBe('planned');
    finishBlock(db, block.id, done('progress'), T3);
    expect(refusal(() => finishBlock(db, block.id, done('completed'), T3))).toMatchObject({ message: 'that block has already finished' });
  });

  it('answers null for an unknown block', () => {
    expect(finishBlock(db, '50000000-0000-4000-8000-000000000999', done('progress'), T3)).toBeNull();
  });
});
