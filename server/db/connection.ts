import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function openDb(path: string) {
  const db = new Database(path);
  db.pragma('foreign_keys = ON'); // SQLite ignores FK constraints unless enabled per connection
  db.pragma('journal_mode = WAL');
  return db;
}

export function initSchema(db: Database.Database) {
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
}
