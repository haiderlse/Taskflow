import { useQuery } from '@tanstack/react-query';
import type { Project } from '../shared/exec/schemas';
import { api, ApiError } from './client';

export const projectsKey = ['exec', 'projects'] as const;

export function useProjects() {
  return useQuery<Project[], ApiError>({ queryKey: projectsKey, queryFn: () => api.get<Project[]>('/projects') });
}
