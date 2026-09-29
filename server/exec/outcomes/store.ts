import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../http';
import { toEntity, insertRow, updateRow } from '../rows';
import { getWeek } from '../weeks/store';
import { fridayOf } from '../../../src/shared/exec/week';
import type { Outcome, OutcomeCreate, OutcomePatch, OutcomeStatus, ReviewReason } from '../../../src/shared/exec/schemas';

const SLOTS = [1, 2, 3] as const;

type OutcomeFields = Omit<OutcomeCreate, 'replace'> & { progress?: number; rolledFromId?: string | null };
type Replace = { outcomeId: string; reason: ReviewReason };
export type RollResult = { outcome: Outcome; created: boolean };

export function getOutcome(db: Database.Database, id: string): Outcome | null {
  const row = db.prepare('SELECT * FROM outcomes WHERE id = ?').get(id);
  return row ? toEntity<Outcome>(row) : null;
}

const slotted = (db: Database.Database, weekId: string): Outcome[] =>
  db
    .prepare('SELECT * FROM outcomes WHERE week_id = ? AND slot IS NOT NULL ORDER BY slot')
    .all(weekId)
    .map((row) => toEntity<Outcome>(row));

function freeSlot(db: Database.Database, weekId: string): number | null {
  const taken = new Set(slotted(db, weekId).map((outcome) => outcome.slot));
  return SLOTS.find((slot) => !taken.has(slot)) ?? null;
}

function killForReplace(db: Database.Database, weekId: string, replace: Replace, now: string): void {
  const target = getOutcome(db, replace.outcomeId);
  if (!target || target.weekId !== weekId || target.slot === null) {
    throw new ApiError(400, 'VALIDATION', 'the outcome to replace is not in this week');
  }
  updateRow(db, 'outcomes', target.id, { status: 'killed', slot: null, reviewReason: replace.reason, closedAt: now, updatedAt: now });
}

/** The three-outcome limit lives here and in UNIQUE (week_id, slot); callers hold a write transaction. */
function insertOutcome(db: Database.Database, weekId: string, fields: OutcomeFields, now: string): Outcome {
  const slot = freeSlot(db, weekId);
  if (slot === null) {
    throw new ApiError(409, 'WEEK_FULL', 'the week already has three outcomes', { outcomes: slotted(db, weekId) });
  }
  const id = randomUUID();
  insertRow(db, 'outcomes', { ...fields, id, weekId, slot, createdAt: now, updatedAt: now });
  return getOutcome(db, id) as Outcome;
}

/** Fills the lowest free slot; with `replace`, kills that outcome and takes its slot in the same transaction. */
export function addOutcome(db: Database.Database, weekId: string, input: OutcomeCreate, now: string): Outcome {
  const { replace, ...fields } = input;
  return db
    .transaction((): Outcome => {
      if (replace) killForReplace(db, weekId, replace, now);
      return insertOutcome(db, weekId, fields, now);
    })
    .immediate();
}

function statusFields(from: OutcomeStatus, to: OutcomeStatus, now: string): Record<string, unknown> {
  if (from === to) return {};
  if (to === 'killed') return { slot: null, closedAt: now };
  if (to === 'done') return { progress: 100, closedAt: now };
  return { closedAt: null };
}

/** Edits an outcome; a status change sets slot, progress and closedAt. Null when it does not exist. */
export function patchOutcome(db: Database.Database, id: string, patch: OutcomePatch, now: string): Outcome | null {
  const current = getOutcome(db, id);
  if (!current) return null;
  const to = patch.status ?? current.status;
  if (current.status === 'killed' && to !== 'killed') {
    throw new ApiError(400, 'VALIDATION', 'a killed outcome cannot be reopened; add it again');
  }
  updateRow(db, 'outcomes', id, { ...patch, ...statusFields(current.status, to, now), updatedAt: now });
  return getOutcome(db, id);
}

/** Carries an outcome into another week with lineage; returns the existing copy if it was already carried there. */
export function rollOutcome(db: Database.Database, id: string, targetWeekId: string, now: string): RollResult | null {
  const source = getOutcome(db, id);
  if (!source) return null;
  const target = getWeek(db, targetWeekId);
  if (!target) throw new ApiError(404, 'NOT_FOUND', 'no such week');
  if (target.id === source.weekId) throw new ApiError(400, 'VALIDATION', 'an outcome cannot be rolled into its own week');
  if (source.status === 'done') throw new ApiError(400, 'VALIDATION', 'a finished outcome is not rolled forward');
  return db
    .transaction((): RollResult => {
      const existing = db
        .prepare("SELECT * FROM outcomes WHERE week_id = ? AND rolled_from_id = ? AND status != 'killed'")
        .get(target.id, source.id);
      if (existing) return { outcome: toEntity<Outcome>(existing), created: false };
      const outcome = insertOutcome(db, target.id, {
        title: source.title,
        category: source.category,
        description: source.description,
        definitionOfDone: source.definitionOfDone,
        targetDate: fridayOf(target.startDate),
        projectId: source.projectId,
        notes: source.notes,
        progress: source.progress,
        rolledFromId: source.id,
      }, now);
      return { outcome, created: true };
    })
    .immediate();
}
