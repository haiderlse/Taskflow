import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { patchOutcome, rollOutcome } from '../outcomes/store';
import { outcomePatchSchema, outcomeRollSchema } from '../../../src/shared/exec/schemas';

export function outcomesRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such outcome');

  router.patch('/:id', (req, res) => {
    const outcome = patchOutcome(db, req.params.id, outcomePatchSchema.parse(req.body), clock());
    if (!outcome) throw notFound();
    ok(res, outcome);
  });

  router.post('/:id/roll', (req, res) => {
    const { weekId } = outcomeRollSchema.parse(req.body);
    const result = rollOutcome(db, req.params.id, weekId, clock());
    if (!result) throw notFound();
    ok(res, result.outcome, result.created ? 201 : 200);
  });

  return router;
}
