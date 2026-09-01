import { describe, it, expect } from 'vitest';
import { rowToEntity, entityToRow, TASK_SPEC, USER_SPEC } from '../db/mappers';

describe('rowToEntity', () => {
  it('converts snake_case columns to camelCase keys', () => {
    const e = rowToEntity<any>({ project_id: 'p1', due_time: '09:00' }, TASK_SPEC);
    expect(e.projectId).toBe('p1');
    expect(e.dueTime).toBe('09:00');
  });

  it('parses JSON columns into arrays and objects', () => {
    const e = rowToEntity<any>({ tags: '["a","b"]', custom_fields: '{"k":1}' }, TASK_SPEC);
    expect(e.tags).toEqual(['a', 'b']);
    expect(e.customFields).toEqual({ k: 1 });
  });

  it('parses date columns into Date objects and keeps null as null', () => {
    const e = rowToEntity<any>({ created_at: '2026-09-01T00:00:00.000Z', due_date: null }, TASK_SPEC);
    expect(e.createdAt).toBeInstanceOf(Date);
    expect(e.dueDate).toBeNull();
  });

  it('converts integer booleans to real booleans', () => {
    expect(rowToEntity<any>({ is_active: 1 }, USER_SPEC).isActive).toBe(true);
    expect(rowToEntity<any>({ is_active: 0 }, USER_SPEC).isActive).toBe(false);
  });

  it('preserves null for JSON columns without attempting parse', () => {
    const e = rowToEntity<any>({ approval: null }, TASK_SPEC);
    expect(e.approval).toBeNull();
  });

  it('handles Date object input in rowToEntity gracefully', () => {
    const d = new Date('2026-09-01T10:00:00Z');
    const e = rowToEntity<any>({ created_at: d }, TASK_SPEC);
    expect(e.createdAt).toBeInstanceOf(Date);
  });
});

describe('entityToRow', () => {
  it('is the inverse of rowToEntity for a full task', () => {
    const row = {
      id: 't1', project_id: 'p1', "order": 3, tags: '["x"]',
      custom_fields: '{}', created_at: '2026-09-01T00:00:00.000Z',
      is_milestone: 1, due_date: null,
    };
    expect(entityToRow(rowToEntity<any>(row, TASK_SPEC), TASK_SPEC)).toMatchObject(row);
  });

  it('serialises arrays back to JSON strings', () => {
    expect(entityToRow({ tags: ['a'] }, TASK_SPEC).tags).toBe('["a"]');
  });

  it('drops undefined values so partial updates are safe', () => {
    expect('title' in entityToRow({ id: 't1', title: undefined }, TASK_SPEC)).toBe(false);
  });

  it('preserves null for JSON columns in entityToRow', () => {
    expect(entityToRow({ approval: null }, TASK_SPEC).approval).toBeNull();
  });

  it('passes through Date objects unchanged', () => {
    const d = new Date('2026-09-01T10:00:00.000Z');
    const row = entityToRow({ createdAt: d }, TASK_SPEC);
    expect(row.created_at).toBe(d.toISOString());
  });

  it('accepts date-only strings and converts to ISO', () => {
    const row = entityToRow({ createdAt: '2026-09-01' }, TASK_SPEC);
    expect(row.created_at).toContain('2026-09-01');
  });

  it('accepts ISO strings with Z suffix', () => {
    const row = entityToRow({ createdAt: '2026-09-01T10:00:00.000Z' }, TASK_SPEC);
    expect(row.created_at).toBe('2026-09-01T10:00:00.000Z');
  });

  it('accepts ISO strings with timezone offset', () => {
    const row = entityToRow({ createdAt: '2026-09-01T10:00:00+05:00' }, TASK_SPEC);
    expect(row.created_at).toBe('2026-09-01T05:00:00.000Z');
  });

  it('throws on naive datetime string (no timezone)', () => {
    expect(() => {
      entityToRow({ createdAt: '2026-09-01T10:00:00' }, TASK_SPEC);
    }).toThrow(/createdAt.*naive datetime/);
  });

  it('throws on unparseable datetime string', () => {
    expect(() => {
      entityToRow({ createdAt: 'not-a-date' }, TASK_SPEC);
    }).toThrow(/createdAt.*unparseable/);
  });
});
