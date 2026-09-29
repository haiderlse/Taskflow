import { describe, it, expect } from 'vitest';
import { todayMode, nextWorkDay, dayLabel } from './today';
import type { Outcome, Settings } from './schemas';
import type { DayView, DeepWorkBlock, MustShip } from './todaySchemas';

const SETTINGS: Settings = {
  timezone: 'Asia/Karachi',
  weekStartDay: 0,
  workDays: [1, 2, 3, 4, 5],
  deepWorkStart: '08:35',
  deepWorkMinutes: 90,
  shutdownTime: '17:00',
  officeStart: '08:15',
  officeEnd: '18:00',
  buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }],
};
const STAMP = '2026-09-27T03:00:00.000Z';
const MS_ID = '40000000-0000-4000-8000-000000000001';

/** Karachi is UTC+5 all year: a local HH:MM on a date as a Date. */
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const utc = h * 60 + m - 300;
  return new Date(`${date}T${String(Math.floor(utc / 60)).padStart(2, '0')}:${String(utc % 60).padStart(2, '0')}:00Z`);
};

const mustShip = (overrides: Partial<MustShip> = {}): MustShip => ({
  id: MS_ID, title: 'Supplier tracker sent', definitionOfDone: '', context: 'work', date: '2026-09-29', outcomeId: null, projectId: null,
  status: 'planned', blockerWhat: null, blockerOwner: null, blockerNextAction: null, notes: '', rolledFromId: null, rollCount: 0,
  closedAt: null, createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const block = (overrides: Partial<DeepWorkBlock> = {}): DeepWorkBlock => ({
  id: '50000000-0000-4000-8000-000000000001', date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90,
  outcomeId: null, mustShipId: MS_ID, startedAt: null, endedAt: null, pausedSeconds: 0, pauseStartedAt: null, result: null,
  notes: '', createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const outcome = { slot: 1, status: 'active' } as Outcome;
const planned = { week: { id: 'w', startDate: '2026-09-27', reviewedAt: null, reviewNotes: '', createdAt: STAMP, updatedAt: STAMP }, outcomes: [outcome] };

const view = (overrides: Partial<DayView> = {}): DayView => ({
  date: '2026-09-29', day: null, week: planned, hasHistory: true, mustShip: null, buildMustShip: null,
  secondaries: [], waiting: [], blocks: [], inboxCount: 0, ...overrides,
});
const shutDown = { date: '2026-09-29', shutdownAt: '2026-09-29T12:10:00.000Z', notes: '', createdAt: STAMP, updatedAt: STAMP };

describe('todayMode: the primary card (spec C, first match wins)', () => {
  it.each([
    ['a non-work day', at('2026-10-03', '10:00'), view()],
    ['before office_start', at('2026-09-29', '08:14'), view({ mustShip: mustShip() })],
    ['at office_end exactly', at('2026-09-29', '18:00'), view({ mustShip: mustShip() })],
  ])('is the Build card on %s', (_label, now, day) => {
    expect(todayMode(now, SETTINGS, day).primary).toEqual({ kind: 'build' });
  });

  it('is in the office at office_start exactly', () => {
    expect(todayMode(at('2026-09-29', '08:15'), SETTINGS, view()).primary).toEqual({ kind: 'choose' });
  });

  it('shows tomorrow once today is shut down, even with a Must Ship', () => {
    expect(todayMode(at('2026-09-29', '17:30'), SETTINGS, view({ day: shutDown, mustShip: mustShip() })).primary).toEqual({ kind: 'tomorrow' });
  });

  it('asks for today\'s Must Ship when there is none', () => {
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view()).primary).toEqual({ kind: 'choose' });
  });

  it('resumes a live or paused block', () => {
    const live = block({ startedAt: '2026-09-29T03:40:00.000Z' });
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [live] })).primary).toEqual({ kind: 'resume', blockId: live.id });
  });

  it('asks for the result once the Must Ship\'s block has ended and it is still planned', () => {
    const ended = block({ startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T05:05:00.000Z' });
    expect(todayMode(at('2026-09-29', '11:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [ended] })).primary).toEqual({ kind: 'grade', mustShipId: MS_ID });
  });

  it('falls through to Start deep work otherwise, including after the Must Ship shipped', () => {
    const ended = block({ startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T05:05:00.000Z' });
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view({ mustShip: mustShip() })).primary).toEqual({ kind: 'start', mustShipId: MS_ID });
    expect(todayMode(at('2026-09-29', '11:00'), SETTINGS, view({ mustShip: mustShip({ status: 'shipped' }), blocks: [ended] })).primary).toEqual({ kind: 'start', mustShipId: MS_ID });
  });

  it('treats every day as a Build day when there are no work days', () => {
    expect(todayMode(at('2026-09-29', '10:00'), { ...SETTINGS, workDays: [] }, view()).primary).toEqual({ kind: 'build' });
  });
});

describe('todayMode: banners', () => {
  it('asks for a plan while no outcome holds a slot, killed ones included', () => {
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view({ week: null })).banners).toEqual(['plan']);
    const killedOnly = { ...planned, outcomes: [{ slot: null, status: 'killed' } as Outcome] };
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view({ week: killedOnly })).banners).toEqual(['plan']);
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view()).banners).toEqual([]);
  });

  it('asks to close the day from shutdown_time on a work day until the shutdown is done', () => {
    expect(todayMode(at('2026-09-29', '16:59'), SETTINGS, view()).banners).toEqual([]);
    expect(todayMode(at('2026-09-29', '17:00'), SETTINGS, view()).banners).toEqual(['close']);
    expect(todayMode(at('2026-09-29', '20:00'), SETTINGS, view()).banners).toEqual(['close']);
    expect(todayMode(at('2026-09-29', '17:30'), SETTINGS, view({ day: shutDown })).banners).toEqual([]);
    expect(todayMode(at('2026-10-03', '17:30'), SETTINGS, view()).banners).toEqual([]);
  });

  it('reports the local clock it decided with', () => {
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view()).clock).toEqual({ date: '2026-09-29', weekday: 2, minutes: 540 });
  });
});

describe('nextWorkDay and dayLabel', () => {
  it('skips the weekend and never loops without work days', () => {
    expect(nextWorkDay('2026-10-02', [1, 2, 3, 4, 5])).toBe('2026-10-05');
    expect(nextWorkDay('2026-09-29', [1, 2, 3, 4, 5])).toBe('2026-09-30');
    expect(nextWorkDay('2026-09-29', [])).toBe('2026-09-30');
  });

  it('names a day the way Today shows it', () => {
    expect(dayLabel('2026-09-29')).toBe('Tuesday 29 September');
    expect(dayLabel('2027-03-02')).toBe('Tuesday 2 March');
  });
});
