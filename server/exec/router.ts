import { Router } from 'express';
import type Database from 'better-sqlite3';
import { currentVersion } from './db/migrate';
import { ok, execErrorHandler } from './http';

/** Every /api/exec resource mounts here. Later phases add one file per resource. */
export function createExecRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/health', (_req, res) => ok(res, { status: 'ok', schemaVersion: currentVersion(db) }));
  // Error-handling middleware must be registered last, after every route.
  router.use(execErrorHandler);
  return router;
}
