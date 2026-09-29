import { addDays } from './dates';
import { hhmmToMinutes } from './time';
import type { Context, Settings } from './schemas';
import type { DeepWorkBlock } from './todaySchemas';

export type Elapsed = { seconds: number; remaining: number; paused: boolean };
type Timed = Pick<DeepWorkBlock, 'startedAt' | 'endedAt' | 'pausedSeconds' | 'pauseStartedAt' | 'plannedMinutes'>;

const DAY_MINUTES = 24 * 60;
const MIN_BLOCK = 15;

/**
 * How long a block has really run. Derived from the stored timestamps only, so a reload or a second tab agrees:
 * time spent paused (already folded, or still open) is left out, and a finished block stops at its end.
 */
export function elapsed(block: Timed, now: Date): Elapsed {
  const planned = block.plannedMinutes * 60;
  if (block.startedAt === null) return { seconds: 0, remaining: planned, paused: false };
  const end = block.endedAt === null ? now.getTime() : Date.parse(block.endedAt);
  const pausedNow = block.pauseStartedAt !== null && block.endedAt === null;
  const openPause = pausedNow ? Math.max(0, end - Date.parse(block.pauseStartedAt as string)) : 0;
  const seconds = Math.max(0, Math.floor((end - Date.parse(block.startedAt) - openPause) / 1000) - block.pausedSeconds);
  return { seconds, remaining: planned - seconds, paused: pausedNow };
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** "90:00" while time remains, "+02:10" once over (spec C "Deep Work": past zero it counts up quietly). */
export function countdownLabel(remaining: number): string {
  const abs = Math.abs(Math.trunc(remaining));
  const label = `${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return remaining < 0 ? `+${label}` : label;
}

export const minutesToHhmm = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export const snapDown = (minutes: number, step = 15): number => minutes - (minutes % step);

export type ProposedBlock = { date: string; context: Context; plannedStart: string; plannedMinutes: number };

const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** A proposal that does not fit before midnight is clamped; one with no room for a minimum block is dropped. */
function fit(date: string, context: Context, plannedStart: string, minutes: number): ProposedBlock | null {
  const room = DAY_MINUTES - hhmmToMinutes(plannedStart);
  return room < MIN_BLOCK ? null : { date, context, plannedStart, plannedMinutes: Math.min(minutes, room) };
}

/** The settings' blocks laid over one planning week: a work block each work day and each build block on its weekday. */
export function defaultBlocksFor(startDate: string, settings: Settings): ProposedBlock[] {
  const proposals: ProposedBlock[] = [];
  const add = (block: ProposedBlock | null) => {
    if (block) proposals.push(block);
  };
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(startDate, offset);
    const weekday = weekdayOf(date);
    if (settings.workDays.includes(weekday)) add(fit(date, 'work', settings.deepWorkStart, settings.deepWorkMinutes));
    for (const block of settings.buildBlocks) {
      if (block.weekday === weekday) add(fit(date, 'build', block.start, block.minutes));
    }
  }
  return proposals.sort((a, b) => a.date.localeCompare(b.date) || a.plannedStart.localeCompare(b.plannedStart));
}

/** Proposals not yet saved: none of the blocks shares the proposal's date, context and start. */
export function withoutPlaced(proposals: ProposedBlock[], blocks: DeepWorkBlock[]): ProposedBlock[] {
  return proposals.filter(
    (proposal) => !blocks.some((block) => block.date === proposal.date && block.context === proposal.context && block.plannedStart === proposal.plannedStart)
  );
}

export const weekRange = (startDate: string): { from: string; to: string } => ({ from: startDate, to: addDays(startDate, 6) });

type Placed = { plannedStart: string; plannedMinutes: number };

/** The hours the grid draws: 06:00 to 19:00, widened to whole hours when a block falls outside them. */
export function gridRange(blocks: Placed[]): { start: number; end: number } {
  const starts = blocks.map((block) => hhmmToMinutes(block.plannedStart));
  const ends = blocks.map((block) => hhmmToMinutes(block.plannedStart) + block.plannedMinutes);
  return {
    start: Math.min(6 * 60, ...starts.map((value) => Math.floor(value / 60) * 60)),
    end: Math.max(19 * 60, ...ends.map((value) => Math.ceil(value / 60) * 60)),
  };
}

/** Where a block sits in a day column, as percentages of the drawn range. */
export function blockBox(plannedStart: string, plannedMinutes: number, range: { start: number; end: number }): { top: number; height: number } {
  const span = range.end - range.start;
  return { top: ((hhmmToMinutes(plannedStart) - range.start) / span) * 100, height: (plannedMinutes / span) * 100 };
}

/** Planned minutes for every block linked to an outcome, and the minutes actually worked in its finished blocks. */
export function minutesByOutcome(blocks: DeepWorkBlock[]): Record<string, { planned: number; done: number }> {
  const totals: Record<string, { planned: number; done: number }> = {};
  for (const block of blocks) {
    if (block.outcomeId === null) continue;
    const done = block.endedAt === null ? 0 : Math.round(elapsed(block, new Date(block.endedAt)).seconds / 60);
    const current = totals[block.outcomeId] ?? { planned: 0, done: 0 };
    totals[block.outcomeId] = { planned: current.planned + block.plannedMinutes, done: current.done + done };
  }
  return totals;
}
