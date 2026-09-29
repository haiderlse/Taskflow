import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { createTask, getTask, patchTask } from '../tasks/store';
import { ensureWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { createMustShip } from '../mustShips/store';
import { getDayView, setDaySlots } from '../days/store';
import { ApiError } from '../http';

const T0 = '2026-09-29T03:00:00.000Z';
const T1 = '2026-09-29T03:05:00.000Z';
const DATE = '2026-09-29';
let db: Database.Database;

const capture = (title: string) => createTask(db, { title, context: 'work', notes: '' }, T0);
const mustShip = (title: string, context: 'work' | 'build', date: string | null = DATE) =>
  createMustShip(db, { title, context, date, definitionOfDone: '', outcomeId: null, projectId: null, notes: '' }, T0);

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('getDayView', () => {
  it('describes an empty day without creating anything', () => {
    expect(getDayView(db, DATE, 0)).toEqual({
      date: DATE, day: null, week: null, hasHistory: false, mustShip: null, buildMustShip: null,
      secondaries: [], waiting: [], blocks: [], inboxCount: 0,
    });
    expect(db.prepare('SELECT COUNT(*) FROM days').pluck().get()).toBe(0);
  });

  it('gathers the week, both Must Ships, the waiting items due, the blocks and the inbox count', () => {
    const weekId = ensureWeek(db, DATE, 0, T0).view.week.id;
    addOutcome(db, weekId, { title: 'Supplier plan confirmed', category: 'office', description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, T0);
    mustShip('Tracker sent', 'work');
    mustShip('Landing page live', 'build');
    mustShip('Someday', 'work', null);
    capture('Still in the inbox');
    const due = capture('Chase Bilal');
    patchTask(db, due.id, { status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-28' }, T1);
    const later = capture('Not yet');
    patchTask(db, later.id, { status: 'waiting', ownerName: 'Sara', followUpDate: '2026-10-02' }, T1);
    db.prepare(
      `INSERT INTO deep_work_blocks (id, date, context, planned_start, planned_minutes, created_at, updated_at)
       VALUES ('50000000-0000-4000-8000-000000000001', ?, 'work', '08:35', 90, ?, ?)`
    ).run(DATE, T0, T0);
    const view = getDayView(db, DATE, 0);
    expect(view.week?.outcomes.map((outcome) => outcome.title)).toEqual(['Supplier plan confirmed']);
    expect(view.mustShip?.title).toBe('Tracker sent');
    expect(view.buildMustShip?.title).toBe('Landing page live');
    expect(view.waiting.map((task) => task.title)).toEqual(['Chase Bilal']);
    expect(view.blocks).toMatchObject([{ plannedStart: '08:35', plannedMinutes: 90, mustShipId: null }]);
    expect(view.inboxCount).toBe(1);
  });
});

describe('setDaySlots', () => {
  it('fills the two slots in order, creates the day, and processes an inbox task onto today', () => {
    const inbox = capture('Send the price list');
    const committed = capture('Review the dashboard');
    patchTask(db, committed.id, { status: 'this_week' }, T0);
    const view = setDaySlots(db, DATE, [committed.id, inbox.id], T1, 0);
    expect(view.secondaries.map((secondary) => [secondary.slot, secondary.task.title])).toEqual([[1, 'Review the dashboard'], [2, 'Send the price list']]);
    expect(view.day).toMatchObject({ date: DATE, shutdownAt: null });
    expect(getTask(db, inbox.id)).toMatchObject({ status: 'this_week', scheduledDate: DATE, processedAt: T1 });
    expect(getTask(db, committed.id)?.scheduledDate).toBeNull();
  });

  it('moves a later task onto this week when it becomes a secondary', () => {
    const parked = capture('Parked idea');
    patchTask(db, parked.id, { status: 'later' }, T0);
    setDaySlots(db, DATE, [parked.id], T1, 0);
    expect(getTask(db, parked.id)).toMatchObject({ status: 'this_week', scheduledDate: DATE });
  });

  it('replaces the slots rather than adding to them', () => {
    const a = capture('A');
    const b = capture('B');
    setDaySlots(db, DATE, [a.id, b.id], T0, 0);
    expect(setDaySlots(db, DATE, [b.id], T1, 0).secondaries.map((secondary) => [secondary.slot, secondary.task.title])).toEqual([[1, 'B']]);
    expect(setDaySlots(db, DATE, [], T1, 0).secondaries).toEqual([]);
  });

  it('refuses a third secondary, a repeat and an unknown task, changing nothing', () => {
    const [a, b, c] = ['A', 'B', 'C'].map(capture);
    setDaySlots(db, DATE, [a.id], T0, 0);
    const attempt = (ids: string[]) => {
      try {
        setDaySlots(db, DATE, ids, T1, 0);
      } catch (error) {
        return error as ApiError;
      }
      throw new Error('expected a refusal');
    };
    expect(attempt([a.id, b.id, c.id])).toMatchObject({ status: 400, code: 'SLOT_LIMIT', message: 'a day holds at most two secondary tasks' });
    expect(attempt([b.id, b.id])).toMatchObject({ status: 400, code: 'VALIDATION', message: 'a task can fill only one slot' });
    expect(attempt([b.id, '00000000-0000-4000-8000-000000000999'])).toMatchObject({ status: 400, code: 'VALIDATION', message: 'no such task' });
    expect(getDayView(db, DATE, 0).secondaries.map((secondary) => secondary.task.title)).toEqual(['A']);
    expect(getTask(db, b.id)?.status).toBe('inbox');
  });
});
