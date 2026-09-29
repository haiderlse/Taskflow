import type Database from 'better-sqlite3';
import { rowToEntity, entityToRow, type FieldSpec } from '../db/mappers';
import { assertValidColumns, getTableColumns } from '../db/sql';

/** Exec rows keep dates and timestamps as text, so no codec applies; the spec only drives snake/camel. */
export const PLAIN: FieldSpec = { json: [], dates: [], bools: [] };

export type Bindable = string | number | null;

/** Every table a store may write. A literal union, so the name is never request-derived. */
export type ExecTable = 'tasks' | 'projects' | 'weeks' | 'outcomes' | 'must_ships';

export const toEntity = <T>(row: unknown): T => rowToEntity<T>(row as Record<string, unknown>, PLAIN);

export const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(', ');

const columnsByDb = new WeakMap<Database.Database, Map<ExecTable, Set<string>>>();

function columnsOf(db: Database.Database, table: ExecTable): Set<string> {
  const byTable = columnsByDb.get(db) ?? new Map<ExecTable, Set<string>>();
  columnsByDb.set(db, byTable);
  const columns = byTable.get(table) ?? getTableColumns(db, table);
  byTable.set(table, columns);
  return columns;
}

/** Keys are camelCase; each must be a real column before any SQL text is built. */
function toColumns(db: Database.Database, table: ExecTable, fields: Record<string, unknown>) {
  const row = entityToRow(fields, PLAIN);
  assertValidColumns(row, columnsOf(db, table));
  return { columns: Object.keys(row), values: Object.values(row) as Bindable[] };
}

export function insertRow(db: Database.Database, table: ExecTable, fields: Record<string, unknown>): void {
  const { columns, values } = toColumns(db, table, fields);
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders(columns.length)})`).run(...values);
}

export function updateRow(db: Database.Database, table: ExecTable, id: string, fields: Record<string, unknown>): void {
  const { columns, values } = toColumns(db, table, fields);
  if (columns.length === 0) return;
  db.prepare(`UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`).run(...values, id);
}
