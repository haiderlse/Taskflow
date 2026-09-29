import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { toEntity } from '../rows';
import { addDays } from '../../../src/shared/exec/dates';
import { weekStartOf } from '../../../src/shared/exec/time';
import type { Outcome, Week, WeekLookup, WeekView } from '../../../src/shared/exec/schemas';

export function getWeek(db: Database.Database, id: string): Week | null {
  const row = db.prepare('SELECT * FROM weeks WHERE id = ?').get(id);
  return row ? toEntity<Week>(row) : null;
}

export function findWeekByStart(db: Database.Database, startDate: string): Week | null {
  const row = db.prepare('SELECT * FROM weeks WHERE start_date = ?').get(startDate);
  return row ? toEntity<Week>(row) : null;
}

/** Slotted outcomes by slot, then killed ones (slot NULL), oldest first. */
export function listOutcomes(db: Database.Database, weekId: string): Outcome[] {
  return db
    .prepare('SELECT * FROM outcomes WHERE week_id = ? ORDER BY slot IS NULL, slot, created_at, id')
    .all(weekId)
    .map((row) => toEntity<Outcome>(row));
}

const viewOf = (db: Database.Database, week: Week): WeekView => ({ week, outcomes: listOutcomes(db, week.id) });

export function getWeekView(db: Database.Database, id: string): WeekView | null {
  const week = getWeek(db, id);
  return week ? viewOf(db, week) : null;
}

/** Create-or-return the planning week containing `date` (spec B, POST /weeks). */
export function ensureWeek(db: Database.Database, date: string, weekStartDay: number, now: string) {
  const startDate = weekStartOf(date, weekStartDay);
  // Literal columns, bound values; ON CONFLICT makes a repeat call a read.
  const info = db
    .prepare('INSERT INTO weeks (id, start_date, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (start_date) DO NOTHING')
    .run(randomUUID(), startDate, now, now);
  return { view: viewOf(db, findWeekByStart(db, startDate) as Week), created: info.changes === 1 };
}

/** Today and /plan in one read: this week, last week, and whether any earlier week ever held an outcome. */
export function lookupWeek(db: Database.Database, date: string, weekStartDay: number): WeekLookup {
  const startDate = weekStartOf(date, weekStartDay);
  const current = findWeekByStart(db, startDate);
  const previous = findWeekByStart(db, addDays(startDate, -7));
  const history = db
    .prepare('SELECT EXISTS (SELECT 1 FROM outcomes o JOIN weeks w ON w.id = o.week_id WHERE w.start_date < ?)')
    .pluck()
    .get(startDate);
  return {
    current: current ? viewOf(db, current) : null,
    previous: previous ? viewOf(db, previous) : null,
    hasHistory: history === 1,
  };
}
