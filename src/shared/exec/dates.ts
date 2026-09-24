const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The date part of a UTC instant, as YYYY-MM-DD. */
export function toCalendarDate(utc: Date): string {
  return utc.toISOString().slice(0, 10);
}

/** True for a real calendar date written YYYY-MM-DD (so 2026-02-30 is false). */
export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  return toCalendarDate(new Date(Date.UTC(year, month - 1, day))) === value;
}

/** Adds whole days to a calendar date, staying in calendar space: no time zones, no DST. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return toCalendarDate(new Date(Date.UTC(year, month - 1, day + days)));
}

/** Negative when a is earlier, zero when equal, positive when later. Calendar dates sort as text. */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
