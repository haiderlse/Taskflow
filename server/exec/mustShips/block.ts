import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { getMustShip, patchMustShip } from './store';
import { fileHandedOffTask } from '../tasks/file';
import { nextWorkDay } from '../../../src/shared/exec/today';
import type { Blocker } from '../../../src/shared/exec/deepWorkSchemas';
import type { MustShip } from '../../../src/shared/exec/todaySchemas';
import type { MustShipBlockResult } from '../../../src/shared/exec/reviewSchemas';

const invalid = (message: string): ApiError => new ApiError(400, 'VALIDATION', message);

/**
 * Shutdown's Blocked (spec C "Shutdown" step 1): the blocker goes on the Must Ship and the next action becomes a task
 * waiting on its owner, followed up the next work day. All or nothing; null when the Must Ship does not exist.
 */
export function blockMustShip(db: Database.Database, id: string, blocker: Blocker, workDays: readonly number[], now: string): MustShipBlockResult | null {
  return db
    .transaction((): MustShipBlockResult | null => {
      const current = getMustShip(db, id);
      if (!current) return null;
      if (current.status !== 'planned') throw invalid('only a planned must ship can be blocked');
      if (current.date === null) throw invalid('a candidate has no day to be blocked on');
      const blocked = { status: 'blocked' as const, blockerWhat: blocker.what, blockerOwner: blocker.owner, blockerNextAction: blocker.nextAction };
      const mustShip = patchMustShip(db, id, blocked, now) as MustShip;
      const task = fileHandedOffTask(
        db,
        {
          title: blocker.nextAction,
          notes: `Blocked: ${blocker.what}`,
          context: current.context,
          status: 'waiting',
          ownerName: blocker.owner,
          expectedOutput: null,
          followUpDate: nextWorkDay(current.date, workDays),
          projectId: current.projectId,
          outcomeId: current.outcomeId,
          mustShipId: current.id,
        },
        now
      );
      return { mustShip, task };
    })
    .immediate();
}
