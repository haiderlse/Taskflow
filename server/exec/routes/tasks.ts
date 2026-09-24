import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { taskCreateSchema, taskPatchSchema, taskRollSchema, taskListQuerySchema } from '../../../src/shared/exec/schemas';
import { listTasks, createTask, patchTask, rollTask, deleteTask } from '../tasks/store';

/** Parses, calls the store, answers in the envelope. Every thrown error reaches execErrorHandler. */
export function tasksRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such task');

  router.get('/', (req, res) => {
    ok(res, listTasks(db, taskListQuerySchema.parse(req.query)));
  });

  router.post('/', (req, res) => {
    ok(res, createTask(db, taskCreateSchema.parse(req.body), clock()), 201);
  });

  router.patch('/:id', (req, res) => {
    const task = patchTask(db, req.params.id, taskPatchSchema.parse(req.body), clock());
    if (!task) throw notFound();
    ok(res, task);
  });

  router.post('/:id/roll', (req, res) => {
    const task = rollTask(db, req.params.id, taskRollSchema.parse(req.body).date, clock());
    if (!task) throw notFound();
    ok(res, task);
  });

  router.delete('/:id', (req, res) => {
    const result = deleteTask(db, req.params.id);
    if (result === 'missing') throw notFound();
    if (result === 'not_allowed') {
      throw new ApiError(409, 'DELETE_NOT_ALLOWED', 'only an inbox item can be deleted; kill it instead');
    }
    ok(res, { id: req.params.id });
  });

  return router;
}
