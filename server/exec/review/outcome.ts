import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { updateRow } from '../rows';
import { ensureWeek, getWeek } from '../weeks/store';
import { getOutcome, patchOutcome, rollOutcome } from '../outcomes/store';
import { fileHandedOffTask } from '../tasks/file';
import { addDays } from '../../../src/shared/exec/dates';
import { contextOf } from '../../../src/shared/exec/week';
import type { Outcome, OutcomePatch } from '../../../src/shared/exec/schemas';
import type { OutcomeReview } from '../../../src/shared/exec/reviewSchemas';

const invalid = (message: string): ApiError => new ApiError(400, 'VALIDATION', message);

/** Reschedule: carry the outcome into the later week that holds `date`, with that date as its target. */
function reschedule(db: Database.Database, outcome: Outcome, date: string, weekStartDay: number, now: string): void {
  const week = getWeek(db, outcome.weekId);
  if (!week || date <= addDays(week.startDate, 6)) throw invalid('reschedule to a later week');
  const target = ensureWeek(db, date, weekStartDay, now).view.week;
  const rolled = rollOutcome(db, outcome.id, target.id, now);
  if (rolled) updateRow(db, 'outcomes', rolled.outcome.id, { targetDate: date, updatedAt: now });
}

/** Delegate: the outcome becomes a task in the owner's hands, followed up on the chosen day. */
function delegate(db: Database.Database, outcome: Outcome, owner: string, followUpDate: string, now: string): void {
  fileHandedOffTask(
    db,
    {
      title: outcome.title,
      notes: 'Delegated at the weekly review',
      context: contextOf(outcome.category),
      status: 'delegated',
      ownerName: owner,
      expectedOutput: outcome.definitionOfDone || null,
      followUpDate,
      projectId: outcome.projectId,
      outcomeId: outcome.id,
      mustShipId: null,
    },
    now
  );
}

function assertReviewable(outcome: Outcome, review: OutcomeReview): void {
  if (outcome.reviewGrade !== null) throw invalid('that outcome is already reviewed');
  if (outcome.slot === null) throw invalid('a killed outcome is not reviewed');
  if (outcome.status === 'done' && review.grade !== 'done') throw invalid('a finished outcome is graded done');
}

/** Done closes the outcome; Kill frees its slot; the other dispositions leave it active in its week. */
function gradePatch(review: OutcomeReview): OutcomePatch {
  if (review.grade === 'done') return { reviewGrade: 'done', status: 'done' };
  const graded: OutcomePatch = { reviewGrade: review.grade, reviewReason: review.reason ?? null, reviewDisposition: review.disposition ?? null };
  return review.disposition === 'kill' ? { ...graded, status: 'killed' } : graded;
}

/** One outcome's Friday review, all or nothing (spec C "Friday review" step 1). Null when the outcome does not exist. */
export function reviewOutcome(db: Database.Database, id: string, review: OutcomeReview, now: string, weekStartDay: number): Outcome | null {
  return db
    .transaction((): Outcome | null => {
      const outcome = getOutcome(db, id);
      if (!outcome) return null;
      assertReviewable(outcome, review);
      if (review.disposition === 'reschedule' && review.date) reschedule(db, outcome, review.date, weekStartDay, now);
      if (review.disposition === 'delegate' && review.owner && review.followUpDate) delegate(db, outcome, review.owner, review.followUpDate, now);
      return patchOutcome(db, id, gradePatch(review), now);
    })
    .immediate();
}
