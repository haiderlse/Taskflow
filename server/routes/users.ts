import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { rowToEntity, entityToRow, USER_SPEC } from '../db/mappers';
import type { User } from '../../types';

export function usersRouter(db: Database.Database) {
  const r = Router();
  const one = (uid: string) =>
    db.prepare('SELECT * FROM users WHERE uid = ?').get(uid) as Record<string, unknown> | undefined;

  r.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM users').all() as Record<string, unknown>[];
    res.json(rows.map((row) => rowToEntity<User>(row, USER_SPEC)));
  });

  // Must precede '/:uid' or 'me' is captured as a uid
  r.get('/me', (_req, res) => {
    const row = one('user-1');
    if (!row) return res.status(404).json({ error: 'no seeded user' });
    res.json(rowToEntity<User>(row, USER_SPEC));
  });

  r.get('/:uid', (req, res) => {
    const row = one(req.params.uid);
    if (!row) return res.status(404).json({ error: 'user not found' });
    res.json(rowToEntity<User>(row, USER_SPEC));
  });

  r.post('/', (req, res) => {
    const entity = {
      uid: randomUUID(),
      isActive: true,
      createdAt: new Date().toISOString(),
      ...req.body,
    };
    const row = entityToRow(entity, USER_SPEC);
    const cols = Object.keys(row);
    db.prepare(
      `INSERT INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...Object.values(row));
    res.status(201).json(rowToEntity<User>(one(entity.uid)!, USER_SPEC));
  });

  r.patch('/:uid', (req, res) => {
    if (!one(req.params.uid)) return res.status(404).json({ error: 'user not found' });
    const row = entityToRow(req.body, USER_SPEC);
    delete row.uid;
    const cols = Object.keys(row);
    if (cols.length) {
      db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE uid = ?`)
        .run(...Object.values(row), req.params.uid);
    }
    res.json(rowToEntity<User>(one(req.params.uid)!, USER_SPEC));
  });

  r.delete('/:uid', (req, res) => {
    const info = db.prepare('DELETE FROM users WHERE uid = ?').run(req.params.uid);
    res.status(info.changes ? 204 : 404).end();
  });

  return r;
}
