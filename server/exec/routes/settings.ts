import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { settingsSchema } from '../../../src/shared/exec/schemas';

type SettingsRow = {
  timezone: string;
  week_start_day: number;
  work_days: string;
  deep_work_start: string;
  deep_work_minutes: number;
  shutdown_time: string;
  office_start: string;
  office_end: string;
  build_blocks: string;
};

/** Read-only in Phase 2; Phase 4 adds PUT. The row's two JSON columns are decoded here. */
export function settingsRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow | undefined;
    if (!row) throw new ApiError(500, 'INTERNAL', 'settings row is missing');
    const parsed = settingsSchema.safeParse({
      timezone: row.timezone,
      weekStartDay: row.week_start_day,
      workDays: JSON.parse(row.work_days),
      deepWorkStart: row.deep_work_start,
      deepWorkMinutes: row.deep_work_minutes,
      shutdownTime: row.shutdown_time,
      officeStart: row.office_start,
      officeEnd: row.office_end,
      buildBlocks: JSON.parse(row.build_blocks),
    });
    if (!parsed.success) throw new ApiError(500, 'INTERNAL', 'settings row is invalid');
    ok(res, parsed.data);
  });
  return router;
}
