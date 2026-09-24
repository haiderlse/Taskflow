import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { createTask, getTask, listTasks, patchTask, rollTask, deleteTask } from '../tasks/store';
import { transitionStamps } from '../tasks/transitions';
import { ApiError } from '../http';

const T0 = '2026-09-22T03:00:00.000Z';
const T1 = '2026-09-22T03:05:00.000Z';
const T2 = '2026-09-22T03:10:00.000Z';
let db: Database.Database;

const capture = (title: string, context: 'work' | 'build' = 'work', now = T0) =>
  createTask(db, { title, context, notes: '' }, now);

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('createTask', () => {
  it('captures into the inbox with a server id and timestamps', () => {
    const task = capture('Call the supplier');
    expect(task).toMatchObject({
      title: 'Call the supplier',
      context: 'work',
      status: 'inbox',
      notes: '',
      rollCount: 0,
      capturedAt: T0,
      createdAt: T0,
      updatedAt: T0,
      processedAt: null,
      delegatedAt: null,
      closedAt: null,
      scheduledDate: null,
      ownerName: null,
    });
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getTask(db, task.id)).toEqual(task);
  });
});

describe('listTasks', () => {
  it('returns newest capture first', () => {
    capture('first', 'work', T0);
    capture('second', 'work', T1);
    capture('third', 'build', T2);
    expect(listTasks(db, {}).map((t) => t.title)).toEqual(['third', 'second', 'first']);
  });

  it('filters by status list and by context', () => {
    const a = capture('a', 'work');
    capture('b', 'build');
    patchTask(db, a.id, { status: 'later' }, T1);
    expect(listTasks(db, { status: ['later'] }).map((t) => t.title)).toEqual(['a']);
    expect(listTasks(db, { status: ['inbox', 'later'], context: 'build' }).map((t) => t.title)).toEqual(['b']);
  });

  it('returns this-week tasks and open tasks scheduled inside the week, never closed ones', () => {
    const committed = capture('committed');
    const scheduledIn = capture('scheduled in');
    const scheduledOut = capture('scheduled out');
    const done = capture('done');
    patchTask(db, committed.id, { status: 'this_week' }, T1);
    patchTask(db, scheduledIn.id, { status: 'later', scheduledDate: '2026-09-25' }, T1);
    patchTask(db, scheduledOut.id, { status: 'later', scheduledDate: '2026-09-27' }, T1);
    patchTask(db, done.id, { status: 'done', scheduledDate: '2026-09-24' }, T1);
    expect(listTasks(db, { week: '2026-09-20' }).map((t) => t.title).sort()).toEqual(['committed', 'scheduled in']);
  });

  it('returns delegated and waiting tasks whose follow-up is due', () => {
    const due = capture('due');
    const notYet = capture('not yet');
    const mine = capture('mine');
    patchTask(db, due.id, { status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-22' }, T1);
    patchTask(db, notYet.id, { status: 'waiting', ownerName: 'Supplier', followUpDate: '2026-09-30' }, T1);
    patchTask(db, mine.id, { status: 'this_week', followUpDate: '2026-09-22' }, T1);
    expect(listTasks(db, { followUpBy: '2026-09-22' }).map((t) => t.title)).toEqual(['due']);
  });
});

describe('patchTask', () => {
  it('stamps processedAt once, on first leaving the inbox', () => {
    const task = capture('x');
    const later = patchTask(db, task.id, { status: 'later' }, T1);
    expect(later).toMatchObject({ status: 'later', processedAt: T1, updatedAt: T1 });
    const thisWeek = patchTask(db, task.id, { status: 'this_week' }, T2);
    expect(thisWeek?.processedAt).toBe(T1);
  });

  it('stamps delegatedAt when a task is handed off and requires an owner', () => {
    const task = capture('x');
    expect(() => patchTask(db, task.id, { status: 'delegated' }, T1)).toThrow(ApiError);
    expect(() => patchTask(db, task.id, { status: 'waiting' }, T1)).toThrow(/ownerName is required/);
    const delegated = patchTask(db, task.id, { status: 'delegated', ownerName: 'Bilal', expectedOutput: 'The tracker' }, T1);
    expect(delegated).toMatchObject({ status: 'delegated', ownerName: 'Bilal', delegatedAt: T1, processedAt: T1 });
  });

  it('accepts a hand-off when the owner was set earlier', () => {
    const task = capture('x');
    patchTask(db, task.id, { ownerName: 'Bilal' }, T1);
    expect(patchTask(db, task.id, { status: 'waiting' }, T2)?.status).toBe('waiting');
  });

  it('stamps closedAt on done or killed and clears it on reopen', () => {
    const task = capture('x');
    expect(patchTask(db, task.id, { status: 'killed' }, T1)?.closedAt).toBe(T1);
    expect(patchTask(db, task.id, { status: 'later' }, T2)).toMatchObject({ status: 'later', closedAt: null });
  });

  it('edits fields without touching status stamps and returns null for an unknown id', () => {
    const task = capture('x');
    const edited = patchTask(db, task.id, { title: 'y', notes: 'n', dueDate: '2026-09-30' }, T1);
    expect(edited).toMatchObject({ title: 'y', notes: 'n', dueDate: '2026-09-30', status: 'inbox', processedAt: null });
    expect(patchTask(db, 'missing', { title: 'z' }, T1)).toBeNull();
  });
});

describe('rollTask', () => {
  it('moves the scheduled date forward and counts the roll', () => {
    const task = capture('x');
    const rolled = rollTask(db, task.id, '2026-09-23', T1);
    expect(rolled).toMatchObject({ scheduledDate: '2026-09-23', rollCount: 1, rolledAt: T1, updatedAt: T1 });
    expect(rollTask(db, task.id, '2026-09-24', T2)?.rollCount).toBe(2);
    expect(rollTask(db, 'missing', '2026-09-24', T2)).toBeNull();
  });
});

describe('deleteTask', () => {
  it('deletes only inbox items', () => {
    const inbox = capture('inbox');
    const later = capture('later');
    patchTask(db, later.id, { status: 'later' }, T1);
    expect(deleteTask(db, inbox.id)).toBe('deleted');
    expect(getTask(db, inbox.id)).toBeNull();
    expect(deleteTask(db, later.id)).toBe('not_allowed');
    expect(deleteTask(db, 'missing')).toBe('missing');
  });
});

describe('transitionStamps', () => {
  it('is empty when the status does not change', () => {
    expect(transitionStamps('later', 'later', T0, T1)).toEqual({});
  });
});
