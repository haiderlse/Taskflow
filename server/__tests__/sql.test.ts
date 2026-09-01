import { describe, it, expect } from 'vitest';
import { openDb, initSchema } from '../db/connection';
import { getTableColumns, assertValidColumns, quoteIdent, BadRequestError } from '../db/sql';

describe('db/sql', () => {
  it('getTableColumns reads real column names from the live schema', () => {
    const db = openDb(':memory:');
    initSchema(db);
    const cols = getTableColumns(db, 'users');
    expect(cols.has('uid')).toBe(true);
    expect(cols.has('display_name')).toBe(true);
    expect(cols.has('role = coalesce(?, ?) -- ')).toBe(false);
  });

  it('assertValidColumns passes when every key is a real column', () => {
    const allowed = new Set(['uid', 'email']);
    expect(() => assertValidColumns({ uid: '1', email: 'a@b.com' }, allowed)).not.toThrow();
  });

  it('assertValidColumns passes on an empty row', () => {
    const allowed = new Set(['uid', 'email']);
    expect(() => assertValidColumns({}, allowed)).not.toThrow();
  });

  it('assertValidColumns throws BadRequestError naming the offending key', () => {
    const allowed = new Set(['uid', 'email']);
    let thrown: unknown;
    try {
      assertValidColumns({ uid: '1', 'DROP TABLE users; --': 'x' }, allowed);
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(BadRequestError);
    expect((thrown as Error).message).toContain('DROP TABLE users; --');
  });

  it('quoteIdent quotes only the reserved word "order"', () => {
    expect(quoteIdent('order')).toBe('"order"');
    expect(quoteIdent('email')).toBe('email');
  });
});
