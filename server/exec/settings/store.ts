import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { settingsSchema, type Settings } from '../../../src/shared/exec/schemas';
import type { SettingsUpdate } from '../../../src/shared/exec/todaySchemas';

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

/** Replaces the editable schedule (spec B, PUT /settings); the time zone and week start stay as seeded. */
export function putSettings(db: Database.Database, input: SettingsUpdate, now: string): Settings {
  const workDays = [...input.workDays].sort((a, b) => a - b);
  const buildBlocks = [...input.buildBlocks].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  db.prepare(
    `UPDATE settings SET work_days = ?, deep_work_start = ?, deep_work_minutes = ?, shutdown_time = ?,
       office_start = ?, office_end = ?, build_blocks = ?, updated_at = ? WHERE id = 1`
  ).run(
    JSON.stringify(workDays),
    input.deepWorkStart,
    input.deepWorkMinutes,
    input.shutdownTime,
    input.officeStart,
    input.officeEnd,
    JSON.stringify(buildBlocks),
    now
  );
  return getSettings(db);
}
