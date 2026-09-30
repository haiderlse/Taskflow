import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { finishBlock } from '../deepWork/finish';
import { getDayView } from './store';
import type { DayView } from '../../../src/shared/exec/todaySchemas';

/**
 * Closes the day (spec B, POST /days/:date/shutdown). Refused while the work Must Ship is still planned, so step 1 cannot
 * be skipped. A session still running that day ends as abandoned. A second call changes nothing.
 */
export function shutDown(db: Database.Database, date: string, now: string, weekStartDay: number): DayView {
  db.transaction(() => {
    if (db.prepare('SELECT shutdown_at FROM days WHERE date = ?').pluck().get(date)) return;
    const status = db.prepare("SELECT status FROM must_ships WHERE date = ? AND context = 'work'").pluck().get(date);
    if (status === 'planned') throw new ApiError(409, 'SHUTDOWN_NOT_READY', "grade today's Must Ship before closing the day");
    const live = db.prepare('SELECT id FROM deep_work_blocks WHERE date = ? AND started_at IS NOT NULL AND ended_at IS NULL').pluck().all(date) as string[];
    for (const id of live) finishBlock(db, id, { result: 'abandoned', notes: '' }, now);
    db.prepare(
      `INSERT INTO days (date, shutdown_at, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (date) DO UPDATE SET shutdown_at = excluded.shutdown_at, updated_at = excluded.updated_at`
    ).run(date, now, now, now);
  }).immediate();
  return getDayView(db, date, weekStartDay);
}
