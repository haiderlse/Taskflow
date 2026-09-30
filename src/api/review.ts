import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Outcome, Week, WeekView } from '../shared/exec/schemas';
import type { OutcomeReview, Scoreboard } from '../shared/exec/reviewSchemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { daysKey, projectsKey, scoreboardKey, tasksKey, weeksKey } from './keys';

export { scoreboardKey };

/** A week's numbers; nothing is read until there is a week. */
export function useScoreboard(weekId: string | null) {
  return useQuery<Scoreboard, ApiError>({
    queryKey: [...scoreboardKey, weekId],
    queryFn: () => api.get<Scoreboard>(`/weeks/${weekId}/scoreboard`),
    enabled: weekId !== null,
  });
}

/** Up to twelve earlier weeks with their numbers. Pass `enabled: false` until the date is trustworthy. */
export function useWeekHistory(before: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<Scoreboard[], ApiError>({
    queryKey: [...scoreboardKey, 'history', before],
    queryFn: () => api.get<Scoreboard[]>(`/weeks/history${toQueryString({ before })}`),
    enabled,
  });
}

/** A week and its outcomes by id: the Friday review can run on any week, not only the current one. */
export function useWeekView(weekId: string | null) {
  return useQuery<WeekView, ApiError>({
    queryKey: [...weeksKey, 'view', weekId],
    queryFn: () => api.get<WeekView>(`/weeks/${weekId}`),
    enabled: weekId !== null,
  });
}

/** A grade can close, kill, roll or delegate an outcome, so everything that shows outcomes, tasks or numbers refreshes. */
function useReviewMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => Promise.all([weeksKey, scoreboardKey, daysKey, projectsKey, tasksKey].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export const useReviewOutcome = () =>
  useReviewMutation(({ id, input }: { id: string; input: OutcomeReview }) => api.post<Outcome>(`/outcomes/${id}/review`, input));

export const useFinishReview = () =>
  useReviewMutation(({ weekId, notes }: { weekId: string; notes: string }) => api.post<Week>(`/weeks/${weekId}/review`, { notes }));
