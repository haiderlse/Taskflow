import { describe, it, expect } from 'vitest';
import { openDb, initSchema } from '../db/connection';
import { seed } from '../db/seed';

const fresh = () => { const db = openDb(':memory:'); initSchema(db); return db; };
const count = (db: any, t: string) =>
  db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

describe('seed', () => {
  it('inserts the demo users, project and tasks', () => {
    const db = fresh();
    seed(db);
    expect(count(db, 'users')).toBeGreaterThan(0);
    expect(count(db, 'projects')).toBeGreaterThan(0);
    expect(db.prepare('SELECT uid FROM users WHERE uid = ?').get('user-1')).toBeTruthy();
  });

  it('is idempotent — running twice does not duplicate rows', () => {
    const db = fresh();
    seed(db);
    const before = count(db, 'users');
    seed(db);
    expect(count(db, 'users')).toBe(before);
  });
});
