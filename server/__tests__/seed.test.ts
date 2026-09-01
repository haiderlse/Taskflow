import { describe, it, expect } from 'vitest';
import { openDb, initSchema } from '../db/connection';
import { seed } from '../db/seed';

const fresh = () => { const db = openDb(':memory:'); initSchema(db); return db; };
const count = (db: any, t: string) =>
  db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

describe('seed', () => {
  it('inserts the demo users, projects and tasks', () => {
    const db = fresh();
    seed(db);
    // Pin the real measured fixture counts rather than a loose ">0", so an
    // emptied PROJECTS/TASKS array (or a single trivial row) fails the suite.
    expect(count(db, 'users')).toBe(3);
    expect(count(db, 'projects')).toBe(5);
    expect(count(db, 'tasks')).toBe(8);
    expect(db.prepare('SELECT uid FROM users WHERE uid = ?').get('user-1')).toBeTruthy();
    expect(
      db.prepare('SELECT id FROM projects WHERE name = ?').get('AOP 2025-26 Enterprise Plan')
    ).toBeTruthy();
  });

  it('is idempotent — running twice does not duplicate rows', () => {
    const db = fresh();
    seed(db);
    const usersBefore = count(db, 'users');
    const projectsBefore = count(db, 'projects');
    const tasksBefore = count(db, 'tasks');
    seed(db);
    expect(count(db, 'users')).toBe(usersBefore);
    expect(count(db, 'projects')).toBe(projectsBefore);
    expect(count(db, 'tasks')).toBe(tasksBefore);
  });
});
