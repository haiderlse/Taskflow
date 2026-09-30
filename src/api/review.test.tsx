import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useFinishReview, useReviewOutcome, useScoreboard, useWeekHistory, useWeekView } from './review';
import { useShutdown } from './days';
import { useBlockMustShip } from './mustShips';
import { useTasks } from './tasks';
import { ApiError } from './client';
import { errorMessage } from './errors';
import { stubFetch, json } from '../test/fetch';
import { WEEK_ID, makeScoreboard } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('review hooks', () => {
  it('reads nothing until there is a week, then its scoreboard and outcomes', async () => {
    const calls = stubFetch(() => json(makeScoreboard()));
    const { rerender } = renderHook(({ id }) => ({ board: useScoreboard(id), view: useWeekView(id) }), {
      wrapper,
      initialProps: { id: null as string | null },
    });
    expect(calls).toHaveLength(0);
    rerender({ id: WEEK_ID });
    await waitFor(() => expect(calls.map((c) => c.url).sort()).toEqual([`/api/exec/weeks/${WEEK_ID}`, `/api/exec/weeks/${WEEK_ID}/scoreboard`]));
  });

  it('reads the earlier weeks before a date once enabled', async () => {
    const calls = stubFetch(() => json([]));
    const { rerender } = renderHook(({ enabled }) => useWeekHistory('2026-10-02', { enabled }), { wrapper, initialProps: { enabled: false } });
    expect(calls).toHaveLength(0);
    rerender({ enabled: true });
    await waitFor(() => expect(calls.map((c) => c.url)).toEqual(['/api/exec/weeks/history?before=2026-10-02']));
  });

  it('grades an outcome and refreshes the scoreboard', async () => {
    const calls = stubFetch(() => json(makeScoreboard()));
    const { result } = renderHook(() => ({ board: useScoreboard(WEEK_ID), grade: useReviewOutcome() }), { wrapper });
    await waitFor(() => expect(result.current.board.isSuccess).toBe(true));
    await act(async () => {
      await result.current.grade.mutateAsync({ id: 'o1', input: { grade: 'done' } });
    });
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/outcomes/o1/review', body: { grade: 'done' } });
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/scoreboard'))).toHaveLength(2));
  });

  it('stamps the week with its notes', async () => {
    const calls = stubFetch(() => json({}));
    const { result } = renderHook(() => useFinishReview(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ weekId: WEEK_ID, notes: 'Good week' });
    });
    expect(calls[0]).toMatchObject({ method: 'POST', url: `/api/exec/weeks/${WEEK_ID}/review`, body: { notes: 'Good week' } });
  });
});

describe('shutdown hooks', () => {
  it('closes the day with an empty body', async () => {
    const calls = stubFetch(() => json({}));
    const { result } = renderHook(() => useShutdown(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('2026-09-29');
    });
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/exec/days/2026-09-29/shutdown', body: {} });
  });

  it('blocks a Must Ship and refreshes the task lists', async () => {
    const calls = stubFetch(() => json([]));
    const { result } = renderHook(() => ({ tasks: useTasks({ status: ['waiting'] }), block: useBlockMustShip() }), { wrapper });
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));
    const blocker = { what: 'No quote', owner: 'Sana', nextAction: 'Chase the quote' };
    await act(async () => {
      await result.current.block.mutateAsync({ id: 'm1', blocker });
    });
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/must-ships/m1/block', body: blocker });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/tasks?status=waiting')).toHaveLength(2));
  });

  it('says the two refusals in plain words', () => {
    expect(errorMessage(new ApiError(409, 'SHUTDOWN_NOT_READY', 'x'))).toBe("grade today's Must Ship first");
    expect(errorMessage(new ApiError(409, 'REVIEW_NOT_READY', 'x'))).toBe('grade every outcome first');
  });
});
