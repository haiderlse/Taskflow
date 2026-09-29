import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeepWorkBlock } from '../shared/exec/todaySchemas';
import type { DeepWorkFinishInput, DeepWorkInput, DeepWorkPatch, FinishResult } from '../shared/exec/deepWorkSchemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { daysKey, deepWorkKey, mustShipsKey, tasksKey } from './keys';

export { deepWorkKey };

/** Blocks dated from `from` to `to`, inclusive. Pass `enabled: false` until the range is trustworthy. */
export function useBlocks(range: { from: string; to: string }, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<DeepWorkBlock[], ApiError>({
    queryKey: [...deepWorkKey, range],
    queryFn: () => api.get<DeepWorkBlock[]>(`/deep-work${toQueryString(range)}`),
    enabled,
  });
}

/** Every block write refreshes the blocks and the day; `alsoRefresh` adds what a write can change beyond them. */
function useBlockMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>, alsoRefresh: readonly (readonly string[])[] = []) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => Promise.all([deepWorkKey, daysKey, ...alsoRefresh].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export const useCreateBlock = () => useBlockMutation((input: DeepWorkInput) => api.post<DeepWorkBlock>('/deep-work', input));

export const useUpdateBlock = () =>
  useBlockMutation(({ id, patch }: { id: string; patch: DeepWorkPatch }) => api.patch<DeepWorkBlock>(`/deep-work/${id}`, patch));

export const useStartBlock = () => useBlockMutation((id: string) => api.post<DeepWorkBlock>(`/deep-work/${id}/start`, {}));
export const usePauseBlock = () => useBlockMutation((id: string) => api.post<DeepWorkBlock>(`/deep-work/${id}/pause`, {}));
export const useResumeBlock = () => useBlockMutation((id: string) => api.post<DeepWorkBlock>(`/deep-work/${id}/resume`, {}));

/** Finishing can ship or block a Must Ship and file a waiting task, so those lists refresh too. */
export const useFinishBlock = () =>
  useBlockMutation(
    ({ id, input }: { id: string; input: DeepWorkFinishInput }) => api.post<FinishResult>(`/deep-work/${id}/finish`, input),
    [mustShipsKey, tasksKey]
  );
