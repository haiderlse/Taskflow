import Database from 'better-sqlite3';

/**
 * Opens the execution database. Every pragma here is per-connection, so this is
 * the only place a connection may be created.
 */
export function openExecDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('foreign_keys = ON'); // SQLite ignores FK constraints unless enabled per connection
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000'); // wait instead of throwing SQLITE_BUSY when another process holds the file
  return db;
}
