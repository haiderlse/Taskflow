import { describe, it, expect } from 'vitest';
import { deepWorkLabel, scoreboard, scoreLine, stampInWeek, workDaysOf, type ScoreboardRows } from './scoreboard';
import { scoreboardSchema } from './reviewSchemas';
import { makeBlock, makeMustShip, makeOutcome, makeTask, makeWeekView } from '../../test/fixtures';

const SCHEDULE = { timezone: 'Asia/Karachi', workDays: [1, 2, 3, 4, 5] };
const week = makeWeekView([], { startDate: '2026-09-27' }).week;
const OTHER_WEEK = '20000000-0000-4000-8000-000000000009';
/** Karachi is UTC+5. */
const IN = '2026-09-28T06:00:00.000Z'; // Monday 11:00
const EDGE = '2026-09-26T19:00:00.000Z'; // Sunday 27 Sep 00:00, the week's first minute
const BEFORE = '2026-09-26T18:59:00.000Z'; // Saturday 26 Sep 23:59, the week before
const AFTER = '2026-10-03T19:00:00.000Z'; // Sunday 4 Oct 00:00, the next week

const rows = (overrides: Partial<ScoreboardRows> = {}): ScoreboardRows => ({ week, outcomes: [], mustShips: [], tasks: [], blocks: [], ...overrides });

describe('scoreboard', () => {
  it('names its week, says whether it was reviewed, and matches the schema', () => {
    const board = scoreboard(rows({ week: { ...week, reviewedAt: IN } }), SCHEDULE);
    expect(board).toMatchObject({ weekId: week.id, startDate: '2026-09-27', reviewedAt: IN, outcomes: { shipped: 0, total: 0 }, deepWorkMinutes: 0 });
    expect(scoreboardSchema.parse(board)).toEqual(board);
  });

  it('counts the outcomes that hold a slot or were graded, and the done ones', () => {
    const board = scoreboard(
      rows({
        outcomes: [
          makeOutcome({ slot: 1, reviewGrade: 'done', status: 'done' }),
          makeOutcome({ slot: 2, status: 'done' }), // done during the week, not yet reviewed
          makeOutcome({ slot: null, status: 'killed', reviewGrade: 'missed', reviewDisposition: 'kill' }), // killed at the review
          makeOutcome({ slot: null, status: 'killed' }), // replaced mid-week: not counted
          makeOutcome({ slot: 3, reviewGrade: 'partial', reviewDisposition: 'roll_forward' }),
          makeOutcome({ slot: 1, weekId: OTHER_WEEK }),
        ],
      }),
      SCHEDULE
    );
    expect(board.outcomes).toEqual({ shipped: 2, total: 4 });
  });

  it('counts work Must Ships on the work days and draws the strip', () => {
    const board = scoreboard(
      rows({
        mustShips: [
          makeMustShip({ date: '2026-09-28', status: 'shipped' }),
          makeMustShip({ date: '2026-09-29', status: 'partial' }),
          makeMustShip({ date: '2026-09-29', context: 'build', status: 'shipped' }),
          makeMustShip({ date: '2026-10-03', status: 'shipped' }), // Saturday is not a work day
          makeMustShip({ date: null, status: 'planned' }), // a candidate
        ],
      }),
      SCHEDULE
    );
    expect(board.mustShips).toEqual({ shipped: 1, total: 2 });
    expect(board.strip).toEqual([
      { date: '2026-09-28', status: 'shipped' },
      { date: '2026-09-29', status: 'partial' },
      { date: '2026-09-30', status: null },
      { date: '2026-10-01', status: null },
      { date: '2026-10-02', status: null },
    ]);
  });

  it('adds up the minutes of finished blocks dated in the week, less their pauses', () => {
    const board = scoreboard(
      rows({
        blocks: [
          makeBlock({ date: '2026-09-28', startedAt: '2026-09-28T03:35:00.000Z', endedAt: '2026-09-28T05:05:00.000Z', pausedSeconds: 600 }),
          makeBlock({ date: '2026-09-29', startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T04:05:30.000Z' }),
          makeBlock({ date: '2026-09-30', startedAt: '2026-09-30T03:35:00.000Z' }), // still running
          makeBlock({ date: '2026-10-04', startedAt: '2026-10-04T03:35:00.000Z', endedAt: '2026-10-04T05:05:00.000Z' }), // next week
        ],
      }),
      SCHEDULE
    );
    expect(board.deepWorkMinutes).toBe(111); // 80 min + 30.5 min, rounded
  });

  it('counts rolled, killed and delegated by the local day of their timestamps', () => {
    const board = scoreboard(
      rows({
        outcomes: [makeOutcome({ weekId: OTHER_WEEK, rolledFromId: '10000000-0000-4000-8000-000000000999', createdAt: EDGE })],
        mustShips: [
          makeMustShip({ date: '2026-09-29', rolledFromId: '40000000-0000-4000-8000-000000000999', createdAt: IN }),
          makeMustShip({ date: null, status: 'killed', closedAt: IN }),
          makeMustShip({ date: null, rolledFromId: '40000000-0000-4000-8000-000000000998', createdAt: BEFORE }),
        ],
        tasks: [
          makeTask({ rolledAt: IN }),
          makeTask({ status: 'killed', closedAt: AFTER }),
          makeTask({ status: 'killed', closedAt: IN }),
          makeTask({ status: 'delegated', ownerName: 'Bilal', delegatedAt: EDGE }),
          makeTask({ status: 'waiting', ownerName: 'Bilal', delegatedAt: BEFORE }),
        ],
      }),
      SCHEDULE
    );
    expect(board).toMatchObject({ rolledForward: 3, killed: 2, delegated: 1 });
  });
});

describe('scoreboard helpers', () => {
  it('places a timestamp on its Karachi day', () => {
    expect(stampInWeek(EDGE, '2026-09-27', 'Asia/Karachi')).toBe(true);
    expect(stampInWeek(BEFORE, '2026-09-27', 'Asia/Karachi')).toBe(false);
    expect(stampInWeek(AFTER, '2026-09-27', 'Asia/Karachi')).toBe(false);
    expect(stampInWeek(null, '2026-09-27', 'Asia/Karachi')).toBe(false);
  });

  it('lists the work days of a week', () => {
    expect(workDaysOf('2026-09-27', [0, 6])).toEqual(['2026-09-27', '2026-10-03']);
  });

  it('writes minutes as hours and minutes, and the week as one line', () => {
    expect([0, 45, 60, 200].map((minutes) => deepWorkLabel(minutes))).toEqual(['0 min', '45 min', '1 h', '3 h 20 min']);
    const board = scoreboard(rows({ mustShips: [makeMustShip({ date: '2026-09-28', status: 'shipped' })] }), SCHEDULE);
    expect(scoreLine(board)).toBe('0 of 0 outcomes · 1 of 1 Must Ships · 0 min deep work');
  });
});
