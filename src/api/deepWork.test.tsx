import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useBlocks, useCreateBlock, useUpdateBlock, useStartBlock, usePauseBlock, useResumeBlock, useFinishBlock } from './deepWork';
import { useDay } from './days';
import { useMustShips } from './mustShips';
import { useTasks } from './tasks';
import { stubFetch, json } from '../test/fetch';
import { makeBlock } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('useBlocks', () => {
  it('reads a date range, and waits until it is enabled', async () => {
    const calls = stubFetch(() => json([makeBlock()]));
    const { result, rerender } = renderHook(({ enabled }) => useBlocks({ from: '2026-09-27', to: '2026-10-03' }, { enabled }), { wrapper, initialProps: { enabled: false } });
    expect(calls).toHaveLength(0);
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/exec/deep-work?from=2026-09-27&to=2026-10-03' });
  });
});

describe('block writes', () => {
  it('sends each verb to its route, and refreshes the blocks and the day after each', async () => {
    const calls = stubFetch((url) => (url.startsWith('/api/exec/days/') ? json({}) : url.includes('/deep-work?') ? json([]) : json(makeBlock())));
    const { result } = renderHook(
      () => ({
        blocks: useBlocks({ from: '2026-09-27', to: '2026-10-03' }),
        day: useDay('2026-09-29'),
        create: useCreateBlock(),
        update: useUpdateBlock(),
        start: useStartBlock(),
        pause: usePauseBlock(),
        resume: useResumeBlock(),
      }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.blocks.isSuccess && result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({ date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 });
      await result.current.update.mutateAsync({ id: 'b1', patch: { plannedMinutes: 60 } });
      await result.current.start.mutateAsync('b1');
      await result.current.pause.mutateAsync('b1');
      await result.current.resume.mutateAsync('b1');
    });
    expect(calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', '/api/exec/deep-work', { date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 }],
      ['PATCH', '/api/exec/deep-work/b1', { plannedMinutes: 60 }],
      ['POST', '/api/exec/deep-work/b1/start', {}],
      ['POST', '/api/exec/deep-work/b1/pause', {}],
      ['POST', '/api/exec/deep-work/b1/resume', {}],
    ]);
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29').length).toBeGreaterThanOrEqual(6));
    expect(calls.filter((c) => c.url.startsWith('/api/exec/deep-work?')).length).toBeGreaterThanOrEqual(6);
  });

  it('refreshes Must Ships and tasks after a finish, since it can ship, block and file a task', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'POST' ? json({ block: makeBlock(), mustShip: null, task: null }) : json([])));
    const { result } = renderHook(
      () => ({ ships: useMustShips({ date: '2026-09-29' }), tasks: useTasks({ status: ['waiting'] }), finish: useFinishBlock() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.ships.isSuccess && result.current.tasks.isSuccess).toBe(true));
    await act(async () => {
      await result.current.finish.mutateAsync({ id: 'b1', input: { result: 'completed' } });
    });
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/deep-work/b1/finish', body: { result: 'completed' } });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/must-ships?date=2026-09-29')).toHaveLength(2));
    expect(calls.filter((c) => c.url === '/api/exec/tasks?status=waiting')).toHaveLength(2);
  });
});
