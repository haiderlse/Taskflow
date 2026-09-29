import { addDays } from './dates';
import { hhmmToMinutes, isOfficeHours, isWorkDay, localClock, type LocalClock } from './time';
import type { Settings } from './schemas';
import type { DayView } from './todaySchemas';

export type Banner = 'plan' | 'close';
export type Primary =
  | { kind: 'build' }
  | { kind: 'tomorrow' }
  | { kind: 'choose' }
  | { kind: 'resume'; blockId: string }
  | { kind: 'grade'; mustShipId: string }
  | { kind: 'start'; mustShipId: string };
export type TodayMode = { clock: LocalClock; banners: Banner[]; primary: Primary };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The first work day after `date`; the next calendar day when no day is a work day. */
export function nextWorkDay(date: string, workDays: readonly number[]): string {
  const offset = [1, 2, 3, 4, 5, 6, 7].find((days) => workDays.includes(weekdayOf(addDays(date, days))));
  return addDays(date, offset ?? 1);
}

/** "Tuesday 29 September". */
export function dayLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${DAY_NAMES[weekdayOf(date)]} ${day} ${MONTH_NAMES[month - 1]}`;
}

function bannersFor(clock: LocalClock, settings: Settings, view: DayView): Banner[] {
  const planned = (view.week?.outcomes ?? []).some((outcome) => outcome.slot !== null);
  const closing = isWorkDay(clock, settings) && clock.minutes >= hhmmToMinutes(settings.shutdownTime) && !view.day?.shutdownAt;
  return [...(planned ? [] : (['plan'] as const)), ...(closing ? (['close'] as const) : [])];
}

/** Spec C "Today is time-aware": the first matching row decides the one primary card. */
function primaryFor(clock: LocalClock, settings: Settings, view: DayView): Primary {
  if (!isOfficeHours(clock, settings)) return { kind: 'build' };
  if (view.day?.shutdownAt) return { kind: 'tomorrow' };
  const mustShip = view.mustShip;
  if (!mustShip) return { kind: 'choose' };
  const live = view.blocks.find((block) => block.startedAt !== null && block.endedAt === null);
  if (live) return { kind: 'resume', blockId: live.id };
  const ended = view.blocks.some((block) => block.mustShipId === mustShip.id && block.endedAt !== null);
  if (ended && mustShip.status === 'planned') return { kind: 'grade', mustShipId: mustShip.id };
  return { kind: 'start', mustShipId: mustShip.id };
}

/** The banners to show and the one primary card, from the clock, the schedule and the day (spec B "Pure core"). */
export function todayMode(now: Date, settings: Settings, view: DayView): TodayMode {
  const clock = localClock(now, settings.timezone);
  return { clock, banners: bannersFor(clock, settings, view), primary: primaryFor(clock, settings, view) };
}
