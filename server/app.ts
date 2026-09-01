import express from 'express';
import type Database from 'better-sqlite3';
import { openDb, initSchema } from './db/connection';
import { seed } from './db/seed';
import { usersRouter } from './routes/users';

export function createApp(injected?: Database.Database) {
  let db = injected;
  if (!db) {
    db = openDb(process.env.DB_PATH ?? 'data/taskflow.db');
    initSchema(db);
    seed(db);
  }
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/users', usersRouter(db));
  return app;
}
