import { useCallback } from 'react';
import { ApiError } from './client';
import { useToast } from '../components/Toast';
import type { Outcome } from '../shared/exec/schemas';

const FRIENDLY: Partial<Record<ApiError['code'], string>> = {
  NETWORK: 'the local API is not reachable',
  WEEK_FULL: 'this week already has three outcomes',
  CONSTRAINT: 'that conflicts with saved data',
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
