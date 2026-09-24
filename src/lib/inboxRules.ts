import { addDays, compareDates } from '../shared/exec/dates';
import type { TaskStatus } from '../shared/exec/schemas';
import { weekEndOf, weekStartOf } from '../shared/exec/time';

export const tomorrowFrom = (today: string): string => addDays(today, 1);

/** A date inside the current planning week is a commitment to this week; anything later is parked. */
export function scheduleStatus(date: string, today: string, weekStartDay: number): TaskStatus {
  const inWeek =
    compareDates(date, weekStartOf(today, weekStartDay)) >= 0 && compareDates(date, weekEndOf(today, weekStartDay)) <= 0;
  return inWeek ? 'this_week' : 'later';
}
