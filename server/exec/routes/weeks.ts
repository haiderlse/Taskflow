import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { ensureWeek, getWeek, getWeekView, lookupWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { weekHistory, weekScoreboard } from '../review/scoreboard';
import { reviewWeek } from '../review/week';
import { outcomeCreateSchema, weekCreateSchema, weekQuerySchema } from '../../../src/shared/exec/schemas';
import { weekHistoryQuerySchema, weekReviewSchema } from '../../../src/shared/exec/reviewSchemas';

export function weeksRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such week');
  const weekStartDay = () => getSettings(db).weekStartDay;

  router.get('/', (req, res) => {
    const { date } = weekQuerySchema.parse(req.query);
    ok(res, lookupWeek(db, date, weekStartDay()));
  });

  // Registered before '/:id', or "history" would be read as a week id.
  router.get('/history', (req, res) => {
    const { before } = weekHistoryQuerySchema.parse(req.query);
    ok(res, weekHistory(db, before, getSettings(db)));
  });

  router.post('/', (req, res) => {
    const { date } = weekCreateSchema.parse(req.body);
    const { view, created } = ensureWeek(db, date, weekStartDay(), clock());
    ok(res, view, created ? 201 : 200);
  });

  router.get('/:id', (req, res) => {
    const view = getWeekView(db, req.params.id);
    if (!view) throw notFound();
    ok(res, view);
  });

  router.get('/:id/scoreboard', (req, res) => {
    const week = getWeek(db, req.params.id);
    if (!week) throw notFound();
    ok(res, weekScoreboard(db, week, getSettings(db)));
  });

  router.post('/:id/review', (req, res) => {
    const { notes } = weekReviewSchema.parse(req.body ?? {});
    const week = reviewWeek(db, req.params.id, notes, clock());
    if (!week) throw notFound();
    ok(res, week);
  });

  router.post('/:id/outcomes', (req, res) => {
    const input = outcomeCreateSchema.parse(req.body);
    if (!getWeek(db, req.params.id)) throw notFound();
    ok(res, addOutcome(db, req.params.id, input, clock()), 201);
  });

  return router;
}
