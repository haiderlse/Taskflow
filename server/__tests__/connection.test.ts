import { describe, it, expect } from 'vitest';
import { openDb, initSchema } from '../db/connection';

describe('database connection', () => {
  it('enables foreign key enforcement', () => {
    const db = openDb(':memory:');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('creates the three core tables', () => {
    const db = openDb(':memory:');
    initSchema(db);
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    expect(names).toEqual(expect.arrayContaining(['users', 'projects', 'tasks']));
  });

  it('rejects a task referencing a missing project', () => {
    const db = openDb(':memory:');
    initSchema(db);
    // created_at/updated_at are NOT NULL with no default — supply them so the
    // statement fails on the FOREIGN KEY, not on NOT NULL.
    const now = new Date().toISOString();
    expect(() =>
      db.prepare(
        'INSERT INTO tasks (id, title, project_id, created_at, updated_at) VALUES (?,?,?,?,?)'
      ).run('t1', 'orphan', 'no-such-project', now, now)
    ).toThrow(/FOREIGN KEY/i);
  });
});
