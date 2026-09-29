import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Settings } from '../shared/exec/schemas';
import type { SettingsUpdate } from '../shared/exec/todaySchemas';
import { api, ApiError } from './client';
import { daysKey, settingsKey } from './keys';

export { settingsKey };

export function useSettings() {
  return useQuery<Settings, ApiError>({ queryKey: settingsKey, queryFn: () => api.get<Settings>('/settings') });
}

/** The schedule decides Today's moment, so the saved settings go straight into the cache and the day refreshes. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation<Settings, ApiError, SettingsUpdate>({
    mutationFn: (input) => api.put<Settings>('/settings', input),
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsKey, saved);
      return queryClient.invalidateQueries({ queryKey: daysKey });
    },
  });
}
