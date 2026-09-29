import { describe, it, expect } from 'vitest';
import { daySlotsSchema, dayViewSchema, mustShipCreateSchema, mustShipPatchSchema, mustShipQuerySchema, settingsUpdateSchema } from './todaySchemas';

describe('Phase 4 schemas', () => {
  const ID = '00000000-0000-4000-8000-000000000001';
  const schedule = {
    workDays: [1, 2, 3, 4, 5],
    deepWorkStart: '08:35',
    deepWorkMinutes: 90,
    shutdownTime: '17:00',
    officeStart: '08:15',
    officeEnd: '18:00',
    buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }],
  };

  it('fills Must Ship defaults: a candidate with no links', () => {
    expect(mustShipCreateSchema.parse({ title: ' Supplier tracker sent ', context: 'work' })).toEqual({
      title: 'Supplier tracker sent',
      context: 'work',
      date: null,
      definitionOfDone: '',
      outcomeId: null,
      projectId: null,
      notes: '',
    });
  });

  it('never lets a client write lineage, counts or timestamps on a Must Ship', () => {
    expect(mustShipPatchSchema.safeParse({ rollCount: 2 }).success).toBe(false);
    expect(mustShipPatchSchema.safeParse({ closedAt: '2026-09-29T10:00:00.000Z' }).success).toBe(false);
    expect(mustShipPatchSchema.safeParse({}).success).toBe(false);
    expect(mustShipPatchSchema.parse({ status: 'blocked', blockerWhat: 'Supplier silent' })).toEqual({ status: 'blocked', blockerWhat: 'Supplier silent' });
  });

  it('reads candidates as date=none and splits a status list', () => {
    expect(mustShipQuerySchema.parse({ date: 'none', status: 'planned,blocked' })).toEqual({ date: 'none', status: ['planned', 'blocked'] });
    expect(mustShipQuerySchema.safeParse({ date: 'tomorrow' }).success).toBe(false);
    expect(mustShipQuerySchema.safeParse({ status: 'shipped,lost' }).success).toBe(false);
  });

  it('accepts up to twenty slot ids so the store can answer SLOT_LIMIT itself', () => {
    expect(daySlotsSchema.parse({ taskIds: [ID, ID, ID] }).taskIds).toHaveLength(3);
    expect(daySlotsSchema.safeParse({ taskIds: Array.from({ length: 21 }, () => ID) }).success).toBe(false);
    expect(daySlotsSchema.safeParse({ taskIds: ['nope'] }).success).toBe(false);
  });

  it('describes an empty day', () => {
    const empty = { date: '2026-09-29', day: null, week: null, hasHistory: false, mustShip: null, buildMustShip: null, secondaries: [], waiting: [], blocks: [], inboxCount: 0 };
    expect(dayViewSchema.safeParse(empty).success).toBe(true);
  });

  it('edits the schedule but never the time zone or the week start', () => {
    expect(settingsUpdateSchema.parse(schedule)).toEqual(schedule);
    expect(settingsUpdateSchema.safeParse({ ...schedule, timezone: 'UTC' }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...schedule, weekStartDay: 1 }).success).toBe(false);
  });

  it('refuses reversed office hours and a repeated work day, and allows no work days at all', () => {
    const reversed = settingsUpdateSchema.safeParse({ ...schedule, officeStart: '18:00', officeEnd: '08:15' });
    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues[0]).toMatchObject({ path: ['officeEnd'], message: 'office hours must start before they end' });
    expect(settingsUpdateSchema.safeParse({ ...schedule, workDays: [1, 1] }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...schedule, workDays: [] }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ ...schedule, deepWorkMinutes: 5 }).success).toBe(false);
  });
});
