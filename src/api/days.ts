import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayView } from '../shared/exec/todaySchemas';
import { api, ApiError } from './client';
import { daysKey, deepWorkKey, scoreboardKey, tasksKey } from './keys';

export { daysKey };

/** The Today screen in one read. Pass `enabled: false` until the date is trustworthy (settings loaded). */
export function useDay(date: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<DayView, ApiError>({ queryKey: [...daysKey, date], queryFn: () => api.get<DayView>(`/days/${date}`), enabled });
}

/** Setting the secondaries can process an inbox task, so the day and every task list refresh. */
export function useSetSecondaries() {
  const queryClient = useQueryClient();
  return useMutation<DayView, ApiError, { date: string; taskIds: string[] }>({
    mutationFn: ({ date, taskIds }) => api.put<DayView>(`/days/${date}/slots`, { taskIds }),
    onSuccess: () => Promise.all([daysKey, tasksKey].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

/** Closing the day can end a running session, so the blocks and the week's numbers refresh with the day. */
export function useShutdown() {
  const queryClient = useQueryClient();
  return useMutation<DayView, ApiError, string>({
    mutationFn: (date) => api.post<DayView>(`/days/${date}/shutdown`, {}),
    onSuccess: () => Promise.all([daysKey, deepWorkKey, scoreboardKey].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
