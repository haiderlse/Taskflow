import type Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path of the real migrations; tests pass their own directory. */
export const MIGRATIONS_DIR = join(here, '..', 'migrations');

export type Migration = { version: number; name: string; sql: string };

const FILE_PATTERN = /^(\d{3})_([a-z0-9_]+)\.sql$/;

/** Reads NNN_name.sql files in version order. Anything else in the directory is ignored. */
export function listMigrations(dir: string): Migration[] {
  const migrations = readdirSync(dir)
    .map((file) => ({ file, match: FILE_PATTERN.exec(file) }))
    .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ file, match }) => ({
      version: Number(match[1]),
      name: match[2],
      sql: readFileSync(join(dir, file), 'utf8'),
    }))
    .sort((a, b) => a.version - b.version);

  migrations.forEach((migration, index) => {
    const previous = migrations[index - 1];
    if (previous && previous.version === migration.version) {
      throw new Error(`duplicate migration version ${migration.version}`);
    }
  });
  return migrations;
}

/** The schema version SQLite stores in the file header. 0 on a brand-new database. */
export function currentVersion(db: Database.Database): number {
  return db.pragma('user_version', { simple: true }) as number;
}

/**
 * Applies every migration above the database's user_version, each in its own
 * transaction, so a failing file leaves the database exactly as it was.
 * Migration files must not contain BEGIN/COMMIT of their own.
 */
export function migrate(db: Database.Database, dir: string = MIGRATIONS_DIR): Migration[] {
  const pending = listMigrations(dir).filter((m) => m.version > currentVersion(db));
  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
  return pending;
}
