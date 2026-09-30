import { describe, it, expect } from 'vitest';
import { carryCandidates, reviewedOutcomes, reviewQueue } from './review';
import { makeOutcome, makeWeekView } from '../../test/fixtures';

const PREVIOUS = '20000000-0000-4000-8000-000000000002';

describe('reviewQueue and reviewedOutcomes', () => {
  it('grades the slotted outcomes in slot order, and covers the ones killed at the review', () => {
    const third = makeOutcome({ title: 'Third', slot: 3 });
    const first = makeOutcome({ title: 'First', slot: 1, reviewGrade: 'done', status: 'done' });
    const second = makeOutcome({ title: 'Second', slot: 2 });
    const killedAtReview = makeOutcome({ title: 'Killed at review', slot: null, status: 'killed', reviewGrade: 'missed' });
    const replaced = makeOutcome({ title: 'Replaced', slot: null, status: 'killed' });
    const all = [third, first, second, killedAtReview, replaced];
    expect(reviewQueue(all).map((outcome) => outcome.title)).toEqual(['Second', 'Third']);
    expect(reviewedOutcomes(all).map((outcome) => outcome.title)).toEqual(['Third', 'First', 'Second', 'Killed at review']);
  });
});

describe('carryCandidates', () => {
  it('offers every open outcome of a week not yet reviewed, less the ones already carried', () => {
    const open = makeOutcome({ title: 'Open', weekId: PREVIOUS });
    const carried = makeOutcome({ title: 'Carried', weekId: PREVIOUS, slot: 2 });
    const done = makeOutcome({ title: 'Done', weekId: PREVIOUS, slot: 3, status: 'done' });
    const previous = makeWeekView([open, carried, done], { id: PREVIOUS });
    const mine = [makeOutcome({ title: 'Carried', rolledFromId: carried.id })];
    expect(carryCandidates(previous, mine).map((outcome) => outcome.title)).toEqual(['Open']);
  });

  it('offers only what a Friday review rolled forward, and nothing without a last week', () => {
    const rolled = makeOutcome({ title: 'Rolled', weekId: PREVIOUS, reviewGrade: 'partial', reviewDisposition: 'roll_forward' });
    const rescheduled = makeOutcome({ title: 'Rescheduled', weekId: PREVIOUS, slot: 2, reviewGrade: 'missed', reviewDisposition: 'reschedule' });
    const killed = makeOutcome({ title: 'Killed', weekId: PREVIOUS, slot: null, status: 'killed', reviewGrade: 'missed', reviewDisposition: 'kill' });
    const previous = makeWeekView([rolled, rescheduled, killed], { id: PREVIOUS, reviewedAt: '2026-09-25T11:00:00.000Z' });
    expect(carryCandidates(previous, []).map((outcome) => outcome.title)).toEqual(['Rolled']);
    expect(carryCandidates(null, [])).toEqual([]);
  });
});
