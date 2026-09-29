import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Outcome, OutcomeInput, OutcomePatch, WeekLookup, WeekView } from '../shared/exec/schemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { projectsKey } from './projects';

export const weeksKey = ['exec', 'weeks'] as const;

export type AddOutcomeVariables = { date: string; weekId?: string; input: OutcomeInput };
export type RollOutcomeVariables = { id: string; date: string; weekId?: string };

/** Pass `enabled: false` until the date is trustworthy (settings loaded), so the wrong week is never looked up. */
export function useWeekLookup(date: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<WeekLookup, ApiError>({
    queryKey: [...weeksKey, 'lookup', date],
    queryFn: () => api.get<WeekLookup>(`/weeks${toQueryString({ date })}`),
    enabled,
  });
}

/** Weeks and projects both show outcomes, so every outcome write refreshes both. */
function useOutcomeMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: weeksKey }), queryClient.invalidateQueries({ queryKey: projectsKey })]),
  });
}

/** POST /weeks is create-or-return, so the first outcome of a week brings the week into being. */
const weekIdFor = async (date: string, weekId?: string): Promise<string> =>
  weekId ?? (await api.post<WeekView>('/weeks', { date })).week.id;

export const useAddOutcome = () =>
  useOutcomeMutation(async ({ date, weekId, input }: AddOutcomeVariables) =>
    api.post<Outcome>(`/weeks/${await weekIdFor(date, weekId)}/outcomes`, input)
  );

export const useUpdateOutcome = () =>
  useOutcomeMutation(({ id, patch }: { id: string; patch: OutcomePatch }) => api.patch<Outcome>(`/outcomes/${id}`, patch));

export const useRollOutcome = () =>
  useOutcomeMutation(async ({ id, date, weekId }: RollOutcomeVariables) =>
    api.post<Outcome>(`/outcomes/${id}/roll`, { weekId: await weekIdFor(date, weekId) })
  );
