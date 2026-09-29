import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok } from '../http';
import { getSettings } from '../settings/store';

/** Read-only until Phase 4 adds PUT. */
export function settingsRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/', (_req, res) => ok(res, getSettings(db)));
  return router;
}
