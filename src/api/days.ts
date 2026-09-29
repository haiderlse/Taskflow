import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayView } from '../shared/exec/todaySchemas';
import { api, ApiError } from './client';
import { daysKey, tasksKey } from './keys';

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
