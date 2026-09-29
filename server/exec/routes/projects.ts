import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { projectCreateSchema, projectPatchSchema } from '../../../src/shared/exec/schemas';
import { listProjectSummaries, getProjectDetail, createProject, patchProject } from '../projects/store';

export function projectsRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such project');

  router.get('/', (_req, res) => ok(res, listProjectSummaries(db)));

  router.get('/:id', (req, res) => {
    const detail = getProjectDetail(db, req.params.id);
    if (!detail) throw notFound();
    ok(res, detail);
  });

  router.post('/', (req, res) => {
    ok(res, createProject(db, projectCreateSchema.parse(req.body), clock()), 201);
  });

  router.patch('/:id', (req, res) => {
    const project = patchProject(db, req.params.id, projectPatchSchema.parse(req.body), clock());
    if (!project) throw notFound();
    ok(res, project);
  });

  return router;
}
