import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { rowToEntity, entityToRow, type FieldSpec } from '../../db/mappers';
import { assertValidColumns, getTableColumns } from '../../db/sql';
import { ApiError } from '../http';
import { addDays } from '../../../src/shared/exec/dates';
import { OPEN_STATUSES, WAITING_STATUSES } from '../../../src/shared/exec/schemas';
import type { Task, TaskCreate, TaskPatch, TaskListQuery } from '../../../src/shared/exec/schemas';
import { transitionStamps, requiresOwner } from './transitions';

// Exec rows keep dates and timestamps as text, so no codec applies; the spec only drives snake/camel.
const PLAIN: FieldSpec = { json: [], dates: [], bools: [] };
const toTask = (row: unknown): Task => rowToEntity<Task>(row as Record<string, unknown>, PLAIN);

type Bindable = string | number | null;
const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');

const columnsByDb = new WeakMap<Database.Database, Set<string>>();
const tasksColumns = (db: Database.Database): Set<string> => {
  const cached = columnsByDb.get(db) ?? getTableColumns(db, 'tasks');
  columnsByDb.set(db, cached);
  return cached;
};

export function getTask(db: Database.Database, id: string): Task | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return row ? toTask(row) : null;
}

/** Newest capture first. Filters combine with AND; `week` is the week's first day. */
export function listTasks(db: Database.Database, query: TaskListQuery): Task[] {
  const clauses: string[] = [];
  const params: Bindable[] = [];
  if (query.status) {
    clauses.push(`status IN (${placeholders(query.status.length)})`);
    params.push(...query.status);
  }
  if (query.context) {
    clauses.push('context = ?');
    params.push(query.context);
  }
  if (query.week) {
    clauses.push(`(status = 'this_week' OR (status IN (${placeholders(OPEN_STATUSES.length)}) AND scheduled_date BETWEEN ? AND ?))`);
    params.push(...OPEN_STATUSES, query.week, addDays(query.week, 6));
  }
  if (query.followUpBy) {
    clauses.push(`status IN (${placeholders(WAITING_STATUSES.length)}) AND follow_up_date IS NOT NULL AND follow_up_date <= ?`);
    params.push(...WAITING_STATUSES, query.followUpBy);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM tasks ${where} ORDER BY captured_at DESC, id`).all(...params).map(toTask);
}

/** Capture is not commitment: every new task starts in the inbox. */
export function createTask(db: Database.Database, input: TaskCreate, now: string): Task {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, title, notes, context, status, captured_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'inbox', ?, ?, ?)`
  ).run(id, input.title, input.notes, input.context, now, now, now);
  return getTask(db, id) as Task;
}

function writeRow(db: Database.Database, id: string, fields: Record<string, unknown>): void {
  const row = entityToRow(fields, PLAIN);
  assertValidColumns(row, tasksColumns(db));
  const columns = Object.keys(row);
  const values = Object.values(row) as Bindable[];
  db.prepare(`UPDATE tasks SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`).run(...values, id);
}

/** Applies a patch plus the transition stamps; null when the task does not exist. */
export function patchTask(db: Database.Database, id: string, patch: TaskPatch, now: string): Task | null {
  const current = getTask(db, id);
  if (!current) return null;
  const to = patch.status ?? current.status;
  const owner = patch.ownerName === undefined ? current.ownerName : patch.ownerName;
  if (requiresOwner(to) && !owner) {
    throw new ApiError(400, 'VALIDATION', 'ownerName is required when a task is delegated or waiting');
  }
  const stamps = patch.status ? transitionStamps(current.status, patch.status, current.processedAt, now) : {};
  writeRow(db, id, { ...patch, ...stamps, updatedAt: now });
  return getTask(db, id);
}

/** Shutdown's "Tomorrow": move the scheduled date and count the roll. */
export function rollTask(db: Database.Database, id: string, date: string, now: string): Task | null {
  const current = getTask(db, id);
  if (!current) return null;
  writeRow(db, id, { scheduledDate: date, rollCount: current.rollCount + 1, rolledAt: now, updatedAt: now });
  return getTask(db, id);
}

export type DeleteResult = 'deleted' | 'missing' | 'not_allowed';

/** Only an accidental capture may vanish; anything processed is killed, never deleted. */
export function deleteTask(db: Database.Database, id: string): DeleteResult {
  const current = getTask(db, id);
  if (!current) return 'missing';
  if (current.status !== 'inbox') return 'not_allowed';
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return 'deleted';
}
