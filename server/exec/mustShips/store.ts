import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../http';
import { toEntity, insertRow, updateRow, placeholders, type Bindable } from '../rows';
import { addDays } from '../../../src/shared/exec/dates';
import { weekStartOf } from '../../../src/shared/exec/time';
import type { Context } from '../../../src/shared/exec/schemas';
import type { MustShip, MustShipCreate, MustShipPatch, MustShipQuery, MustShipStatus } from '../../../src/shared/exec/todaySchemas';

const BLOCKER_FIELDS = ['blockerWhat', 'blockerOwner', 'blockerNextAction'] as const;
const UNROLLABLE: readonly MustShipStatus[] = ['shipped', 'killed'];

export function getMustShip(db: Database.Database, id: string): MustShip | null {
  const row = db.prepare('SELECT * FROM must_ships WHERE id = ?').get(id);
  return row ? toEntity<MustShip>(row) : null;
}

/** Candidates first, newest first; then dated Must Ships by date, work before build. Context only orders dated rows. Filters combine with AND. */
export function listMustShips(db: Database.Database, query: MustShipQuery, weekStartDay = 0): MustShip[] {
  const clauses: string[] = [];
  const params: Bindable[] = [];
  if (query.date === 'none') clauses.push('date IS NULL');
  else if (query.date) {
    clauses.push('date = ?');
    params.push(query.date);
  }
  if (query.week) {
    const start = weekStartOf(query.week, weekStartDay);
    clauses.push('date BETWEEN ? AND ?');
    params.push(start, addDays(start, 6));
  }
  if (query.status) {
    clauses.push(`status IN (${placeholders(query.status.length)})`);
    params.push(...query.status);
  }
  if (query.outcome) {
    clauses.push('outcome_id = ?');
    params.push(query.outcome);
  }
  if (query.project) {
    clauses.push('project_id = ?');
    params.push(query.project);
  }
  if (query.context) {
    clauses.push('context = ?');
    params.push(query.context);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM must_ships ${where} ORDER BY date IS NOT NULL, date, CASE WHEN date IS NULL THEN '' ELSE context END DESC, created_at DESC, id`)
    .all(...params)
    .map((row) => toEntity<MustShip>(row));
}

/** One Must Ship per day per context (spec B): refuse with the one already holding the day. */
function assertDayFree(db: Database.Database, date: string | null, context: Context, exceptId: string | null): void {
  if (date === null) return;
  const row = db.prepare('SELECT * FROM must_ships WHERE date = ? AND context = ? AND id IS NOT ?').get(date, context, exceptId);
  if (row) throw new ApiError(409, 'DAY_TAKEN', 'that day already has a must ship', { mustShip: toEntity<MustShip>(row) });
}

export function createMustShip(db: Database.Database, input: MustShipCreate, now: string): MustShip {
  return db
    .transaction((): MustShip => {
      assertDayFree(db, input.date, input.context, null);
      const id = randomUUID();
      insertRow(db, 'must_ships', { ...input, id, createdAt: now, updatedAt: now });
      return getMustShip(db, id) as MustShip;
    })
    .immediate();
}

/** closedAt marks leaving `planned`; returning to it clears the mark. */
function closedAtFor(from: MustShipStatus, to: MustShipStatus, now: string): { closedAt?: string | null } {
  if (from === to) return {};
  if (to === 'planned') return { closedAt: null };
  return from === 'planned' ? { closedAt: now } : {};
}

/** Edits a Must Ship; moving it onto a taken day is DAY_TAKEN, and blocking needs all three blocker fields (§8). */
export function patchMustShip(db: Database.Database, id: string, patch: MustShipPatch, now: string): MustShip | null {
  return db
    .transaction((): MustShip | null => {
      const current = getMustShip(db, id);
      if (!current) return null;
      const next = { ...current, ...patch };
      if (next.status === 'blocked' && BLOCKER_FIELDS.some((field) => !next[field])) {
        throw new ApiError(400, 'VALIDATION', 'a blocked must ship needs what blocks it, who owns it and the next action');
      }
      if (patch.date !== undefined || patch.context !== undefined) assertDayFree(db, next.date, next.context, id);
      updateRow(db, 'must_ships', id, { ...patch, ...closedAtFor(current.status, next.status, now), updatedAt: now });
      return getMustShip(db, id);
    })
    .immediate();
}

/** Copies to `date` with lineage and one more roll; the original keeps its status (spec B, POST /must-ships/:id/roll). */
export function rollMustShip(db: Database.Database, id: string, date: string, now: string): MustShip | null {
  return db
    .transaction((): MustShip | null => {
      const source = getMustShip(db, id);
      if (!source) return null;
      if (UNROLLABLE.includes(source.status)) throw new ApiError(400, 'VALIDATION', 'a shipped or killed must ship is not rolled forward');
      if (source.date === date) throw new ApiError(400, 'VALIDATION', 'a must ship cannot be rolled onto its own day');
      assertDayFree(db, date, source.context, null);
      const copyId = randomUUID();
      insertRow(db, 'must_ships', {
        id: copyId,
        title: source.title,
        definitionOfDone: source.definitionOfDone,
        context: source.context,
        date,
        outcomeId: source.outcomeId,
        projectId: source.projectId,
        notes: source.notes,
        rolledFromId: source.id,
        rollCount: source.rollCount + 1,
        createdAt: now,
        updatedAt: now,
      });
      return getMustShip(db, copyId);
    })
    .immediate();
}
