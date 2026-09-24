import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path of the real migrations; tests pass their own directory. */
export const MIGRATIONS_DIR = join(here, '..', 'migrations');

export type Migration = { version: number; name: string; sql: string; checksum: string };

type LedgerRow = { version: number; name: string; checksum: string };

const FILE_PATTERN = /^(\d{3})_([a-z0-9_]+)\.sql$/;

const checksumOf = (sql: string) => createHash('sha256').update(sql).digest('hex');

/** Reads NNN_name.sql files in version order. Anything else in the directory is ignored. */
export function listMigrations(dir: string): Migration[] {
  const migrations = readdirSync(dir)
    .map((file) => ({ file, match: FILE_PATTERN.exec(file) }))
    .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ file, match }) => {
      const sql = readFileSync(join(dir, file), 'utf8');
      return { version: Number(match[1]), name: match[2], sql, checksum: checksumOf(sql) };
    })
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

/** The ledger is created by the runner itself, never by a migration, so it exists before 001 runs. */
function ensureLedger(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    INTEGER PRIMARY KEY,
       name       TEXT NOT NULL,
       checksum   TEXT NOT NULL,
       applied_at TEXT NOT NULL
     ) STRICT`
  );
}

const ledgerRows = (db: Database.Database): LedgerRow[] =>
  db.prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version').all() as LedgerRow[];

const insertLedger = (db: Database.Database, migration: Migration) =>
  db
    .prepare('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
    .run(migration.version, migration.name, migration.checksum, new Date().toISOString());

/** A database migrated before the ledger existed: trust user_version once and record what it implies. */
function backfillLedger(db: Database.Database, migrations: Migration[]): void {
  if (ledgerRows(db).length > 0) return;
  const version = currentVersion(db);
  db.transaction(() => {
    migrations.filter((m) => m.version <= version).forEach((m) => insertLedger(db, m));
  })();
}

/** Every applied migration must still exist on disk with the text it had when it ran. */
function verifyApplied(db: Database.Database, migrations: Migration[]): void {
  for (const row of ledgerRows(db)) {
    const file = migrations.find((m) => m.version === row.version);
    if (!file) {
      throw new Error(`migration ${row.version} (${row.name}) was applied to this database but its file no longer exists`);
    }
    if (file.checksum !== row.checksum) {
      throw new Error(`migration ${String(file.version).padStart(3, '0')}_${file.name}.sql has changed since it was applied`);
    }
  }
}

/**
 * Applies every migration above the database's user_version, each inside its own
 * BEGIN IMMEDIATE transaction that re-reads the version first, so two processes
 * racing on a fresh file cannot both apply the same migration. A failing file
 * leaves the database exactly as it was. Migration files must not contain
 * BEGIN/COMMIT of their own.
 */
export function migrate(db: Database.Database, dir: string = MIGRATIONS_DIR): Migration[] {
  ensureLedger(db);
  const migrations = listMigrations(dir);
  backfillLedger(db, migrations);
  verifyApplied(db, migrations);

  const applyIfPending = db.transaction((migration: Migration): boolean => {
    if (migration.version <= currentVersion(db)) return false;
    db.exec(migration.sql);
    insertLedger(db, migration);
    db.pragma(`user_version = ${migration.version}`);
    return true;
  });

  return migrations.filter((migration) => applyIfPending.immediate(migration));
}
