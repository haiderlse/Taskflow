import type Database from 'better-sqlite3';
import { toEntity } from '../rows';
import { listBlocks } from '../deepWork/store';
import { addDays } from '../../../src/shared/exec/dates';
import { weekStartOf } from '../../../src/shared/exec/time';
import { scoreboard } from '../../../src/shared/exec/scoreboard';
import type { Outcome, Settings, Task, Week } from '../../../src/shared/exec/schemas';
import type { MustShip } from '../../../src/shared/exec/todaySchemas';
import type { Scoreboard } from '../../../src/shared/exec/reviewSchemas';

const HISTORY_WEEKS = 12;

/** A UTC window a day wider than the week on each side: every local timestamp of the week falls inside it, whatever the zone. */
const stampWindow = (startDate: string): [string, string] => [`${addDays(startDate, -1)}T00:00:00.000Z`, `${addDays(startDate, 8)}T00:00:00.000Z`];

const rowsOf = <T>(db: Database.Database, sql: string, params: string[]): T[] => db.prepare(sql).all(...params).map((row) => toEntity<T>(row));

/** The rows the week's numbers read (spec B "Scoreboard"); the pure scoreboard() then filters each number exactly. */
export function weekScoreboard(db: Database.Database, week: Week, settings: Settings): Scoreboard {
  const [low, high] = stampWindow(week.startDate);
  const end = addDays(week.startDate, 6);
  const outcomes = rowsOf<Outcome>(
    db,
    `SELECT * FROM outcomes WHERE week_id = ?
       OR (rolled_from_id IS NOT NULL AND created_at >= ? AND created_at < ?)
       OR (status = 'killed' AND closed_at >= ? AND closed_at < ?)`,
    [week.id, low, high, low, high]
  );
  const mustShips = rowsOf<MustShip>(
    db,
    `SELECT * FROM must_ships WHERE date BETWEEN ? AND ?
       OR (rolled_from_id IS NOT NULL AND created_at >= ? AND created_at < ?)
       OR (status = 'killed' AND closed_at >= ? AND closed_at < ?)`,
    [week.startDate, end, low, high, low, high]
  );
  const tasks = rowsOf<Task>(
    db,
    'SELECT * FROM tasks WHERE (rolled_at >= ? AND rolled_at < ?) OR (closed_at >= ? AND closed_at < ?) OR (delegated_at >= ? AND delegated_at < ?)',
    [low, high, low, high, low, high]
  );
  const blocks = listBlocks(db, { from: week.startDate, to: end });
  return scoreboard({ week, outcomes, mustShips, tasks, blocks }, settings);
}

/** Up to twelve weeks before the one containing `before`, newest first, each with its numbers (spec C "Review" item 2). */
export function weekHistory(db: Database.Database, before: string, settings: Settings): Scoreboard[] {
  return db
    .prepare('SELECT * FROM weeks WHERE start_date < ? ORDER BY start_date DESC LIMIT ?')
    .all(weekStartOf(before, settings.weekStartDay), HISTORY_WEEKS)
    .map((row) => weekScoreboard(db, toEntity<Week>(row), settings));
}
