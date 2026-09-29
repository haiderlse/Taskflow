import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useProject, useCreateProject, useUpdateProject } from './projects';
import { stubFetch, json } from '../test/fetch';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('project hooks', () => {
  it('reads one project, creates and updates', async () => {
    const calls = stubFetch(() => json({ project: { id: 'p1' }, outcomes: [], tasks: [] }));
    const { result } = renderHook(() => ({ detail: useProject('p1'), create: useCreateProject(), update: useUpdateProject() }), { wrapper });
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({ name: 'Supply plan', context: 'work' });
      await result.current.update.mutateAsync({ id: 'p1', patch: { status: 'archived' } });
    });
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/exec/projects/p1' });
    // Each write invalidates and refetches the open detail query, so reads interleave; check the writes alone.
    expect(calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', '/api/exec/projects', { name: 'Supply plan', context: 'work' }],
      ['PATCH', '/api/exec/projects/p1', { status: 'archived' }],
    ]);
  });
});
