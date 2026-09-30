import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome, patchOutcome } from '../outcomes/store';
import { createMustShip, patchMustShip, rollMustShip } from '../mustShips/store';
import { createBlock, pauseBlock, resumeBlock, startBlock } from '../deepWork/store';
import { finishBlock } from '../deepWork/finish';
import { createTask, patchTask, rollTask } from '../tasks/store';
import { getSettings } from '../settings/store';
import { weekHistory, weekScoreboard } from '../review/scoreboard';
import { reviewWeek } from '../review/week';
import { ApiError } from '../http';
import type { Week } from '../../../src/shared/exec/schemas';

/** A Karachi wall-clock time as the UTC timestamp the server would store. */
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:00`).toISOString();
let db: Database.Database;
let week: Week;

const outcome = (title: string, category: 'office' | 'business' = 'office') =>
  addOutcome(db, week.id, { title, category, description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, at('2026-09-27', '10:00'));
const ship = (date: string | null, title: string) =>
  createMustShip(db, { title, context: 'work', date, definitionOfDone: '', outcomeId: null, projectId: null, notes: '' }, at('2026-09-27', '10:30'));
type Times = { start: string; end: string; pause?: [string, string] };
const session = (date: string, times: Times, result: 'completed' | 'progress') => {
  const block = createBlock(db, { date, context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null }, at(date, '08:00'));
  startBlock(db, block.id, at(date, times.start));
  if (times.pause) {
    pauseBlock(db, block.id, at(date, times.pause[0]));
    resumeBlock(db, block.id, at(date, times.pause[1]));
  }
  finishBlock(db, block.id, { result, notes: '' }, at(date, times.end));
};

beforeEach(() => {
  db = prepareExecDb(':memory:');
  week = ensureWeek(db, '2026-09-29', 0, at('2026-09-27', '09:00')).view.week;
});

/** The fixture week of 27 Sep 2026 (spec D: "scoreboard matches the fixture"). */
function playTheWeek(): void {
  const [a, b, c] = [outcome('Supplier plan confirmed'), outcome('Haleon target signed'), outcome('Pinkbox P&L live', 'business')];
  ship('2026-09-28', 'Tracker sent');
  session('2026-09-28', { start: '08:35', end: '10:05', pause: ['09:00', '09:10'] }, 'completed'); // 80 min; ships Monday
  const tuesday = ship('2026-09-29', 'Price list sent');
  session('2026-09-29', { start: '08:35', end: '09:05' }, 'progress'); // 30 min
  patchMustShip(db, tuesday.id, { status: 'partial' }, at('2026-09-29', '17:05'));
  rollMustShip(db, tuesday.id, '2026-09-30', at('2026-09-29', '17:06')); // rolled 1; Wednesday planned
  const friday = ship('2026-10-02', 'Venue booked');
  patchMustShip(db, friday.id, { status: 'blocked', blockerWhat: 'No quote', blockerOwner: 'Sana', blockerNextAction: 'Chase the quote' }, at('2026-10-02', '17:00'));
  const candidate = ship(null, 'Old idea');
  patchMustShip(db, candidate.id, { status: 'killed' }, at('2026-09-30', '12:00')); // killed 1
  const [memo, deck, survey, early] = ['Memo', 'Deck', 'Survey', 'Early'].map((title) => createTask(db, { title, context: 'work', notes: '' }, at('2026-09-27', '11:00')));
  rollTask(db, memo.id, '2026-09-30', at('2026-09-29', '17:10')); // rolled 2
  patchTask(db, deck.id, { status: 'delegated', ownerName: 'Bilal' }, at('2026-09-30', '11:00')); // delegated 1
  patchTask(db, survey.id, { status: 'killed' }, at('2026-10-01', '12:00')); // killed 2
  patchTask(db, early.id, { status: 'waiting', ownerName: 'Sana' }, at('2026-09-26', '23:30')); // the Saturday before: not this week
  patchOutcome(db, a.id, { reviewGrade: 'done', status: 'done' }, at('2026-10-02', '16:00'));
  patchOutcome(db, b.id, { reviewGrade: 'partial', reviewReason: 'insufficient_time', reviewDisposition: 'roll_forward' }, at('2026-10-02', '16:05'));
  patchOutcome(db, c.id, { reviewGrade: 'missed', reviewReason: 'priority_changed', reviewDisposition: 'kill', status: 'killed' }, at('2026-10-02', '16:10')); // killed 3
}

describe('weekScoreboard', () => {
  it('matches the fixture week', () => {
    playTheWeek();
    expect(weekScoreboard(db, week, getSettings(db))).toEqual({
      weekId: week.id,
      startDate: '2026-09-27',
      reviewedAt: null,
      outcomes: { shipped: 1, total: 3 },
      mustShips: { shipped: 1, total: 4 },
      deepWorkMinutes: 110,
      rolledForward: 2,
      killed: 3,
      delegated: 1,
      strip: [
        { date: '2026-09-28', status: 'shipped' },
        { date: '2026-09-29', status: 'partial' },
        { date: '2026-09-30', status: 'planned' },
        { date: '2026-10-01', status: null },
        { date: '2026-10-02', status: 'blocked' },
      ],
    });
  });

  it('lists earlier weeks newest first, each with its numbers', () => {
    const older = ensureWeek(db, '2026-09-15', 0, at('2026-09-13', '09:00')).view.week;
    const oldest = ensureWeek(db, '2026-09-08', 0, at('2026-09-06', '09:00')).view.week;
    const history = weekHistory(db, '2026-09-30', getSettings(db));
    expect(history.map((board) => board.startDate)).toEqual([older.startDate, oldest.startDate]);
    expect(history[0]).toMatchObject({ weekId: older.id, outcomes: { shipped: 0, total: 0 } });
    expect(weekHistory(db, '2026-09-13', getSettings(db))).toEqual([expect.objectContaining({ startDate: '2026-09-06' })]);
  });
});

describe('reviewWeek', () => {
  it('refuses while an outcome is ungraded and writes nothing', () => {
    outcome('Supplier plan confirmed');
    let refusal: unknown = null;
    try {
      reviewWeek(db, week.id, 'notes', at('2026-10-02', '17:00'));
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(ApiError);
    expect(refusal).toMatchObject({ status: 409, code: 'REVIEW_NOT_READY', message: 'grade every outcome before the review is done' });
    expect(weekScoreboard(db, week, getSettings(db)).reviewedAt).toBeNull();
  });

  it('stamps the week once every slotted outcome is graded, and a second call changes nothing', () => {
    const made = outcome('Supplier plan confirmed');
    patchOutcome(db, made.id, { reviewGrade: 'done', status: 'done' }, at('2026-10-02', '16:00'));
    const stamped = reviewWeek(db, week.id, 'A good week', at('2026-10-02', '17:00'));
    expect(stamped).toMatchObject({ reviewedAt: at('2026-10-02', '17:00'), reviewNotes: 'A good week' });
    expect(reviewWeek(db, week.id, 'Again', at('2026-10-02', '18:00'))).toEqual(stamped);
  });

  it('reviews a week with no outcomes, and answers null for a missing week', () => {
    expect(reviewWeek(db, week.id, '', at('2026-10-02', '17:00'))?.reviewedAt).toBe(at('2026-10-02', '17:00'));
    expect(reviewWeek(db, '20000000-0000-4000-8000-00000000dead', '', at('2026-10-02', '17:00'))).toBeNull();
  });
});
