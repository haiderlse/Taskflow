import { describe, it, expect } from 'vitest';
import { blockBox, countdownLabel, defaultBlocksFor, elapsed, gridRange, minutesByOutcome, minutesToHhmm, snapDown, weekRange, withoutPlaced } from './deepWork';
import type { Settings } from './schemas';
import type { DeepWorkBlock } from './todaySchemas';

const SETTINGS: Settings = {
  timezone: 'Asia/Karachi',
  weekStartDay: 0,
  workDays: [1, 2, 3, 4, 5],
  deepWorkStart: '08:35',
  deepWorkMinutes: 90,
  shutdownTime: '17:00',
  officeStart: '08:15',
  officeEnd: '18:00',
  buildBlocks: [
    { weekday: 2, start: '06:30', minutes: 50 },
    { weekday: 4, start: '06:30', minutes: 50 },
    { weekday: 6, start: '09:00', minutes: 180 },
  ],
};

const timed = (overrides: Partial<Parameters<typeof elapsed>[0]> = {}) => ({
  plannedMinutes: 90,
  startedAt: '2026-09-29T03:35:00.000Z' as string | null,
  endedAt: null as string | null,
  pausedSeconds: 0,
  pauseStartedAt: null as string | null,
  ...overrides,
});

describe('elapsed', () => {
  it('is untouched before the start', () => {
    expect(elapsed(timed({ startedAt: null }), new Date('2026-09-29T03:40:00Z'))).toEqual({ seconds: 0, remaining: 5400, paused: false });
  });

  it('counts down from the planned minutes', () => {
    expect(elapsed(timed(), new Date('2026-09-29T03:40:00Z'))).toEqual({ seconds: 300, remaining: 5100, paused: false });
  });

  it('leaves out pauses already folded in', () => {
    expect(elapsed(timed({ pausedSeconds: 120 }), new Date('2026-09-29T03:45:00Z')).seconds).toBe(480);
  });

  it('freezes while paused, and a reload an hour later says the same', () => {
    const paused = timed({ pauseStartedAt: '2026-09-29T03:45:00.000Z' });
    expect(elapsed(paused, new Date('2026-09-29T03:50:00Z'))).toEqual({ seconds: 600, remaining: 4800, paused: true });
    expect(elapsed(paused, new Date('2026-09-29T04:50:00Z')).seconds).toBe(600);
  });

  it('stops at the end, and ignores a pause left open on a finished block', () => {
    const done = timed({ endedAt: '2026-09-29T04:05:00.000Z', pauseStartedAt: '2026-09-29T04:00:00.000Z' });
    expect(elapsed(done, new Date('2026-09-30T09:00:00Z'))).toEqual({ seconds: 1800, remaining: 3600, paused: false });
  });

  it('counts up quietly past zero', () => {
    expect(elapsed(timed(), new Date('2026-09-29T05:15:00Z'))).toMatchObject({ seconds: 6000, remaining: -600 });
  });

  it('never goes negative when the clock is behind the server', () => {
    expect(elapsed(timed(), new Date('2026-09-29T03:34:00Z'))).toMatchObject({ seconds: 0, remaining: 5400 });
  });
});

describe('countdownLabel, minutesToHhmm and snapDown', () => {
  it('shows minutes and seconds, and a plus past zero', () => {
    expect(countdownLabel(5400)).toBe('90:00');
    expect(countdownLabel(65)).toBe('01:05');
    expect(countdownLabel(0)).toBe('00:00');
    expect(countdownLabel(-130)).toBe('+02:10');
  });

  it('formats and snaps minutes of the day', () => {
    expect(minutesToHhmm(515)).toBe('08:35');
    expect(minutesToHhmm(0)).toBe('00:00');
    expect(snapDown(515)).toBe(510);
    expect(snapDown(510)).toBe(510);
    expect(snapDown(1439)).toBe(1425);
  });
});

describe('defaultBlocksFor', () => {
  it('places a work block each work day and the build blocks on their weekdays', () => {
    const list = defaultBlocksFor('2026-09-27', SETTINGS).map((block) => `${block.date} ${block.context} ${block.plannedStart} ${block.plannedMinutes}`);
    expect(list).toEqual([
      '2026-09-28 work 08:35 90',
      '2026-09-29 build 06:30 50',
      '2026-09-29 work 08:35 90',
      '2026-09-30 work 08:35 90',
      '2026-10-01 build 06:30 50',
      '2026-10-01 work 08:35 90',
      '2026-10-02 work 08:35 90',
      '2026-10-03 build 09:00 180',
    ]);
  });

  it('places nothing for work when there are no work days, and clamps a block at midnight', () => {
    const late = { ...SETTINGS, workDays: [], buildBlocks: [{ weekday: 0, start: '22:00', minutes: 600 }, { weekday: 1, start: '23:50', minutes: 30 }] };
    expect(defaultBlocksFor('2026-09-27', late)).toEqual([{ date: '2026-09-27', context: 'build', plannedStart: '22:00', plannedMinutes: 120 }]);
  });
});

const persisted = (overrides: Partial<DeepWorkBlock>): DeepWorkBlock => ({
  id: '50000000-0000-4000-8000-000000000001', date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null,
  startedAt: null, endedAt: null, pausedSeconds: 0, pauseStartedAt: null, result: null, notes: '', createdAt: '2026-09-27T03:00:00.000Z', updatedAt: '2026-09-27T03:00:00.000Z', ...overrides,
});

describe('withoutPlaced, weekRange and the grid helpers', () => {
  it('drops a proposal a saved block already covers, matching date, context and start', () => {
    const proposals = defaultBlocksFor('2026-09-27', SETTINGS);
    const left = withoutPlaced(proposals, [persisted({}), persisted({ date: '2026-09-29', context: 'build', plannedStart: '06:45' })]);
    expect(left).toHaveLength(proposals.length - 1);
    expect(left.find((block) => block.date === '2026-09-29' && block.context === 'work')).toBeUndefined();
    expect(left.find((block) => block.date === '2026-09-29' && block.context === 'build')).toBeDefined();
  });

  it('spans a planning week', () => {
    expect(weekRange('2026-09-27')).toEqual({ from: '2026-09-27', to: '2026-10-03' });
  });

  it('shows at least 06:00 to 19:00 and widens to whole hours around anything outside', () => {
    expect(gridRange([])).toEqual({ start: 360, end: 1140 });
    expect(gridRange([{ plannedStart: '08:35', plannedMinutes: 90 }])).toEqual({ start: 360, end: 1140 });
    expect(gridRange([{ plannedStart: '05:15', plannedMinutes: 30 }, { plannedStart: '19:30', plannedMinutes: 90 }])).toEqual({ start: 300, end: 1260 });
  });

  it('places a block as percentages of the range', () => {
    const range = { start: 360, end: 1140 };
    const first = blockBox('06:00', 78, range);
    expect(first.top).toBeCloseTo(0);
    expect(first.height).toBeCloseTo(10);
    const second = blockBox('12:30', 390, range);
    expect(second.top).toBeCloseTo(50);
    expect(second.height).toBeCloseTo(50);
  });
});

describe('minutesByOutcome', () => {
  it('adds planned minutes for every linked block and done minutes for finished ones', () => {
    const outcome = '10000000-0000-4000-8000-000000000001';
    const totals = minutesByOutcome([
      persisted({ outcomeId: outcome, plannedMinutes: 90 }),
      persisted({ outcomeId: outcome, plannedMinutes: 60, startedAt: '2026-09-30T03:35:00.000Z', endedAt: '2026-09-30T04:20:00.000Z', pausedSeconds: 300, result: 'progress' }),
      persisted({ outcomeId: null, plannedMinutes: 30 }),
    ]);
    expect(totals).toEqual({ [outcome]: { planned: 150, done: 40 } });
  });
});
