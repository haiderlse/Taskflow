import { defaultContext, localClock } from './time';
import { contextOf } from './week';
import { minutesToHhmm, snapDown } from './deepWork';
import type { DeepWorkInput } from './deepWorkSchemas';
import type { Context, Outcome, Settings } from './schemas';
import type { DayView, DeepWorkBlock, MustShip, MustShipStatus } from './todaySchemas';

export type FocusSubject = { title: string; definitionOfDone: string; notes: string };
export type FocusPlan =
  | { kind: 'live'; block: DeepWorkBlock; subject: FocusSubject }
  | { kind: 'start'; context: Context; block: DeepWorkBlock | null; subject: FocusSubject }
  | { kind: 'closed'; title: string; status: MustShipStatus }
  | { kind: 'nothing' };

const ofMustShip = (mustShip: MustShip): FocusSubject => ({ title: mustShip.title, definitionOfDone: mustShip.definitionOfDone, notes: mustShip.notes });
const ofOutcome = (outcome: Outcome): FocusSubject => ({ title: outcome.title, definitionOfDone: outcome.definitionOfDone, notes: outcome.notes });
const PLAIN: FocusSubject = { title: 'Deep work', definitionOfDone: '', notes: '' };

/**
 * What opening /focus does (spec C "Deep Work"): resume the live block, or start today's block for the
 * moment's context, or say there is nothing to do. A live block is resumed whatever its context, so a
 * session that runs past office hours is never lost.
 */
export function planFocus(now: Date, settings: Settings, view: DayView): FocusPlan {
  const outcomes = view.week?.outcomes ?? [];
  const live = view.blocks.find((block) => block.startedAt !== null && block.endedAt === null);
  if (live) {
    const mustShip = [view.mustShip, view.buildMustShip].find((candidate) => candidate !== null && candidate.id === live.mustShipId) ?? null;
    const outcome = outcomes.find((candidate) => candidate.id === live.outcomeId) ?? null;
    return { kind: 'live', block: live, subject: mustShip ? ofMustShip(mustShip) : outcome ? ofOutcome(outcome) : PLAIN };
  }
  const context = defaultContext(now, settings);
  const mustShip = context === 'work' ? view.mustShip : view.buildMustShip;
  const block = view.blocks.find((candidate) => candidate.context === context && candidate.startedAt === null) ?? null;
  if (mustShip) {
    return mustShip.status === 'planned'
      ? { kind: 'start', context, block, subject: ofMustShip(mustShip) }
      : { kind: 'closed', title: mustShip.title, status: mustShip.status };
  }
  if (context === 'build') {
    const active = outcomes.filter((outcome) => outcome.slot !== null && outcome.status === 'active' && contextOf(outcome.category) === 'build');
    const outcome = active.find((candidate) => candidate.id === block?.outcomeId) ?? active[0];
    if (outcome) return { kind: 'start', context, block, subject: ofOutcome(outcome) };
  }
  return { kind: 'nothing' };
}

/** A block for a session that starts without a planned one: now snapped down to 15 minutes, capped at midnight. */
export function newBlockFor(now: Date, settings: Settings, context: Context, date: string): DeepWorkInput {
  const clock = localClock(now, settings.timezone);
  const start = snapDown(clock.minutes);
  const buildBlock = settings.buildBlocks.find((block) => block.weekday === clock.weekday);
  const wanted = context === 'work' ? settings.deepWorkMinutes : buildBlock?.minutes ?? 60;
  return { date, context, plannedStart: minutesToHhmm(start), plannedMinutes: Math.max(15, Math.min(wanted, 24 * 60 - start)), outcomeId: null, mustShipId: null };
}
