import { useQuery } from '@tanstack/react-query';
import type { Health } from '../shared/exec/api';
import { api, ApiError } from './client';

export const healthQueryKey = ['exec', 'health'] as const;

export function useHealth() {
  return useQuery<Health, ApiError>({ queryKey: healthQueryKey, queryFn: () => api.get<Health>('/health') });
}
