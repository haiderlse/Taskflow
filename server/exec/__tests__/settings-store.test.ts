import { describe, it, expect } from 'vitest';
import { prepareExecDb } from '../db/prepare';
import { getSettings, putSettings } from '../settings/store';

describe('getSettings', () => {
  it('reads the seeded schedule with its JSON columns decoded', () => {
    expect(getSettings(prepareExecDb(':memory:'))).toMatchObject({
      timezone: 'Asia/Karachi',
      weekStartDay: 0,
      workDays: [1, 2, 3, 4, 5],
      buildBlocks: [
        { weekday: 2, start: '06:30', minutes: 50 },
        { weekday: 4, start: '06:30', minutes: 50 },
        { weekday: 6, start: '09:00', minutes: 180 },
      ],
    });
  });

  it('fails closed on a corrupted JSON column', () => {
    const db = prepareExecDb(':memory:');
    db.prepare("UPDATE settings SET work_days = 'not json' WHERE id = 1").run();
    expect(() => getSettings(db)).toThrow(/settings row is invalid/);
  });

  it('fails closed on JSON of the wrong shape', () => {
    const db = prepareExecDb(':memory:');
    db.prepare(`UPDATE settings SET work_days = '"weekdays"' WHERE id = 1`).run();
    expect(() => getSettings(db)).toThrow(/settings row is invalid/);
  });
});

describe('putSettings', () => {
  it('replaces the editable schedule, sorted, and keeps the time zone and week start', () => {
    const db = prepareExecDb(':memory:');
    const saved = putSettings(
      db,
      {
        workDays: [5, 1, 2],
        deepWorkStart: '09:00',
        deepWorkMinutes: 60,
        shutdownTime: '17:30',
        officeStart: '08:30',
        officeEnd: '18:30',
        buildBlocks: [{ weekday: 6, start: '10:00', minutes: 120 }, { weekday: 2, start: '06:30', minutes: 50 }],
      },
      '2026-09-29T04:00:00.000Z'
    );
    expect(saved).toEqual({
      timezone: 'Asia/Karachi',
      weekStartDay: 0,
      workDays: [1, 2, 5],
      deepWorkStart: '09:00',
      deepWorkMinutes: 60,
      shutdownTime: '17:30',
      officeStart: '08:30',
      officeEnd: '18:30',
      buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }, { weekday: 6, start: '10:00', minutes: 120 }],
    });
    expect(getSettings(db)).toEqual(saved);
    expect(db.prepare('SELECT updated_at FROM settings WHERE id = 1').pluck().get()).toBe('2026-09-29T04:00:00.000Z');
  });
});
