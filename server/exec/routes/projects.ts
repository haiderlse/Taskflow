import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok } from '../http';
import { rowToEntity, type FieldSpec } from '../../db/mappers';
import type { Project } from '../../../src/shared/exec/schemas';

const PLAIN: FieldSpec = { json: [], dates: [], bools: [] };

/** Read-only in Phase 2; Phase 3 adds creation and editing. */
export function projectsRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM projects ORDER BY name').all() as Record<string, unknown>[];
    ok(res, rows.map((row) => rowToEntity<Project>(row, PLAIN)));
  });
  return router;
}
