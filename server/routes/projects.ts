import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { rowToEntity, entityToRow, PROJECT_SPEC } from '../db/mappers';
import { assertValidColumns, getTableColumns, quoteIdent } from '../db/sql';
import type { Project } from '../../types';

export function projectsRouter(db: Database.Database) {
  const r = Router();
  const columns = getTableColumns(db, 'projects'); // allowlist read from the live schema
  const one = (id: string) =>
    db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;

  r.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM projects').all() as Record<string, unknown>[];
    res.json(rows.map((row) => rowToEntity<Project>(row, PROJECT_SPEC)));
  });

  r.post('/', (req, res) => {
    const now = new Date().toISOString();
    const entity = {
      id: randomUUID(),
      members: [req.body.ownerId],
      createdAt: now,
      updatedAt: now,
      color: 'bg-slate-500',
      isTemplate: false,
      isFavorite: false,
      status: 'active',
      sections: [],
      statusUpdates: [],
      visibility: 'team',
      customFields: [],
      tags: [],
      ...req.body,
    };
    const row = entityToRow(entity, PROJECT_SPEC);
    assertValidColumns(row, columns); // validate BEFORE building any SQL text
    const cols = Object.keys(row);
    db.prepare(
      `INSERT INTO projects (${cols.map(quoteIdent).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...Object.values(row));
    res.status(201).json(rowToEntity<Project>(one(entity.id)!, PROJECT_SPEC));
  });

  r.patch('/:id', (req, res) => {
    if (!one(req.params.id)) return res.status(404).json({ error: 'project not found' });
    const row = entityToRow({ ...req.body, updatedAt: new Date().toISOString() }, PROJECT_SPEC);
    delete row.id;
    assertValidColumns(row, columns); // validate BEFORE building any SQL text
    const cols = Object.keys(row);
    db.prepare(`UPDATE projects SET ${cols.map((c) => `${quoteIdent(c)} = ?`).join(',')} WHERE id = ?`)
      .run(...Object.values(row), req.params.id);
    res.json(rowToEntity<Project>(one(req.params.id)!, PROJECT_SPEC));
  });

  r.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.status(info.changes ? 204 : 404).end();
  });

  return r;
}
