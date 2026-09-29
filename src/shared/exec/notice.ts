import { hhmmToMinutes, isWorkDay, localClock } from './time';
import type { Settings } from './schemas';

const LEAD_MINUTES = 5;

/**
 * The date to remember while the five-minute notice is due: a work day, from five minutes before
 * `deepWorkStart` until it starts (spec C "Deep Work"). Null the rest of the time.
 */
export function noticeDue(now: Date, settings: Settings): string | null {
  const clock = localClock(now, settings.timezone);
  if (!isWorkDay(clock, settings)) return null;
  const start = hhmmToMinutes(settings.deepWorkStart);
  return clock.minutes >= start - LEAD_MINUTES && clock.minutes < start ? clock.date : null;
}
