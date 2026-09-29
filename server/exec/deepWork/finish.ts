import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { insertRow, updateRow } from '../rows';
import { getMustShip, patchMustShip } from '../mustShips/store';
import { getTask } from '../tasks/store';
import { getBlock, invalid, pauseFold } from './store';
import { addDays } from '../../../src/shared/exec/dates';
import type { Task } from '../../../src/shared/exec/schemas';
import type { DeepWorkBlock, MustShip } from '../../../src/shared/exec/todaySchemas';
import type { Blocker, DeepWorkFinish, FinishResult } from '../../../src/shared/exec/deepWorkSchemas';

/** Completing ships the Must Ship and blocking blocks it; a killed Must Ship is never revived, and progress changes nothing. */
function settleMustShip(db: Database.Database, block: DeepWorkBlock, input: DeepWorkFinish, now: string): MustShip | null {
  if (block.mustShipId === null) return null;
  const current = getMustShip(db, block.mustShipId);
  if (!current || current.status === 'killed') return current;
  if (input.result === 'completed') return patchMustShip(db, current.id, { status: 'shipped' }, now);
  if (input.result === 'blocked' && input.blocker && current.status !== 'shipped') {
    return patchMustShip(
      db,
      current.id,
      { status: 'blocked', blockerWhat: input.blocker.what, blockerOwner: input.blocker.owner, blockerNextAction: input.blocker.nextAction },
      now
    );
  }
  return current;
}

/** The next action becomes a task waiting on its owner, to follow up the day after the block (spec B, POST /deep-work/:id/finish). */
function fileBlockerTask(db: Database.Database, block: DeepWorkBlock, mustShip: MustShip | null, blocker: Blocker, now: string): Task {
  const id = randomUUID();
  insertRow(db, 'tasks', {
    id,
    title: blocker.nextAction,
    notes: `Blocked: ${blocker.what}`,
    context: block.context,
    status: 'waiting',
    projectId: mustShip?.projectId ?? null,
    outcomeId: block.outcomeId ?? mustShip?.outcomeId ?? null,
    mustShipId: mustShip?.id ?? block.mustShipId,
    ownerName: blocker.owner,
    followUpDate: addDays(block.date, 1),
    capturedAt: now,
    processedAt: now,
    delegatedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return getTask(db, id) as Task;
}

/** Ends a running block, settles its Must Ship and, when blocked, files the waiting task, all or nothing. */
export function finishBlock(db: Database.Database, id: string, input: DeepWorkFinish, now: string): FinishResult | null {
  return db
    .transaction((): FinishResult | null => {
      const block = getBlock(db, id);
      if (!block) return null;
      if (block.startedAt === null) throw invalid('a block must be started before it can finish');
      if (block.endedAt !== null) throw invalid('that block has already finished');
      if (input.result === 'blocked' && !input.blocker) throw invalid('a blocked session needs a blocker');
      updateRow(db, 'deep_work_blocks', id, { endedAt: now, result: input.result, notes: input.notes, ...pauseFold(block, now), updatedAt: now });
      const mustShip = settleMustShip(db, block, input, now);
      const task = input.result === 'blocked' && input.blocker ? fileBlockerTask(db, block, mustShip, input.blocker, now) : null;
      return { block: getBlock(db, id) as DeepWorkBlock, mustShip, task };
    })
    .immediate();
}
