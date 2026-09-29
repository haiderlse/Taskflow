import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { insertRow, updateRow, toEntity, placeholders } from '../rows';

const NOW = '2026-09-22T03:00:00.000Z';
let db: Database.Database;

type ProjectRow = { id: string; name: string; context: string; status: string; notes: string; createdAt: string };
const project = (id: string) => toEntity<ProjectRow>(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
const insertProject = (id: string) =>
  insertRow(db, 'projects', { id, name: 'Supply plan', context: 'work', createdAt: NOW, updatedAt: NOW });

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('insertRow and updateRow', () => {
  it('writes camelCase fields to snake_case columns and reads them back camelCase', () => {
    insertProject('p1');
    expect(project('p1')).toMatchObject({ id: 'p1', name: 'Supply plan', context: 'work', status: 'active', notes: '', createdAt: NOW });
    updateRow(db, 'projects', 'p1', { name: 'September supply plan', updatedAt: NOW });
    expect(project('p1').name).toBe('September supply plan');
  });

  it('refuses a field that is not a column before any SQL is built', () => {
    insertProject('p1');
    expect(() => updateRow(db, 'projects', 'p1', { bogus: 'x' })).toThrow(/unknown column: bogus/);
    expect(() =>
      insertRow(db, 'projects', { id: 'p2', name: 'x', context: 'work', createdAt: NOW, updatedAt: NOW, evil: 1 })
    ).toThrow(/unknown column: evil/);
    expect(db.prepare('SELECT COUNT(*) FROM projects').pluck().get()).toBe(1);
  });

  it('treats an empty update as a no-op', () => {
    insertProject('p1');
    expect(() => updateRow(db, 'projects', 'p1', {})).not.toThrow();
    expect(project('p1').name).toBe('Supply plan');
  });

  it('builds placeholder lists', () => {
    expect(placeholders(3)).toBe('?, ?, ?');
    expect(placeholders(0)).toBe('');
  });
});
