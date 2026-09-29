import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { createMustShip, listMustShips, patchMustShip, rollMustShip } from '../mustShips/store';
import { mustShipCreateSchema, mustShipPatchSchema, mustShipQuerySchema, mustShipRollSchema } from '../../../src/shared/exec/todaySchemas';

export function mustShipsRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such must ship');

  router.get('/', (req, res) => {
    const query = mustShipQuerySchema.parse(req.query);
    ok(res, listMustShips(db, query, getSettings(db).weekStartDay));
  });

  router.post('/', (req, res) => {
    const input = mustShipCreateSchema.parse(req.body);
    ok(res, createMustShip(db, input, clock()), 201);
  });

  router.patch('/:id', (req, res) => {
    const patch = mustShipPatchSchema.parse(req.body);
    const mustShip = patchMustShip(db, req.params.id, patch, clock());
    if (!mustShip) throw notFound();
    ok(res, mustShip);
  });

  router.post('/:id/roll', (req, res) => {
    const { date } = mustShipRollSchema.parse(req.body);
    const copy = rollMustShip(db, req.params.id, date, clock());
    if (!copy) throw notFound();
    ok(res, copy, 201);
  });

  return router;
}
