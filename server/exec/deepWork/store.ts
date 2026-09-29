import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../http';
import { toEntity, insertRow, updateRow } from '../rows';
import { getOutcome } from '../outcomes/store';
import { getWeek } from '../weeks/store';
import { getMustShip } from '../mustShips/store';
import { addDays } from '../../../src/shared/exec/dates';
import { hhmmToMinutes } from '../../../src/shared/exec/time';
import { contextOf } from '../../../src/shared/exec/week';
import type { DeepWorkBlock, MustShip } from '../../../src/shared/exec/todaySchemas';
import type { DeepWorkCreate, DeepWorkPatch, DeepWorkQuery } from '../../../src/shared/exec/deepWorkSchemas';

type Placement = Pick<DeepWorkBlock, 'date' | 'context' | 'plannedStart' | 'plannedMinutes' | 'outcomeId' | 'mustShipId'>;

export const invalid = (message: string): ApiError => new ApiError(400, 'VALIDATION', message);

export function getBlock(db: Database.Database, id: string): DeepWorkBlock | null {
  const row = db.prepare('SELECT * FROM deep_work_blocks WHERE id = ?').get(id);
  return row ? toEntity<DeepWorkBlock>(row) : null;
}

export function listBlocks(db: Database.Database, query: DeepWorkQuery): DeepWorkBlock[] {
  return db
    .prepare('SELECT * FROM deep_work_blocks WHERE date BETWEEN ? AND ? ORDER BY date, planned_start, id')
    .all(query.from, query.to)
    .map((row) => toEntity<DeepWorkBlock>(row));
}

function assertFits(fields: Placement): void {
  if (hhmmToMinutes(fields.plannedStart) + fields.plannedMinutes > 24 * 60) throw invalid('a block must end by midnight');
}

/** Unfinished blocks on a date may not overlap in time; finished ones are history and never block a plan. */
function assertFree(db: Database.Database, fields: Placement, exceptId: string | null): void {
  const start = hhmmToMinutes(fields.plannedStart);
  const end = start + fields.plannedMinutes;
  const others = db
    .prepare('SELECT planned_start, planned_minutes FROM deep_work_blocks WHERE date = ? AND ended_at IS NULL AND id IS NOT ?')
    .all(fields.date, exceptId) as { planned_start: string; planned_minutes: number }[];
  for (const other of others) {
    const otherStart = hhmmToMinutes(other.planned_start);
    if (start < otherStart + other.planned_minutes && otherStart < end) throw invalid('that time overlaps another block');
  }
}

function assertOutcome(db: Database.Database, fields: Placement): void {
  if (fields.outcomeId === null) return;
  const outcome = getOutcome(db, fields.outcomeId);
  if (!outcome) throw invalid('no such outcome');
  if (outcome.slot === null || outcome.status !== 'active') throw invalid('that outcome is not active this week');
  const week = getWeek(db, outcome.weekId);
  if (!week || fields.date < week.startDate || fields.date > addDays(week.startDate, 6)) throw invalid('that outcome belongs to another week');
  if (contextOf(outcome.category) !== fields.context) throw invalid('that outcome belongs to the other context');
}

function assertMustShip(db: Database.Database, fields: Placement): void {
  if (fields.mustShipId === null) return;
  const mustShip = getMustShip(db, fields.mustShipId);
  if (!mustShip) throw invalid('no such must ship');
  if (mustShip.date !== fields.date || mustShip.context !== fields.context) throw invalid('that must ship is for another day or context');
}

function assertPlaceable(db: Database.Database, fields: Placement, exceptId: string | null): void {
  assertFits(fields);
  assertFree(db, fields, exceptId);
  assertOutcome(db, fields);
  assertMustShip(db, fields);
}

export function createBlock(db: Database.Database, input: DeepWorkCreate, now: string): DeepWorkBlock {
  return db
    .transaction((): DeepWorkBlock => {
      assertPlaceable(db, input, null);
      const id = randomUUID();
      insertRow(db, 'deep_work_blocks', { ...input, id, createdAt: now, updatedAt: now });
      return getBlock(db, id) as DeepWorkBlock;
    })
    .immediate();
}

/** A block can be re-planned until it starts; after that its time and links are history. */
export function patchBlock(db: Database.Database, id: string, patch: DeepWorkPatch, now: string): DeepWorkBlock | null {
  return db
    .transaction((): DeepWorkBlock | null => {
      const current = getBlock(db, id);
      if (!current) return null;
      if (current.startedAt !== null) throw invalid('a started block cannot be changed');
      assertPlaceable(db, { ...current, ...patch }, id);
      updateRow(db, 'deep_work_blocks', id, { ...patch, updatedAt: now });
      return getBlock(db, id);
    })
    .immediate();
}

function dayMustShip(db: Database.Database, block: DeepWorkBlock): MustShip | null {
  const row = db.prepare('SELECT * FROM must_ships WHERE date = ? AND context = ?').get(block.date, block.context);
  return row ? toEntity<MustShip>(row) : null;
}

/**
 * Sets started_at. Idempotent while running. The block takes the day's Must Ship of its context when it has none,
 * and that Must Ship's outcome when it has none, so the minutes count toward the outcome.
 */
export function startBlock(db: Database.Database, id: string, now: string): DeepWorkBlock | null {
  return db
    .transaction((): DeepWorkBlock | null => {
      const block = getBlock(db, id);
      if (!block) return null;
      if (block.endedAt !== null) throw invalid('that block has already finished');
      if (block.startedAt !== null) return block;
      const running = db.prepare('SELECT 1 FROM deep_work_blocks WHERE date = ? AND started_at IS NOT NULL AND ended_at IS NULL AND id != ?').get(block.date, id);
      if (running) throw invalid('another block is already running');
      const mustShip = block.mustShipId === null ? dayMustShip(db, block) : getMustShip(db, block.mustShipId);
      updateRow(db, 'deep_work_blocks', id, {
        startedAt: now,
        mustShipId: mustShip?.id ?? block.mustShipId,
        outcomeId: block.outcomeId ?? mustShip?.outcomeId ?? null,
        updatedAt: now,
      });
      return getBlock(db, id);
    })
    .immediate();
}

/** The paused seconds folded into the total, and the pause cleared. */
export function pauseFold(block: Pick<DeepWorkBlock, 'pausedSeconds' | 'pauseStartedAt'>, now: string): { pausedSeconds: number; pauseStartedAt: null } {
  if (block.pauseStartedAt === null) return { pausedSeconds: block.pausedSeconds, pauseStartedAt: null };
  const span = Math.max(0, Math.round((Date.parse(now) - Date.parse(block.pauseStartedAt)) / 1000));
  return { pausedSeconds: block.pausedSeconds + span, pauseStartedAt: null };
}

export function pauseBlock(db: Database.Database, id: string, now: string): DeepWorkBlock | null {
  return db
    .transaction((): DeepWorkBlock | null => {
      const block = getBlock(db, id);
      if (!block) return null;
      if (block.startedAt === null || block.endedAt !== null) throw invalid('that block is not running');
      if (block.pauseStartedAt !== null) return block;
      updateRow(db, 'deep_work_blocks', id, { pauseStartedAt: now, updatedAt: now });
      return getBlock(db, id);
    })
    .immediate();
}

export function resumeBlock(db: Database.Database, id: string, now: string): DeepWorkBlock | null {
  return db
    .transaction((): DeepWorkBlock | null => {
      const block = getBlock(db, id);
      if (!block) return null;
      if (block.pauseStartedAt === null) return block;
      updateRow(db, 'deep_work_blocks', id, { ...pauseFold(block, now), updatedAt: now });
      return getBlock(db, id);
    })
    .immediate();
}
