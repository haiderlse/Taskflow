import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { createBlock, listBlocks, patchBlock, pauseBlock, resumeBlock, startBlock } from '../deepWork/store';
import { finishBlock } from '../deepWork/finish';
import { deepWorkCreateSchema, deepWorkFinishSchema, deepWorkPatchSchema, deepWorkQuerySchema } from '../../../src/shared/exec/deepWorkSchemas';

export function deepWorkRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const found = <T>(value: T | null): T => {
    if (value === null) throw new ApiError(404, 'NOT_FOUND', 'no such block');
    return value;
  };

  router.get('/', (req, res) => ok(res, listBlocks(db, deepWorkQuerySchema.parse(req.query))));

  router.post('/', (req, res) => ok(res, createBlock(db, deepWorkCreateSchema.parse(req.body), clock()), 201));

  router.patch('/:id', (req, res) => {
    const patch = deepWorkPatchSchema.parse(req.body);
    ok(res, found(patchBlock(db, req.params.id, patch, clock())));
  });

  router.post('/:id/start', (req, res) => ok(res, found(startBlock(db, req.params.id, clock()))));
  router.post('/:id/pause', (req, res) => ok(res, found(pauseBlock(db, req.params.id, clock()))));
  router.post('/:id/resume', (req, res) => ok(res, found(resumeBlock(db, req.params.id, clock()))));

  router.post('/:id/finish', (req, res) => {
    const input = deepWorkFinishSchema.parse(req.body);
    ok(res, found(finishBlock(db, req.params.id, input, clock())));
  });

  return router;
}
