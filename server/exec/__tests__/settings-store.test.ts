import { describe, it, expect } from 'vitest';
import { prepareExecDb } from '../db/prepare';
import { getSettings } from '../settings/store';

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
