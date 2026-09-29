import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useMustShips, useCreateMustShip, useUpdateMustShip, useRollMustShip } from './mustShips';
import { useDay } from './days';
import { stubFetch, json } from '../test/fetch';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);
const dayTaken = () =>
  new Response(JSON.stringify({ success: false, error: 'that day already has a must ship', code: 'DAY_TAKEN', details: { mustShip: { title: 'First' } } }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => vi.unstubAllGlobals());

describe('Must Ship hooks', () => {
  it('lists candidates with date=none and a status list', async () => {
    const calls = stubFetch(() => json([]));
    const { result } = renderHook(() => useMustShips({ date: 'none', context: 'work', status: ['planned'] }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0].url).toBe('/api/exec/must-ships?date=none&status=planned&context=work');
  });

  it('creates, patches and rolls, and every write refreshes the open day', async () => {
    const calls = stubFetch((url) => (url.startsWith('/api/exec/days/') ? json({}) : json({ id: 'm1' })));
    const { result } = renderHook(() => ({ day: useDay('2026-09-29'), create: useCreateMustShip(), update: useUpdateMustShip(), roll: useRollMustShip() }), { wrapper });
    await waitFor(() => expect(result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({ title: 'Tracker sent', context: 'work', date: '2026-09-29' });
      await result.current.update.mutateAsync({ id: 'm1', patch: { title: 'Tracker sent to all' } });
      await result.current.roll.mutateAsync({ id: 'm1', date: '2026-09-30' });
    });
    expect(calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', '/api/exec/must-ships', { title: 'Tracker sent', context: 'work', date: '2026-09-29' }],
      ['PATCH', '/api/exec/must-ships/m1', { title: 'Tracker sent to all' }],
      ['POST', '/api/exec/must-ships/m1/roll', { date: '2026-09-30' }],
    ]);
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29').length).toBeGreaterThanOrEqual(4));
  });

  it('refreshes the day after DAY_TAKEN so the Must Ship that won shows', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'POST' ? dayTaken() : json({})));
    const { result } = renderHook(() => ({ day: useDay('2026-09-29'), create: useCreateMustShip() }), { wrapper });
    await waitFor(() => expect(result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({ title: 'Second', context: 'work', date: '2026-09-29' }).catch(() => undefined);
    });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29')).toHaveLength(2));
  });
});
