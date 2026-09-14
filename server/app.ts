import express, { type ErrorRequestHandler } from 'express';
import type Database from 'better-sqlite3';
import { openDb, initSchema } from './db/connection';
import { seed } from './db/seed';
import { usersRouter } from './routes/users';
import { projectsRouter } from './routes/projects';
import { tasksRouter } from './routes/tasks';
import { BadRequestError } from './db/sql';

// Never a stack trace, never a file path, never a driver-internal message —
// only a short, safe description of what was wrong with the request.
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof BadRequestError) {
    res.status(400).json({ error: err.message });
    return;
  }
  const sqliteCode = (err as { code?: unknown } | null | undefined)?.code;
  if (typeof sqliteCode === 'string' && sqliteCode.startsWith('SQLITE_CONSTRAINT')) {
    console.error('Constraint violation:', err);
    res.status(400).json({ error: 'constraint violation' });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
};

export function createApp(injected?: Database.Database) {
  let db = injected;
  if (!db) {
    // A future test that forgets to inject a database must fail loudly
    // here, not silently create and seed a real data/taskflow.db file.
    if (process.env.VITEST || process.env.NODE_ENV === 'test') {
      throw new Error(
        "createApp() was called without an injected database while running under the test runner " +
        "(VITEST or NODE_ENV=test is set). Inject one explicitly, e.g. createApp(openDb(':memory:'))."
      );
    }
    db = openDb(process.env.DB_PATH ?? 'data/taskflow.db');
    initSchema(db);
    seed(db);
  }
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/users', usersRouter(db));
  app.use('/api/projects', projectsRouter(db));
  app.use('/api/tasks', tasksRouter(db));
  // Error-handling middleware must be registered last, after all routes.
  app.use(errorHandler);
  return app;
}
