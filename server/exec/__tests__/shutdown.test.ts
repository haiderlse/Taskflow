import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { createMustShip, getMustShip, patchMustShip } from '../mustShips/store';
import { createBlock, getBlock, pauseBlock, startBlock } from '../deepWork/store';
import { createTask, listTasks } from '../tasks/store';
import { setDaySlots } from '../days/store';
import { shutDown } from '../days/shutdown';
import { blockMustShip } from '../mustShips/block';
import { ApiError } from '../http';
import type { Context } from '../../../src/shared/exec/schemas';

const DATE = '2026-09-29'; // a Tuesday
const T0 = '2026-09-29T03:00:00.000Z';
const CLOSE = '2026-09-29T12:05:00.000Z'; // 17:05 in Karachi
const LATER = '2026-09-29T13:00:00.000Z';
const BLOCKER = { what: 'No quote from the venue', owner: 'Sana', nextAction: 'Chase the venue quote' };
const WORK_DAYS = [1, 2, 3, 4, 5];
let db: Database.Database;

const ship = (context: Context = 'work', date: string | null = DATE) =>
  createMustShip(db, { title: 'Venue booked', context, date, definitionOfDone: '', outcomeId: null, projectId: null, notes: '' }, T0);

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

describe('shutDown', () => {
  it('refuses while the work Must Ship is planned and writes nothing', () => {
    ship();
    expect(refusal(() => shutDown(db, DATE, CLOSE, 0))).toMatchObject({
      status: 409,
      code: 'SHUTDOWN_NOT_READY',
      message: "grade today's Must Ship before closing the day",
    });
    expect(db.prepare('SELECT COUNT(*) FROM days').pluck().get()).toBe(0);
  });

  it('closes a graded day and a day with no Must Ship, whatever the build Must Ship says', () => {
    const work = ship();
    ship('build');
    patchMustShip(db, work.id, { status: 'partial' }, CLOSE);
    expect(shutDown(db, DATE, CLOSE, 0).day).toMatchObject({ date: DATE, shutdownAt: CLOSE });
    expect(shutDown(db, '2026-09-30', CLOSE, 0).day?.shutdownAt).toBe(CLOSE);
  });

  it("keeps the first stamp and the day's secondaries on a second call", () => {
    const task = createTask(db, { title: 'Memo', context: 'work', notes: '' }, T0);
    setDaySlots(db, DATE, [task.id], T0, 0);
    shutDown(db, DATE, CLOSE, 0);
    const again = shutDown(db, DATE, LATER, 0);
    expect(again.day?.shutdownAt).toBe(CLOSE);
    expect(again.secondaries.map((secondary) => secondary.task.id)).toEqual([task.id]);
  });

  it('ends a session still running as abandoned, folding its pause, and leaves the grade alone', () => {
    const work = ship();
    const block = createBlock(db, { date: DATE, context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null }, T0);
    startBlock(db, block.id, '2026-09-29T03:35:00.000Z');
    pauseBlock(db, block.id, '2026-09-29T04:00:00.000Z');
    patchMustShip(db, work.id, { status: 'missed' }, CLOSE);
    shutDown(db, DATE, CLOSE, 0);
    expect(getBlock(db, block.id)).toMatchObject({ result: 'abandoned', endedAt: CLOSE, pauseStartedAt: null, pausedSeconds: 29_100 });
    expect(getMustShip(db, work.id)?.status).toBe('missed');
  });
});

describe('blockMustShip', () => {
  it('writes the blocker and files the next action for the next work day', () => {
    const friday = ship('work', '2026-10-02');
    const result = blockMustShip(db, friday.id, BLOCKER, WORK_DAYS, CLOSE);
    expect(result?.mustShip).toMatchObject({
      status: 'blocked',
      blockerWhat: BLOCKER.what,
      blockerOwner: 'Sana',
      blockerNextAction: BLOCKER.nextAction,
      closedAt: CLOSE,
    });
    expect(result?.task).toMatchObject({
      title: BLOCKER.nextAction,
      notes: `Blocked: ${BLOCKER.what}`,
      status: 'waiting',
      ownerName: 'Sana',
      followUpDate: '2026-10-05',
      mustShipId: friday.id,
      context: 'work',
    });
  });

  it('refuses a Must Ship that is not planned or has no day, and writes nothing', () => {
    const shipped = ship();
    patchMustShip(db, shipped.id, { status: 'shipped' }, CLOSE);
    expect(refusal(() => blockMustShip(db, shipped.id, BLOCKER, WORK_DAYS, CLOSE)).message).toBe('only a planned must ship can be blocked');
    const candidate = ship('work', null);
    expect(refusal(() => blockMustShip(db, candidate.id, BLOCKER, WORK_DAYS, CLOSE)).message).toBe('a candidate has no day to be blocked on');
    expect(listTasks(db, {})).toHaveLength(0);
  });

  it('answers null for a missing Must Ship', () => {
    expect(blockMustShip(db, '40000000-0000-4000-8000-00000000dead', BLOCKER, WORK_DAYS, CLOSE)).toBeNull();
  });
});
