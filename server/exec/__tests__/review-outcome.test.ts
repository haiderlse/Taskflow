import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek, findWeekByStart, listOutcomes } from '../weeks/store';
import { addOutcome, getOutcome, patchOutcome } from '../outcomes/store';
import { listTasks } from '../tasks/store';
import { reviewOutcome } from '../review/outcome';
import { ApiError } from '../http';
import type { OutcomeCategory } from '../../../src/shared/exec/schemas';
import type { OutcomeReview } from '../../../src/shared/exec/reviewSchemas';

const T0 = '2026-09-27T05:00:00.000Z';
const FRIDAY = '2026-10-02T11:00:00.000Z';
let db: Database.Database;
let weekId: string;

const outcome = (title: string, category: OutcomeCategory = 'office', weekOf = weekId) =>
  addOutcome(db, weekOf, { title, category, description: '', definitionOfDone: 'Signed by both', targetDate: null, projectId: null, notes: '' }, T0);
const review = (id: string, input: OutcomeReview) => reviewOutcome(db, id, input, FRIDAY, 0);

function refusal(run: () => unknown): ApiError {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

beforeEach(() => {
  db = prepareExecDb(':memory:');
  weekId = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
});

describe('reviewOutcome', () => {
  it('closes a done outcome', () => {
    const made = outcome('Supplier plan confirmed');
    expect(review(made.id, { grade: 'done' })).toMatchObject({ reviewGrade: 'done', status: 'done', progress: 100, closedAt: FRIDAY, slot: 1 });
  });

  it('records a roll forward and leaves the outcome for Sunday', () => {
    const made = outcome('Haleon target signed');
    expect(review(made.id, { grade: 'partial', reason: 'insufficient_time', disposition: 'roll_forward' })).toMatchObject({
      reviewGrade: 'partial',
      reviewReason: 'insufficient_time',
      reviewDisposition: 'roll_forward',
      status: 'active',
      slot: 1,
    });
  });

  it('kills an outcome and keeps its grade', () => {
    const made = outcome('Pinkbox P&L live', 'business');
    expect(review(made.id, { grade: 'missed', reason: 'priority_changed', disposition: 'kill' })).toMatchObject({
      reviewGrade: 'missed',
      reviewDisposition: 'kill',
      status: 'killed',
      slot: null,
      closedAt: FRIDAY,
    });
  });

  it('reschedules into the later week holding the date, with that date as the target', () => {
    const made = outcome('Distributor terms signed');
    const graded = review(made.id, { grade: 'missed', reason: 'dependency_blocker', disposition: 'reschedule', date: '2026-10-14' });
    expect(graded).toMatchObject({ reviewDisposition: 'reschedule', status: 'active' });
    const target = findWeekByStart(db, '2026-10-11');
    expect(target).not.toBeNull();
    expect(listOutcomes(db, target?.id ?? '')).toEqual([
      expect.objectContaining({ title: 'Distributor terms signed', rolledFromId: made.id, targetDate: '2026-10-14', slot: 1 }),
    ]);
  });

  it('delegates by filing a task on the owner', () => {
    const made = outcome('Healify beta shipped', 'personal');
    review(made.id, { grade: 'partial', reason: 'too_many_meetings', disposition: 'delegate', owner: 'Sana', followUpDate: '2026-10-06' });
    expect(listTasks(db, { status: ['delegated'] })).toEqual([
      expect.objectContaining({
        title: 'Healify beta shipped',
        ownerName: 'Sana',
        followUpDate: '2026-10-06',
        expectedOutput: 'Signed by both',
        outcomeId: made.id,
        context: 'build',
        processedAt: FRIDAY,
        delegatedAt: FRIDAY,
      }),
    ]);
    expect(getOutcome(db, made.id)).toMatchObject({ reviewDisposition: 'delegate', status: 'active' });
  });

  it('refuses a second grade, a killed outcome, and a done outcome graded otherwise', () => {
    const first = outcome('A');
    review(first.id, { grade: 'done' });
    expect(refusal(() => review(first.id, { grade: 'done' })).message).toBe('that outcome is already reviewed');
    const replaced = outcome('B');
    patchOutcome(db, replaced.id, { status: 'killed' }, T0);
    expect(refusal(() => review(replaced.id, { grade: 'done' })).message).toBe('a killed outcome is not reviewed');
    const finished = outcome('C');
    patchOutcome(db, finished.id, { status: 'done' }, T0);
    expect(refusal(() => review(finished.id, { grade: 'partial', reason: 'other', disposition: 'kill' })).message).toBe('a finished outcome is graded done');
  });

  it('refuses a reschedule inside its own week and writes nothing', () => {
    const made = outcome('Distributor terms signed');
    const refused = refusal(() => review(made.id, { grade: 'missed', reason: 'other', disposition: 'reschedule', date: '2026-10-03' }));
    expect(refused.message).toBe('reschedule to a later week');
    expect(getOutcome(db, made.id)?.reviewGrade).toBeNull();
  });

  it('rolls the whole grade back when the target week is full', () => {
    const later = ensureWeek(db, '2026-10-14', 0, T0).view.week.id;
    ['X', 'Y', 'Z'].forEach((title) => outcome(title, 'office', later));
    const made = outcome('Distributor terms signed');
    const refused = refusal(() => review(made.id, { grade: 'missed', reason: 'other', disposition: 'reschedule', date: '2026-10-14' }));
    expect(refused.code).toBe('WEEK_FULL');
    expect(getOutcome(db, made.id)?.reviewGrade).toBeNull();
    expect(listOutcomes(db, later)).toHaveLength(3);
  });

  it('answers null for a missing outcome', () => {
    expect(review('10000000-0000-4000-8000-00000000dead', { grade: 'done' })).toBeNull();
  });
});
