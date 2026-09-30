import { useCallback } from 'react';
import { ApiError } from './client';
import { useToast } from '../components/Toast';
import type { Outcome } from '../shared/exec/schemas';
import type { MustShip } from '../shared/exec/todaySchemas';

const FRIENDLY: Partial<Record<ApiError['code'], string>> = {
  NETWORK: 'the local API is not reachable',
  WEEK_FULL: 'this week already has three outcomes',
  CONSTRAINT: 'that conflicts with saved data',
  DAY_TAKEN: 'that day already has a Must Ship',
  SLOT_LIMIT: 'a day holds at most two secondary tasks',
  SHUTDOWN_NOT_READY: "grade today's Must Ship first",
  REVIEW_NOT_READY: 'grade every outcome first',
};

export const errorMessage = (error: ApiError): string => FRIENDLY[error.code] ?? error.message;

/** `report('save')` is an onError that toasts "Could not save: <reason>". */
export function useReportError(): (verb: string) => (error: ApiError) => void {
  const toast = useToast();
  return useCallback((verb: string) => (error: ApiError) => toast.show(`Could not ${verb}: ${errorMessage(error)}`), [toast]);
}

/** The outcomes a WEEK_FULL refusal carries, so a form can offer the replace prompt; null for any other error. */
export function weekFullOutcomes(error: unknown): Outcome[] | null {
  if (!(error instanceof ApiError) || error.code !== 'WEEK_FULL') return null;
  const details = error.details as { outcomes?: Outcome[] } | undefined;
  return details?.outcomes ?? [];
}

/** The Must Ship already holding the day that a DAY_TAKEN refusal names; null for any other error. */
export function dayTakenMustShip(error: unknown): MustShip | null {
  if (!(error instanceof ApiError) || error.code !== 'DAY_TAKEN') return null;
  return (error.details as { mustShip?: MustShip } | undefined)?.mustShip ?? null;
}
