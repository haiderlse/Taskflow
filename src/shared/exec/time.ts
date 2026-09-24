import { addDays } from './dates';
import type { Context, Settings } from './schemas';

export type LocalClock = { date: string; weekday: number; minutes: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The wall clock in a zone: calendar date, weekday (0 = Sunday) and minutes since midnight. */
export function localClock(now: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    weekday: WEEKDAYS.indexOf(part('weekday')),
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

export function hhmmToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

export const isWorkDay = (clock: LocalClock, settings: Settings): boolean => settings.workDays.includes(clock.weekday);

/** Office hours run from officeStart (inclusive) to officeEnd (exclusive) on work days. */
export const isOfficeHours = (clock: LocalClock, settings: Settings): boolean =>
  isWorkDay(clock, settings) &&
  clock.minutes >= hhmmToMinutes(settings.officeStart) &&
  clock.minutes < hhmmToMinutes(settings.officeEnd);

/** Capture defaults to work in office hours and to build everywhere else (§16). */
export const defaultContext = (now: Date, settings: Settings): Context =>
  isOfficeHours(localClock(now, settings.timezone), settings) ? 'work' : 'build';

/** The first day of the planning week that contains `date`. */
export function weekStartOf(date: string, weekStartDay: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(date, -((weekday - weekStartDay + 7) % 7));
}

export const weekEndOf = (date: string, weekStartDay: number): string => addDays(weekStartOf(date, weekStartDay), 6);
