import { addDays } from './dates';
import type { Context, OutcomeCategory } from './schemas';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The date among the seven days starting at `startDate` that falls on `weekday` (0 = Sunday). */
export const dayInWeek = (startDate: string, weekday: number): string =>
  addDays(startDate, (weekday - weekdayOf(startDate) + 7) % 7);

/** Outcomes default their target to the week's Friday (spec C "Sunday planning"). */
export const fridayOf = (startDate: string): string => dayInWeek(startDate, 5);

/** ISO-8601 week number of the week's Thursday: a Sunday-start week takes the number of the ISO week holding most of it. */
export function weekNumber(startDate: string): number {
  const thursday = new Date(`${dayInWeek(startDate, 4)}T00:00:00Z`);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
}

/** "20–26 Sep", or "27 Sep – 3 Oct" across a month end. */
export function weekRangeLabel(startDate: string): string {
  const [, startMonth, startDay] = startDate.split('-').map(Number);
  const [, endMonth, endDay] = addDays(startDate, 6).split('-').map(Number);
  return startMonth === endMonth
    ? `${startDay}–${endDay} ${MONTHS[startMonth - 1]}`
    : `${startDay} ${MONTHS[startMonth - 1]} – ${endDay} ${MONTHS[endMonth - 1]}`;
}

/** Office outcomes are work; business, career and personal are build (§16). */
export const contextOf = (category: OutcomeCategory): Context => (category === 'office' ? 'work' : 'build');
