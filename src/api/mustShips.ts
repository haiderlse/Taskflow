import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Context } from '../shared/exec/schemas';
import type { MustShip, MustShipInput, MustShipPatch, MustShipStatus } from '../shared/exec/todaySchemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { daysKey, mustShipsKey, projectsKey } from './keys';

export { mustShipsKey };

/** `date: 'none'` lists candidates; `week` is any day of a planning week. */
export type MustShipFilters = { date?: string; week?: string; status?: MustShipStatus[]; outcome?: string; project?: string; context?: Context };

const listPath = (filters: MustShipFilters): string =>
  `/must-ships${toQueryString({ date: filters.date, week: filters.week, status: filters.status, outcome: filters.outcome, project: filters.project, context: filters.context })}`;

export function useMustShips(filters: MustShipFilters, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<MustShip[], ApiError>({ queryKey: [...mustShipsKey, filters], queryFn: () => api.get<MustShip[]>(listPath(filters)), enabled });
}

/**
 * Today, the week's counts and project candidates all show Must Ships, so every write refreshes them.
 * A DAY_TAKEN refusal refreshes too: another tab won the day, and Today should show the winner.
 */
function useMustShipMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<MustShip>) {
  const queryClient = useQueryClient();
  const refresh = (keys: readonly (readonly string[])[]) => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  return useMutation<MustShip, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => refresh([mustShipsKey, daysKey, projectsKey]),
    onError: (error) => (error.code === 'DAY_TAKEN' ? refresh([mustShipsKey, daysKey]) : undefined),
  });
}

export const useCreateMustShip = () => useMustShipMutation((input: MustShipInput) => api.post<MustShip>('/must-ships', input));

export const useUpdateMustShip = () =>
  useMustShipMutation(({ id, patch }: { id: string; patch: MustShipPatch }) => api.patch<MustShip>(`/must-ships/${id}`, patch));

export const useRollMustShip = () =>
  useMustShipMutation(({ id, date }: { id: string; date: string }) => api.post<MustShip>(`/must-ships/${id}/roll`, { date }));
