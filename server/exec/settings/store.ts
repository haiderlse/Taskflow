import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { settingsSchema, type Settings } from '../../../src/shared/exec/schemas';

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

const invalid = () => new ApiError(500, 'INTERNAL', 'settings row is invalid');

function decodeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw invalid();
  }
}

/** The single settings row, JSON columns decoded and validated; fails closed rather than leak a bad row. */
export function getSettings(db: Database.Database): Settings {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow | undefined;
  if (!row) throw new ApiError(500, 'INTERNAL', 'settings row is missing');
  const parsed = settingsSchema.safeParse({
    timezone: row.timezone,
    weekStartDay: row.week_start_day,
    workDays: decodeJson(row.work_days),
    deepWorkStart: row.deep_work_start,
    deepWorkMinutes: row.deep_work_minutes,
    shutdownTime: row.shutdown_time,
    officeStart: row.office_start,
    officeEnd: row.office_end,
    buildBlocks: decodeJson(row.build_blocks),
  });
  if (!parsed.success) throw invalid();
  return parsed.data;
}
