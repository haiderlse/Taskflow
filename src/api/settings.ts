import { useQuery } from '@tanstack/react-query';
import type { Settings } from '../shared/exec/schemas';
import { api, ApiError } from './client';

export const settingsKey = ['exec', 'settings'] as const;

export function useSettings() {
  return useQuery<Settings, ApiError>({ queryKey: settingsKey, queryFn: () => api.get<Settings>('/settings') });
}
