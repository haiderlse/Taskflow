import express, { Router } from 'express';
import type Database from 'better-sqlite3';
import { currentVersion } from './db/migrate';
import { ok, ApiError, execErrorHandler } from './http';
import type { Health } from '../../src/shared/exec/api';
import { tasksRouter } from './routes/tasks';
import { settingsRouter } from './routes/settings';
import { projectsRouter } from './routes/projects';
import { weeksRouter } from './routes/weeks';
import { outcomesRouter } from './routes/outcomes';

export type ExecRouterOptions = { extend?: (router: Router) => void };

/** Every /api/exec resource mounts here. Later phases add one file per resource. */
export function createExecRouter(db: Database.Database, options?: ExecRouterOptions): Router {
  const router = Router();
  // This router owns its own body parsing so a malformed or oversized body
  // to any /api/exec/* path stays inside the envelope, even if it is mounted
  // before the app-level parser.
  router.use(express.json({ limit: '5mb' }));
  router.get('/health', (_req, res) => {
    const health: Health = { status: 'ok', schemaVersion: currentVersion(db) };
    ok(res, health);
  });
  router.use('/tasks', tasksRouter(db));
  router.use('/settings', settingsRouter(db));
  router.use('/projects', projectsRouter(db));
  router.use('/weeks', weeksRouter(db));
  router.use('/outcomes', outcomesRouter(db));
  // Test-only hook: registers routes after the router's own, before the 404
  // catch-all and the error handler. Production never passes it.
  options?.extend?.(router);
  router.use((_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'no such endpoint')));
  // Error-handling middleware must be registered last, after every route.
  router.use(execErrorHandler);
  return router;
}
