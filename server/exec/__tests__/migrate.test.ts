import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { openExecDb } from '../db/open';
import { listMigrations, currentVersion, migrate } from '../db/migrate';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'exec-migrations-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, sql: string) => writeFileSync(join(dir, name), sql);

const tables = (db: Database.Database) =>
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all();

describe('openExecDb', () => {
  it('enables foreign keys and a busy timeout on every connection', () => {
    const db = openExecDb(':memory:');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
  });
});

describe('listMigrations', () => {
  it('returns NNN_name.sql files in version order and ignores everything else', () => {
    write('002_second.sql', 'CREATE TABLE b (x INTEGER);');
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    write('notes.txt', 'ignored');
    write('003_draft.sql.bak', 'ignored');
    expect(listMigrations(dir).map((m) => [m.version, m.name])).toEqual([
      [1, 'first'],
      [2, 'second'],
    ]);
  });

  it('rejects two files that claim the same version', () => {
    write('001_a.sql', 'SELECT 1;');
    write('001_b.sql', 'SELECT 1;');
    expect(() => listMigrations(dir)).toThrow(/duplicate migration version 1/);
  });
});

describe('migrate', () => {
  it('applies every pending migration in order and records the version', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    write('002_second.sql', 'CREATE TABLE b (x INTEGER);');
    const db = openExecDb(':memory:');
    const applied = migrate(db, dir);
    expect(applied.map((m) => m.version)).toEqual([1, 2]);
    expect(currentVersion(db)).toBe(2);
    expect(tables(db)).toEqual(['a', 'b', 'schema_migrations']);
  });

  it('is idempotent: a second run applies nothing', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    expect(migrate(db, dir)).toEqual([]);
    expect(currentVersion(db)).toBe(1);
  });

  it('applies only the migrations above the current version', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    write('002_second.sql', 'CREATE TABLE b (x INTEGER);');
    expect(migrate(db, dir).map((m) => m.version)).toEqual([2]);
    expect(tables(db)).toEqual(['a', 'b', 'schema_migrations']);
  });

  it('rolls back a failing migration and leaves the version where it was', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    write('002_broken.sql', 'CREATE TABLE b (x INTEGER); INSERT INTO nope VALUES (1);');
    const db = openExecDb(':memory:');
    expect(() => migrate(db, dir)).toThrow(/no such table: nope/);
    expect(currentVersion(db)).toBe(1);
    expect(tables(db)).toEqual(['a', 'schema_migrations']);
  });
});

describe('schema_migrations ledger', () => {
  const ledger = (db: Database.Database) =>
    db.prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version').all() as {
      version: number;
      name: string;
      checksum: string;
    }[];

  it('records every applied migration with a sha256 checksum of its text', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    const [applied] = migrate(db, dir);
    expect(applied.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(ledger(db)).toEqual([{ version: 1, name: 'first', checksum: applied.checksum }]);
    expect(tables(db)).toContain('schema_migrations');
  });

  it('refuses to run when an applied migration file has changed since', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    write('001_first.sql', 'CREATE TABLE a (x INTEGER, y INTEGER);');
    expect(() => migrate(db, dir)).toThrow(/001_first\.sql has changed since it was applied/);
    expect(currentVersion(db)).toBe(1);
  });

  it('refuses to run when an applied migration file is gone', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    rmSync(join(dir, '001_first.sql'));
    expect(() => migrate(db, dir)).toThrow(/migration 1 \(first\) was applied to this database but its file no longer exists/);
  });

  it('backfills the ledger for a database migrated before the ledger existed', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    db.exec('CREATE TABLE a (x INTEGER);');
    db.pragma('user_version = 1');
    expect(migrate(db, dir)).toEqual([]);
    expect(ledger(db).map((row) => [row.version, row.name])).toEqual([[1, 'first']]);
  });

  it('skips a version that was applied by someone else between listing and running', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    write('002_second.sql', 'CREATE TABLE b (x INTEGER);');
    // Simulate a second process having applied 002 already: the table, the ledger row and the version say so.
    db.exec('CREATE TABLE b (x INTEGER);');
    db.prepare('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (2, ?, ?, ?)').run(
      'second',
      listMigrations(dir)[1].checksum,
      '2026-09-24T00:00:00.000Z'
    );
    db.pragma('user_version = 2');
    expect(migrate(db, dir)).toEqual([]);
    expect(tables(db)).toEqual(['a', 'b', 'schema_migrations']);
  });
});
