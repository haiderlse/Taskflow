import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { getDayView, setDaySlots } from '../days/store';
import { dayParamsSchema, daySlotsSchema } from '../../../src/shared/exec/todaySchemas';

export function daysRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const weekStartDay = () => getSettings(db).weekStartDay;

  router.get('/:date', (req, res) => {
    const { date } = dayParamsSchema.parse(req.params);
    ok(res, getDayView(db, date, weekStartDay()));
  });

  router.put('/:date/slots', (req, res) => {
    const { date } = dayParamsSchema.parse(req.params);
    const { taskIds } = daySlotsSchema.parse(req.body);
    ok(res, setDaySlots(db, date, taskIds, clock(), weekStartDay()));
  });

  return router;
}
