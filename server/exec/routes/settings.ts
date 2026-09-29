import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok } from '../http';
import { nowIso } from '../clock';
import { getSettings, putSettings } from '../settings/store';
import { settingsUpdateSchema } from '../../../src/shared/exec/todaySchemas';

export function settingsRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  router.get('/', (_req, res) => ok(res, getSettings(db)));
  router.put('/', (req, res) => ok(res, putSettings(db, settingsUpdateSchema.parse(req.body), clock())));
  return router;
}
