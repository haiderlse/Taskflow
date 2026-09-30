import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { insertRow } from '../rows';
import { getTask } from './store';
import type { Context, Task } from '../../../src/shared/exec/schemas';

/** A task born in someone else's hands: a blocker's next action, or an outcome handed off at the review. */
export type HandedOff = {
  title: string;
  notes: string;
  context: Context;
  status: 'delegated' | 'waiting';
  ownerName: string;
  expectedOutput: string | null;
  followUpDate: string;
  projectId: string | null;
  outcomeId: string | null;
  mustShipId: string | null;
};

/** Files it already processed and handed off: it never passes through the inbox. */
export function fileHandedOffTask(db: Database.Database, fields: HandedOff, now: string): Task {
  const id = randomUUID();
  insertRow(db, 'tasks', { ...fields, id, capturedAt: now, processedAt: now, delegatedAt: now, createdAt: now, updatedAt: now });
  return getTask(db, id) as Task;
}
