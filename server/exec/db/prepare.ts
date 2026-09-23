import type Database from 'better-sqlite3';
import { openExecDb } from './open';
import { migrate } from './migrate';

/** The one way the app and tests get a ready execution database. */
export function prepareExecDb(path: string): Database.Database {
  const db = openExecDb(path);
  migrate(db);
  return db;
}
