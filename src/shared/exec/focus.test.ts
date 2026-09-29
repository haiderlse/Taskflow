import { describe, it, expect } from 'vitest';
import { newBlockFor, planFocus } from './focus';
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
const STAMP = '2026-09-29T03:00:00.000Z';
const MS_ID = '40000000-0000-4000-8000-000000000001';
const BUILD_MS_ID = '40000000-0000-4000-8000-000000000002';
const OUTCOME_ID = '10000000-0000-4000-8000-000000000001';

/** Karachi is UTC+5: a local HH:MM on 2026-09-29 (a Tuesday) as a Date. */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const utc = h * 60 + m - 300;
  return new Date(`2026-09-29T${String(Math.floor(utc / 60)).padStart(2, '0')}:${String(utc % 60).padStart(2, '0')}:00Z`);
};

const mustShip = (overrides: Partial<MustShip> = {}): MustShip => ({
  id: MS_ID, title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20', context: 'work', date: '2026-09-29', outcomeId: null, projectId: null, status: 'planned',
  blockerWhat: null, blockerOwner: null, blockerNextAction: null, notes: 'Use the March template', rolledFromId: null, rollCount: 0, closedAt: null, createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const block = (overrides: Partial<DeepWorkBlock> = {}): DeepWorkBlock => ({
  id: '50000000-0000-4000-8000-000000000001', date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null,
  startedAt: null, endedAt: null, pausedSeconds: 0, pauseStartedAt: null, result: null, notes: '', createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const outcome = (overrides: Partial<Outcome> = {}): Outcome => ({
  id: OUTCOME_ID, weekId: '20000000-0000-4000-8000-000000000001', slot: 1, title: 'Healify beta live', description: '', category: 'business', definitionOfDone: 'Ten users on it',
  targetDate: null, projectId: null, progress: 0, status: 'active', reviewGrade: null, reviewReason: null, reviewDisposition: null, rolledFromId: null, notes: 'Start with onboarding',
  closedAt: null, createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const view = (overrides: Partial<DayView> = {}, outcomes: Outcome[] = []): DayView => ({
  date: '2026-09-29', day: null, hasHistory: true, mustShip: null, buildMustShip: null, secondaries: [], waiting: [], blocks: [], inboxCount: 0,
  week: { week: { id: '20000000-0000-4000-8000-000000000001', startDate: '2026-09-27', reviewedAt: null, reviewNotes: '', createdAt: STAMP, updatedAt: STAMP }, outcomes }, ...overrides,
});

describe('planFocus', () => {
  it('resumes the live block whatever the hour or context, with its Must Ship as the subject', () => {
    const live = block({ context: 'work', mustShipId: MS_ID, startedAt: '2026-09-29T03:40:00.000Z' });
    const plan = planFocus(at('20:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [live] }));
    expect(plan).toEqual({ kind: 'live', block: live, subject: { title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20', notes: 'Use the March template' } });
  });

  it('falls back to the linked outcome, then to a plain title, for a live block with no Must Ship', () => {
    const linked = block({ context: 'build', outcomeId: OUTCOME_ID, startedAt: '2026-09-29T01:40:00.000Z' });
    expect(planFocus(at('07:00'), SETTINGS, view({ blocks: [linked] }, [outcome()]))).toMatchObject({ kind: 'live', subject: { title: 'Healify beta live', definitionOfDone: 'Ten users on it' } });
    const bare = block({ startedAt: '2026-09-29T03:40:00.000Z' });
    expect(planFocus(at('09:00'), SETTINGS, view({ blocks: [bare] }))).toMatchObject({ kind: 'live', subject: { title: 'Deep work', definitionOfDone: '', notes: '' } });
  });

  it('ignores a finished block and starts the work Must Ship in office hours, creating a block when none is planned', () => {
    const done = block({ startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T03:50:00.000Z' });
    expect(planFocus(at('09:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [done] }))).toMatchObject({ kind: 'start', context: 'work', block: null, subject: { title: 'Delivery tracker sent' } });
  });

  it('starts the earliest unstarted block of the moment\'s context', () => {
    const later = block({ id: '50000000-0000-4000-8000-000000000003', plannedStart: '14:00' });
    const early = block({ id: '50000000-0000-4000-8000-000000000002', plannedStart: '08:35' });
    const other = block({ id: '50000000-0000-4000-8000-000000000004', context: 'build', plannedStart: '06:30' });
    expect(planFocus(at('09:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [other, early, later] }))).toMatchObject({ kind: 'start', block: { id: early.id } });
  });

  it('starts nothing for a Must Ship that is no longer planned, and nothing without one in office hours', () => {
    expect(planFocus(at('09:00'), SETTINGS, view({ mustShip: mustShip({ status: 'shipped' }) }))).toEqual({ kind: 'closed', title: 'Delivery tracker sent', status: 'shipped' });
    expect(planFocus(at('09:00'), SETTINGS, view({ buildMustShip: null }))).toEqual({ kind: 'nothing' });
  });

  it('follows the clock: build outside office hours, on the build Must Ship or the block\'s outcome', () => {
    const build = mustShip({ id: BUILD_MS_ID, context: 'build', title: 'Landing page live' });
    expect(planFocus(at('07:00'), SETTINGS, view({ mustShip: mustShip(), buildMustShip: build }))).toMatchObject({ kind: 'start', context: 'build', subject: { title: 'Landing page live' } });
    const planned = block({ context: 'build', outcomeId: OUTCOME_ID, plannedStart: '06:30' });
    const other = outcome({ id: '10000000-0000-4000-8000-000000000002', title: 'Pinkbox P&L live', slot: 2 });
    expect(planFocus(at('07:00'), SETTINGS, view({ blocks: [planned] }, [other, outcome()]))).toMatchObject({ kind: 'start', subject: { title: 'Healify beta live', notes: 'Start with onboarding' } });
    expect(planFocus(at('07:00'), SETTINGS, view({}, [other, outcome()]))).toMatchObject({ kind: 'start', subject: { title: 'Pinkbox P&L live' } });
  });

  it('says there is nothing when no build Must Ship or active build outcome exists, and never uses an office outcome for build', () => {
    expect(planFocus(at('07:00'), SETTINGS, view())).toEqual({ kind: 'nothing' });
    expect(planFocus(at('07:00'), SETTINGS, view({}, [outcome({ category: 'office' }), outcome({ slot: null, status: 'killed' })]))).toEqual({ kind: 'nothing' });
  });
});

describe('newBlockFor', () => {
  it('starts now, snapped down to 15 minutes, for the deep-work length', () => {
    expect(newBlockFor(at('09:07'), SETTINGS, 'work', '2026-09-29')).toEqual({ date: '2026-09-29', context: 'work', plannedStart: '09:00', plannedMinutes: 90, outcomeId: null, mustShipId: null });
  });

  it('uses the day\'s build block length, else an hour', () => {
    expect(newBlockFor(at('07:00'), SETTINGS, 'build', '2026-09-29').plannedMinutes).toBe(50);
    expect(newBlockFor(at('07:00'), { ...SETTINGS, buildBlocks: [] }, 'build', '2026-09-29').plannedMinutes).toBe(60);
  });

  it('never runs past midnight and never drops under 15 minutes', () => {
    expect(newBlockFor(at('23:50'), SETTINGS, 'work', '2026-09-29')).toMatchObject({ plannedStart: '23:45', plannedMinutes: 15 });
    expect(newBlockFor(at('22:10'), SETTINGS, 'work', '2026-09-29')).toMatchObject({ plannedStart: '22:00', plannedMinutes: 90 });
  });
});
