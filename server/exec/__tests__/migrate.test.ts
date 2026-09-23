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
    expect(tables(db)).toEqual(['a', 'b']);
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
    expect(tables(db)).toEqual(['a', 'b']);
  });

  it('rolls back a failing migration and leaves the version where it was', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    write('002_broken.sql', 'CREATE TABLE b (x INTEGER); INSERT INTO nope VALUES (1);');
    const db = openExecDb(':memory:');
    expect(() => migrate(db, dir)).toThrow(/no such table: nope/);
    expect(currentVersion(db)).toBe(1);
    expect(tables(db)).toEqual(['a']);
  });
});
