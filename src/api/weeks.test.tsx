import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useWeekLookup, useAddOutcome, useUpdateOutcome, useRollOutcome } from './weeks';
import { stubFetch, json } from '../test/fetch';
import { WEEK_ID, makeLookup, makeOutcome, makeWeekView } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);
const input = { title: 'Supplier plan confirmed', category: 'office' as const, definitionOfDone: 'Dates confirmed' };

afterEach(() => vi.unstubAllGlobals());

describe('useWeekLookup', () => {
  it('reads the week containing a date', async () => {
    const calls = stubFetch(() => json(makeLookup({ hasHistory: true })));
    const { result } = renderHook(() => useWeekLookup('2026-09-22'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.hasHistory).toBe(true);
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/exec/weeks?date=2026-09-22' });
  });
});

describe('outcome mutations', () => {
  it('creates the week first when there is none, then adds the outcome', async () => {
    const calls = stubFetch((url) => (url === '/api/exec/weeks' ? json(makeWeekView(), 201) : json(makeOutcome(), 201)));
    const { result } = renderHook(() => useAddOutcome(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ date: '2026-09-22', input });
    });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', '/api/exec/weeks', { date: '2026-09-22' }],
      ['POST', `/api/exec/weeks/${WEEK_ID}/outcomes`, input],
    ]);
  });

  it('adds straight to a known week, patches and rolls', async () => {
    const calls = stubFetch((url) => (url === '/api/exec/weeks' ? json(makeWeekView()) : json(makeOutcome())));
    const { result } = renderHook(() => ({ add: useAddOutcome(), update: useUpdateOutcome(), roll: useRollOutcome() }), { wrapper });
    await act(async () => {
      await result.current.add.mutateAsync({ date: '2026-09-22', weekId: 'w1', input });
      await result.current.update.mutateAsync({ id: 'o1', patch: { progress: 60 } });
      await result.current.roll.mutateAsync({ id: 'o2', date: '2026-09-22' });
    });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', '/api/exec/weeks/w1/outcomes'],
      ['PATCH', '/api/exec/outcomes/o1'],
      ['POST', '/api/exec/weeks'],
      ['POST', '/api/exec/outcomes/o2/roll'],
    ]);
    expect(calls[1].body).toEqual({ progress: 60 });
    expect(calls[3].body).toEqual({ weekId: WEEK_ID });
  });
});
