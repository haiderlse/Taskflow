import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { rowToEntity, entityToRow, TASK_SPEC } from '../db/mappers';
import { assertValidColumns, getTableColumns, quoteIdent } from '../db/sql';
import type { Task } from '../../types';

export function tasksRouter(db: Database.Database) {
  const r = Router();
  const columns = getTableColumns(db, 'tasks'); // allowlist read from the live schema
  const one = (id: string) =>
    db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;

  r.post('/', (req, res) => {
    const now = new Date().toISOString();
    const entity = {
      description: '',
      status: 'To Do',
      projectIds: [],
      collaboratorIds: [],
      order: 0,
      createdAt: now,
      updatedAt: now,
      dependencies: [],
      blockedBy: [],
      blocking: [],
      subtasks: [],
      timeTracked: 0,
      customFields: {},
      tags: [],
      attachments: [],
      isMilestone: false,
      subtaskItems: [],
      activities: [],
      ...req.body,
      id: randomUUID(), // placed last: a server-generated id must always win over a client-supplied one
    };
    const row = entityToRow(entity, TASK_SPEC);
    assertValidColumns(row, columns); // validate BEFORE building any SQL text
    const cols = Object.keys(row);
    db.prepare(
      `INSERT INTO tasks (${cols.map(quoteIdent).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...Object.values(row));
    res.status(201).json(rowToEntity<Task>(one(entity.id)!, TASK_SPEC));
  });

  r.patch('/:id', (req, res) => {
    if (!one(req.params.id)) return res.status(404).json({ error: 'task not found' });
    const row = entityToRow({ ...req.body, updatedAt: new Date().toISOString() }, TASK_SPEC);
    delete row.id;
    assertValidColumns(row, columns); // validate BEFORE building any SQL text
    const cols = Object.keys(row);
    db.prepare(`UPDATE tasks SET ${cols.map((c) => `${quoteIdent(c)} = ?`).join(',')} WHERE id = ?`)
      .run(...Object.values(row), req.params.id);
    res.json(rowToEntity<Task>(one(req.params.id)!, TASK_SPEC));
  });

  r.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.status(info.changes ? 204 : 404).end();
  });

  return r;
}

// `column` is typed to two hardcoded literals, so it is never request-derived and
// is safe to interpolate; the request-derived `value` is always a bound parameter.
export function listTasksBy(db: Database.Database, column: 'project_id' | 'assignee_id', value: string) {
  const rows = db
    .prepare(`SELECT * FROM tasks WHERE ${column} = ? ORDER BY "order" ASC`)
    .all(value) as Record<string, unknown>[];
  return rows.map((row) => rowToEntity<Task>(row, TASK_SPEC));
}
