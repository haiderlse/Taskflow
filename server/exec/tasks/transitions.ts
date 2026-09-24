import type { TaskStatus } from '../../../src/shared/exec/schemas';
import { WAITING_STATUSES } from '../../../src/shared/exec/schemas';

export type TransitionStamps = { processedAt?: string; delegatedAt?: string; closedAt?: string | null };

const isClosed = (status: TaskStatus) => status === 'done' || status === 'killed';

/**
 * The timestamp rules of a status change (spec B, tasks): processedAt is set the first
 * time a task leaves the inbox, delegatedAt whenever it is handed off, closedAt when it
 * is done or killed and cleared again if it is reopened.
 */
export function transitionStamps(from: TaskStatus, to: TaskStatus, processedAt: string | null, now: string): TransitionStamps {
  if (from === to) return {};
  return {
    ...(from === 'inbox' && processedAt === null ? { processedAt: now } : {}),
    ...(WAITING_STATUSES.includes(to) ? { delegatedAt: now } : {}),
    ...(isClosed(to) ? { closedAt: now } : isClosed(from) ? { closedAt: null } : {}),
  };
}

export const requiresOwner = (to: TaskStatus): boolean => WAITING_STATUSES.includes(to);
