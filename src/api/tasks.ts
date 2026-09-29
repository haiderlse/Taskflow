import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Context, Task, TaskPatch, TaskStatus } from '../shared/exec/schemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { daysKey, tasksKey } from './keys';

export { tasksKey };

export type TaskFilters = { status?: TaskStatus[]; context?: Context; week?: string; followUpBy?: string };
export type CaptureInput = { title: string; context: Context; notes?: string };

export const taskListPath = (filters: TaskFilters): string =>
  `/tasks${toQueryString({ status: filters.status, context: filters.context, week: filters.week, followUpBy: filters.followUpBy })}`;

export function useTasks(filters: TaskFilters = {}) {
  return useQuery<Task[], ApiError>({ queryKey: [...tasksKey, filters], queryFn: () => api.get<Task[]>(taskListPath(filters)) });
}

/** Every write invalidates every tasks query and the day, so lists and Today refresh without bookkeeping. */
function useTasksMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: tasksKey }), queryClient.invalidateQueries({ queryKey: daysKey })]),
  });
}

export const useCaptureTask = () => useTasksMutation((input: CaptureInput) => api.post<Task>('/tasks', input));

export const useUpdateTask = () =>
  useTasksMutation(({ id, patch }: { id: string; patch: TaskPatch }) => api.patch<Task>(`/tasks/${id}`, patch));

export const useRollTask = () =>
  useTasksMutation(({ id, date }: { id: string; date: string }) => api.post<Task>(`/tasks/${id}/roll`, { date }));

export const useDeleteTask = () => useTasksMutation((id: string) => api.delete<{ id: string }>(`/tasks/${id}`));
