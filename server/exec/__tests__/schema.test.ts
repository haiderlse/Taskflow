import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { currentVersion } from '../db/migrate';

const NOW = '2026-09-22T03:00:00.000Z';
let db: Database.Database;

const insertWeek = (id = 'w1', startDate = '2026-09-20') =>
  db.prepare('INSERT INTO weeks (id, start_date, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, startDate, NOW, NOW);

const insertOutcome = (id: string, slot: number | null, status = 'active') =>
  db
    .prepare(
      `INSERT INTO outcomes (id, week_id, slot, title, category, status, created_at, updated_at)
       VALUES (?, 'w1', ?, 'Outcome', 'office', ?, ?, ?)`
    )
    .run(id, slot, status, NOW, NOW);

const insertMustShip = (id: string, date: string | null, context: string) =>
  db
    .prepare(
      `INSERT INTO must_ships (id, title, context, date, created_at, updated_at) VALUES (?, 'Ship it', ?, ?, ?, ?)`
    )
    .run(id, context, date, NOW, NOW);

const insertTask = (id: string) =>
  db
    .prepare(`INSERT INTO tasks (id, title, context, captured_at, created_at, updated_at) VALUES (?, 'Task', 'work', ?, ?, ?)`)
    .run(id, NOW, NOW, NOW);

const insertDay = (date: string) =>
  db.prepare('INSERT INTO days (date, created_at, updated_at) VALUES (?, ?, ?)').run(date, NOW, NOW);

const insertSlot = (date: string, slot: number, taskId: string) =>
  db.prepare('INSERT INTO day_slots (date, slot, task_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(date, slot, taskId, NOW, NOW);

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('001_init', () => {
  it('reaches schema version 1 with the nine tables and the ledger', () => {
    expect(currentVersion(db)).toBe(1);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all();
    expect(names).toEqual([
      'day_slots',
      'days',
      'deep_work_blocks',
      'must_ships',
      'outcomes',
      'projects',
      'schema_migrations',
      'settings',
      'tasks',
      'weeks',
    ]);
  });

  it('seeds exactly one settings row with the default schedule and no other data', () => {
    const settings = db.prepare('SELECT * FROM settings').all() as Record<string, unknown>[];
    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({
      id: 1,
      timezone: 'Asia/Karachi',
      week_start_day: 0,
      work_days: '[1,2,3,4,5]',
      deep_work_start: '08:35',
      deep_work_minutes: 90,
      shutdown_time: '17:00',
      office_start: '08:15',
      office_end: '18:00',
    });
    expect(JSON.parse(settings[0].build_blocks as string)).toEqual([
      { weekday: 2, start: '06:30', minutes: 50 },
      { weekday: 4, start: '06:30', minutes: 50 },
      { weekday: 6, start: '09:00', minutes: 180 },
    ]);
    for (const table of ['projects', 'weeks', 'outcomes', 'must_ships', 'tasks', 'days', 'deep_work_blocks']) {
      expect(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()).toBe(0);
    }
  });

  it('refuses a second settings row', () => {
    expect(() =>
      db.prepare('INSERT INTO settings (id, created_at, updated_at) VALUES (2, ?, ?)').run(NOW, NOW)
    ).toThrow(/CHECK constraint failed: id = 1/);
  });
});

describe('outcomes: at most three per week', () => {
  beforeEach(() => insertWeek());

  it('accepts slots 1 to 3 and rejects slot 4', () => {
    insertOutcome('o1', 1);
    insertOutcome('o2', 2);
    insertOutcome('o3', 3);
    expect(() => insertOutcome('o4', 4)).toThrow(/CHECK constraint failed: slot IN \(1, 2, 3\)/);
  });

  it('rejects two outcomes in the same slot of one week', () => {
    insertOutcome('o1', 1);
    expect(() => insertOutcome('o2', 1)).toThrow(/UNIQUE constraint failed: outcomes.week_id, outcomes.slot/);
  });

  it('allows a second week to reuse the slot numbers', () => {
    insertWeek('w2', '2026-09-27');
    insertOutcome('o1', 1);
    expect(() =>
      db
        .prepare(
          `INSERT INTO outcomes (id, week_id, slot, title, category, created_at, updated_at)
           VALUES ('o2', 'w2', 1, 'Outcome', 'office', ?, ?)`
        )
        .run(NOW, NOW)
    ).not.toThrow();
  });

  it('requires a killed outcome to give up its slot, and an active one to hold one', () => {
    expect(() => insertOutcome('killed-with-slot', 1, 'killed')).toThrow(/CHECK constraint failed: \(status = 'killed'\) = \(slot IS NULL\)/);
    expect(() => insertOutcome('active-without-slot', null, 'active')).toThrow(/CHECK constraint failed: \(status = 'killed'\) = \(slot IS NULL\)/);
    expect(() => insertOutcome('killed', null, 'killed')).not.toThrow();
  });

  it('lets a replacement take the slot a killed outcome released', () => {
    insertOutcome('o1', 1);
    insertOutcome('o2', 2);
    insertOutcome('o3', 3);
    db.prepare("UPDATE outcomes SET status = 'killed', slot = NULL WHERE id = 'o2'").run();
    expect(() => insertOutcome('o4', 2)).not.toThrow();
  });

  it('enforces the week foreign key', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO outcomes (id, week_id, slot, title, category, created_at, updated_at)
           VALUES ('o1', 'missing', 1, 'Outcome', 'office', ?, ?)`
        )
        .run(NOW, NOW)
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('keeps progress between 0 and 100 and the review fields to their code lists', () => {
    insertOutcome('o1', 1);
    expect(() => db.prepare("UPDATE outcomes SET progress = 101 WHERE id = 'o1'").run()).toThrow(/CHECK constraint failed: progress BETWEEN 0 AND 100/);
    expect(() => db.prepare("UPDATE outcomes SET review_reason = 'tired' WHERE id = 'o1'").run()).toThrow(/CHECK constraint failed: review_reason IN \(/);
    expect(() => db.prepare("UPDATE outcomes SET review_reason = 'too_many_meetings' WHERE id = 'o1'").run()).not.toThrow();
  });
});

describe('must_ships: at most one per day per context', () => {
  it('allows a work and a build Must Ship on the same date, but not two of one context', () => {
    insertMustShip('m1', '2026-09-22', 'work');
    insertMustShip('m2', '2026-09-22', 'build');
    expect(() => insertMustShip('m3', '2026-09-22', 'work')).toThrow(/UNIQUE constraint failed: must_ships.date, must_ships.context/);
  });

  it('allows any number of undated candidates', () => {
    insertMustShip('c1', null, 'work');
    insertMustShip('c2', null, 'work');
    expect(db.prepare('SELECT COUNT(*) FROM must_ships WHERE date IS NULL').pluck().get()).toBe(2);
  });

  it('starts planned with a zero roll count', () => {
    insertMustShip('m1', '2026-09-22', 'work');
    expect(db.prepare("SELECT status, roll_count FROM must_ships WHERE id = 'm1'").get()).toEqual({
      status: 'planned',
      roll_count: 0,
    });
  });
});

describe('day_slots: at most two secondaries per day', () => {
  beforeEach(() => {
    insertDay('2026-09-22');
    insertTask('t1');
    insertTask('t2');
    insertTask('t3');
  });

  it('accepts slots 1 and 2 and rejects slot 3', () => {
    insertSlot('2026-09-22', 1, 't1');
    insertSlot('2026-09-22', 2, 't2');
    expect(() => insertSlot('2026-09-22', 3, 't3')).toThrow(/CHECK constraint failed: slot IN \(1, 2\)/);
  });

  it('rejects a second task in an occupied slot', () => {
    insertSlot('2026-09-22', 1, 't1');
    expect(() => insertSlot('2026-09-22', 1, 't2')).toThrow(/UNIQUE constraint failed: day_slots.date, day_slots.slot/);
  });

  it('rejects the same task in both slots', () => {
    insertSlot('2026-09-22', 1, 't1');
    expect(() => insertSlot('2026-09-22', 2, 't1')).toThrow(/UNIQUE constraint failed: day_slots.date, day_slots.task_id/);
  });

  it('removes the slots when the day is deleted', () => {
    insertSlot('2026-09-22', 1, 't1');
    db.prepare("DELETE FROM days WHERE date = '2026-09-22'").run();
    expect(db.prepare('SELECT COUNT(*) FROM day_slots').pluck().get()).toBe(0);
  });
});

describe('tasks', () => {
  it('starts in the inbox', () => {
    insertTask('t1');
    expect(db.prepare("SELECT status, roll_count FROM tasks WHERE id = 't1'").get()).toEqual({
      status: 'inbox',
      roll_count: 0,
    });
  });

  it('only accepts the seven statuses', () => {
    insertTask('t1');
    expect(() => db.prepare("UPDATE tasks SET status = 'someday' WHERE id = 't1'").run()).toThrow(/CHECK constraint failed: status IN \('inbox'/);
  });
});

describe('deep_work_blocks', () => {
  const insertBlock = (id: string, startedAt: string | null, endedAt: string | null) =>
    db
      .prepare(
        `INSERT INTO deep_work_blocks (id, date, context, planned_start, planned_minutes, started_at, ended_at, created_at, updated_at)
         VALUES (?, '2026-09-22', 'work', '08:35', 90, ?, ?, ?, ?)`
      )
      .run(id, startedAt, endedAt, NOW, NOW);

  it('cannot end before it has started', () => {
    expect(() => insertBlock('b1', null, NOW)).toThrow(/CHECK constraint failed: ended_at IS NULL OR started_at IS NOT NULL/);
    expect(() => insertBlock('b2', NOW, NOW)).not.toThrow();
  });
});

describe('the constraints no product limit covers', () => {
  const insertProject = (id: string, context: string, status = 'active') =>
    db
      .prepare('INSERT INTO projects (id, name, context, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, 'Project', context, status, NOW, NOW);

  it('keeps a week start date unique', () => {
    insertWeek('w1', '2026-09-20');
    expect(() => insertWeek('w2', '2026-09-20')).toThrow(/UNIQUE constraint failed: weeks.start_date/);
  });

  it('limits a project to the two contexts and three statuses', () => {
    expect(() => insertProject('p1', 'home')).toThrow(/CHECK constraint failed: context IN \('work', 'build'\)/);
    expect(() => insertProject('p2', 'work', 'paused')).toThrow(/CHECK constraint failed: status IN \('active', 'done', 'archived'\)/);
    expect(() => insertProject('p3', 'build')).not.toThrow();
  });

  it('limits an outcome to the four categories and the review code lists', () => {
    insertWeek();
    expect(() =>
      db
        .prepare(`INSERT INTO outcomes (id, week_id, slot, title, category, created_at, updated_at) VALUES ('o1', 'w1', 1, 'O', 'hobby', ?, ?)`)
        .run(NOW, NOW)
    ).toThrow(/CHECK constraint failed: category IN \(/);
    insertOutcome('o2', 2);
    expect(() => db.prepare("UPDATE outcomes SET review_grade = 'great' WHERE id = 'o2'").run()).toThrow(/CHECK constraint failed: review_grade IN \(/);
    expect(() => db.prepare("UPDATE outcomes SET review_disposition = 'ignore' WHERE id = 'o2'").run()).toThrow(/CHECK constraint failed: review_disposition IN \(/);
    expect(() => db.prepare("UPDATE outcomes SET review_grade = 'partial', review_disposition = 'reschedule' WHERE id = 'o2'").run()).not.toThrow();
  });

  it('limits a must ship to the six statuses', () => {
    insertMustShip('m1', '2026-09-22', 'work');
    expect(() => db.prepare("UPDATE must_ships SET status = 'almost' WHERE id = 'm1'").run()).toThrow(/CHECK constraint failed: status IN \('planned'/);
  });

  it('limits a deep work block to the two contexts and four results', () => {
    const insert = (id: string, context: string, result: string | null) =>
      db
        .prepare(
          `INSERT INTO deep_work_blocks (id, date, context, planned_start, planned_minutes, result, created_at, updated_at)
           VALUES (?, '2026-09-22', ?, '08:35', 90, ?, ?, ?)`
        )
        .run(id, context, result, NOW, NOW);
    expect(() => insert('b1', 'home', null)).toThrow(/CHECK constraint failed: context IN \('work', 'build'\)/);
    expect(() => insert('b2', 'work', 'meh')).toThrow(/CHECK constraint failed: result IN \(/);
    expect(() => insert('b3', 'work', 'progress')).not.toThrow();
  });

  it('bounds the settings weekday and minutes and a block\'s planned minutes', () => {
    expect(() => db.prepare('UPDATE settings SET week_start_day = 7 WHERE id = 1').run()).toThrow(/CHECK constraint failed: week_start_day BETWEEN 0 AND 6/);
    expect(() => db.prepare('UPDATE settings SET deep_work_minutes = 0 WHERE id = 1').run()).toThrow(/CHECK constraint failed: deep_work_minutes > 0/);
    expect(() =>
      db
        .prepare(
          `INSERT INTO deep_work_blocks (id, date, context, planned_start, planned_minutes, created_at, updated_at)
           VALUES ('b0', '2026-09-22', 'work', '08:35', 0, ?, ?)`
        )
        .run(NOW, NOW)
    ).toThrow(/CHECK constraint failed: planned_minutes > 0/);
  });
});
