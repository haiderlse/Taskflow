import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useDay, useSetSecondaries } from './days';
import { useTasks, useUpdateTask } from './tasks';
import { stubFetch, json } from '../test/fetch';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('day hooks', () => {
  it('does not read the day until it is enabled', async () => {
    const calls = stubFetch(() => json({}));
    const { rerender } = renderHook(({ enabled }) => useDay('2026-09-29', { enabled }), { wrapper, initialProps: { enabled: false } });
    expect(calls).toHaveLength(0);
    rerender({ enabled: true });
    await waitFor(() => expect(calls.map((c) => c.url)).toEqual(['/api/exec/days/2026-09-29']));
  });

  it('puts the secondaries and refreshes the day and the task lists', async () => {
    const calls = stubFetch((url) => (url.startsWith('/api/exec/tasks') ? json([]) : json({})));
    const { result } = renderHook(() => ({ day: useDay('2026-09-29'), tasks: useTasks({ status: ['inbox'] }), set: useSetSecondaries() }), { wrapper });
    await waitFor(() => expect(result.current.tasks.isSuccess && result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.set.mutateAsync({ date: '2026-09-29', taskIds: ['t1'] });
    });
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ url: '/api/exec/days/2026-09-29/slots', body: { taskIds: ['t1'] } });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/tasks?status=inbox')).toHaveLength(2));
    expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29')).toHaveLength(2);
  });

  it('refreshes the day after any task write, so Waiting and secondaries stay current', async () => {
    const calls = stubFetch(() => json({}));
    const { result } = renderHook(() => ({ day: useDay('2026-09-29'), update: useUpdateTask() }), { wrapper });
    await waitFor(() => expect(result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.update.mutateAsync({ id: 't1', patch: { status: 'done' } });
    });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29')).toHaveLength(2));
  });
});
