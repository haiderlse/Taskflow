import type { Outcome, WeekView } from './schemas';

const bySlot = (a: Outcome, b: Outcome): number => (a.slot ?? 4) - (b.slot ?? 4);

/** The outcomes the Friday review covers: those holding a slot, and those graded before Kill freed theirs. */
export const reviewedOutcomes = (outcomes: Outcome[]): Outcome[] => outcomes.filter((outcome) => outcome.slot !== null || outcome.reviewGrade !== null);

/** The outcomes still to grade, in slot order: after a reload the review resumes at the first of them. */
export const reviewQueue = (outcomes: Outcome[]): Outcome[] =>
  outcomes.filter((outcome) => outcome.slot !== null && outcome.reviewGrade === null).sort(bySlot);

/**
 * Sunday planning step 1 (spec C): after a Friday review, the outcomes it rolled forward; before one, every outcome still
 * open. Either way, not one already carried into this week.
 */
export function carryCandidates(previous: WeekView | null, current: Outcome[]): Outcome[] {
  if (previous === null) return [];
  const carried = (outcome: Outcome) => current.some((mine) => mine.slot !== null && mine.rolledFromId === outcome.id);
  const offered =
    previous.week.reviewedAt === null
      ? previous.outcomes.filter((outcome) => outcome.status === 'active' && outcome.slot !== null)
      : previous.outcomes.filter((outcome) => outcome.status === 'active' && outcome.reviewDisposition === 'roll_forward');
  return offered.filter((outcome) => !carried(outcome));
}
