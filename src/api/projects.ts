import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project, ProjectDetail, ProjectInput, ProjectPatch, ProjectSummary } from '../shared/exec/schemas';
import { api, ApiError } from './client';
import { projectsKey, weeksKey } from './keys';

export { projectsKey };

export function useProjects() {
  return useQuery<ProjectSummary[], ApiError>({ queryKey: projectsKey, queryFn: () => api.get<ProjectSummary[]>('/projects') });
}

export function useProject(id: string) {
  return useQuery<ProjectDetail, ApiError>({ queryKey: [...projectsKey, id], queryFn: () => api.get<ProjectDetail>(`/projects/${id}`) });
}

function useProjectMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Project>) {
  const queryClient = useQueryClient();
  return useMutation<Project, ApiError, TVariables>({
    mutationFn,
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: projectsKey }), queryClient.invalidateQueries({ queryKey: weeksKey })]),
  });
}

export const useCreateProject = () => useProjectMutation((input: ProjectInput) => api.post<Project>('/projects', input));

export const useUpdateProject = () =>
  useProjectMutation(({ id, patch }: { id: string; patch: ProjectPatch }) => api.patch<Project>(`/projects/${id}`, patch));
