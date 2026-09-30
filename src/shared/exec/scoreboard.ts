import { addDays } from './dates';
import { elapsed } from './deepWork';
import { localClock } from './time';
import type { Outcome, Settings, Task, Week } from './schemas';
import type { DeepWorkBlock, MustShip } from './todaySchemas';
import type { Scoreboard } from './reviewSchemas';

/** The rows the scoreboard reads. The server may pass extra rows; each number filters for itself. */
export type ScoreboardRows = { week: Week; outcomes: Outcome[]; mustShips: MustShip[]; tasks: Task[]; blocks: DeepWorkBlock[] };
type Schedule = Pick<Settings, 'timezone' | 'workDays'>;

const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();
const inRange = (date: string, startDate: string): boolean => date >= startDate && date <= addDays(startDate, 6);

/** True when a UTC timestamp falls on a local calendar day of the week that starts at `startDate`. */
export function stampInWeek(stamp: string | null, startDate: string, timeZone: string): boolean {
  return stamp !== null && inRange(localClock(new Date(stamp), timeZone).date, startDate);
}

/** The week's work days, in order. */
export const workDaysOf = (startDate: string, workDays: readonly number[]): string[] =>
  [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(startDate, offset)).filter((date) => workDays.includes(weekdayOf(date)));

/** An outcome counts toward its week while it holds a slot, or once graded even after Kill freed the slot. */
const counted = (outcome: Outcome, weekId: string): boolean => outcome.weekId === weekId && (outcome.slot !== null || outcome.reviewGrade !== null);

/** Graded done, or done during the week and not graded yet. */
const shipped = (outcome: Outcome): boolean => outcome.reviewGrade === 'done' || (outcome.reviewGrade === null && outcome.status === 'done');

function deepWorkMinutes(blocks: DeepWorkBlock[], startDate: string): number {
  const seconds = blocks
    .filter((block) => block.endedAt !== null && inRange(block.date, startDate))
    .reduce((sum, block) => sum + elapsed(block, new Date(block.endedAt as string)).seconds, 0);
  return Math.round(seconds / 60);
}

/** Spec B "Scoreboard": the week's numbers and its day strip, from rows the server gathered. */
export function scoreboard(rows: ScoreboardRows, schedule: Schedule): Scoreboard {
  const { week } = rows;
  const inWeek = (stamp: string | null) => stampInWeek(stamp, week.startDate, schedule.timezone);
  const outcomes = rows.outcomes.filter((outcome) => counted(outcome, week.id));
  const days = workDaysOf(week.startDate, schedule.workDays);
  const ships = rows.mustShips.filter((ship) => ship.context === 'work' && ship.date !== null && days.includes(ship.date));
  const lineage = [...rows.outcomes, ...rows.mustShips].filter((row) => row.rolledFromId !== null && inWeek(row.createdAt));
  const killed = [...rows.outcomes, ...rows.mustShips, ...rows.tasks].filter((row) => row.status === 'killed' && inWeek(row.closedAt));
  return {
    weekId: week.id,
    startDate: week.startDate,
    reviewedAt: week.reviewedAt,
    outcomes: { shipped: outcomes.filter(shipped).length, total: outcomes.length },
    mustShips: { shipped: ships.filter((ship) => ship.status === 'shipped').length, total: ships.length },
    deepWorkMinutes: deepWorkMinutes(rows.blocks, week.startDate),
    rolledForward: lineage.length + rows.tasks.filter((task) => inWeek(task.rolledAt)).length,
    killed: killed.length,
    delegated: rows.tasks.filter((task) => inWeek(task.delegatedAt)).length,
    strip: days.map((date) => ({ date, status: ships.find((ship) => ship.date === date)?.status ?? null })),
  };
}

/** "0 min", "45 min", "2 h", "3 h 20 min". */
export function deepWorkLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The week in one line: "1 of 3 outcomes · 2 of 5 Must Ships · 1 h 30 min deep work". */
export const scoreLine = (board: Scoreboard): string =>
  `${board.outcomes.shipped} of ${board.outcomes.total} outcomes · ${board.mustShips.shipped} of ${board.mustShips.total} Must Ships · ${deepWorkLabel(board.deepWorkMinutes)} deep work`;
