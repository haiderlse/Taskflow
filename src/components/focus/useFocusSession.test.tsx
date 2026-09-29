import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../api/queryClient';
import { daysKey } from '../../api/keys';
import { useFocusSession } from './useFocusSession';
import { stubFetch, json, failure } from '../../test/fetch';
import { SETTINGS, makeBlock, makeDayView, makeMustShip } from '../../test/fixtures';
import type { DayView } from '../../shared/exec/todaySchemas';

const DATE = '2026-09-29';
const STARTED = '2026-09-29T04:00:00.000Z';

/** StrictMode runs effects twice in development, which is exactly what a session start must survive. Each hook gets its own cache. */
const fresh = () => {
  const client = createQueryClient({ retry: false });
  return ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  );
};

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T04:00:00Z') }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ship = makeMustShip({ title: 'Delivery tracker sent' });

/** A tiny server: creating a block adds it to the day, starting one marks it live. */
function server(initial: DayView, failCreates = 0) {
  const state = { day: initial, failCreates };
  const calls = stubFetch((url, init) => {
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url === `/api/exec/days/${DATE}`) return json(state.day);
    if (url === '/api/exec/deep-work' && init?.method === 'POST') {
      if (state.failCreates > 0) {
        state.failCreates -= 1;
        return failure(500, 'INTERNAL', 'internal server error');
      }
      const created = makeBlock(JSON.parse(String(init.body)));
      state.day = { ...state.day, blocks: [...state.day.blocks, created] };
      return json(created, 201);
    }
    const start = url.match(/\/deep-work\/([^/]+)\/start$/);
    if (start) {
      state.day = { ...state.day, blocks: state.day.blocks.map((block) => (block.id === start[1] ? { ...block, startedAt: STARTED, mustShipId: ship.id } : block)) };
      return json(state.day.blocks.find((block) => block.id === start[1]));
    }
    return json({});
  });
  return calls;
}
const writes = (calls: ReturnType<typeof server>) => calls.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.url}`);

describe('useFocusSession', () => {
  it('resumes a live block with its Must Ship as the subject, writing nothing', async () => {
    const live = makeBlock({ mustShipId: ship.id, startedAt: '2026-09-29T03:40:00.000Z' });
    const calls = server(makeDayView({ mustShip: ship, blocks: [live] }));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    expect(result.current.kind).toBe('loading');
    await waitFor(() => expect(result.current.kind).toBe('live'));
    expect(result.current).toMatchObject({ block: { id: live.id }, subject: { title: 'Delivery tracker sent' } });
    expect(writes(calls)).toEqual([]);
  });

  it('creates a block and starts it, once, even under StrictMode, then goes live', async () => {
    const calls = server(makeDayView({ mustShip: ship }));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current.kind).toBe('live'));
    const created = calls.filter((call) => call.method === 'POST' && call.url === '/api/exec/deep-work');
    expect(created).toHaveLength(1);
    expect(created[0].body).toEqual({ date: DATE, context: 'work', plannedStart: '09:00', plannedMinutes: 90, outcomeId: null, mustShipId: null });
    expect(writes(calls).filter((write) => write.endsWith('/start'))).toHaveLength(1);
  });

  it('does not start a new block when a resumed session is finished and the Must Ship is still planned', async () => {
    const live = makeBlock({ mustShipId: ship.id, startedAt: '2026-09-29T03:40:00.000Z' });
    let day = makeDayView({ mustShip: ship, blocks: [live] });
    const calls = stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : url === `/api/exec/days/${DATE}` ? json(day) : json({})));
    const client = createQueryClient({ retry: false });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </StrictMode>
    );
    const { result } = renderHook(() => useFocusSession(), { wrapper });
    await waitFor(() => expect(result.current.kind).toBe('live'));
    day = makeDayView({ mustShip: ship, blocks: [{ ...live, endedAt: '2026-09-29T04:00:00.000Z', result: 'progress' }] });
    await act(async () => {
      await client.invalidateQueries({ queryKey: daysKey });
    });
    await waitFor(() => expect(result.current.kind).toBe('starting'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(writes(calls)).toEqual([]);
  });

  it('starts a planned, unstarted block without creating another', async () => {
    const planned = makeBlock({ plannedStart: '08:35' });
    const calls = server(makeDayView({ mustShip: ship, blocks: [planned] }));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current.kind).toBe('live'));
    expect(writes(calls)).toEqual([`POST /api/exec/deep-work/${planned.id}/start`]);
  });

  it('starts nothing for a Must Ship that is no longer planned, or for no Must Ship', async () => {
    const calls = server(makeDayView({ mustShip: makeMustShip({ title: 'Delivery tracker sent', status: 'shipped' }) }));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current).toEqual({ kind: 'closed', title: 'Delivery tracker sent', status: 'shipped' }));
    expect(writes(calls)).toEqual([]);
    vi.unstubAllGlobals();
    server(makeDayView());
    const empty = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(empty.result.current.kind).toBe('nothing'));
  });

  it('reports a failed start with a retry that tries again', async () => {
    const calls = server(makeDayView({ mustShip: ship }), 1);
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current.kind).toBe('error'));
    expect(result.current).toMatchObject({ kind: 'error', what: null, error: { code: 'INTERNAL' } });
    await act(async () => {
      if (result.current.kind === 'error') result.current.retry();
    });
    await waitFor(() => expect(result.current.kind).toBe('live'));
    expect(calls.filter((call) => call.method === 'POST' && call.url === '/api/exec/deep-work')).toHaveLength(2);
  });

  it('reports a failed read of today or of the schedule, naming it, and never starts anything', async () => {
    const calls = stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current.kind).toBe('error'));
    expect(result.current).toMatchObject({ what: 'today', error: { code: 'INTERNAL' } });
    expect(calls.filter((call) => call.method !== 'GET')).toEqual([]);
    vi.unstubAllGlobals();
    stubFetch(() => failure(500, 'INTERNAL', 'internal server error'));
    const schedule = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(schedule.result.current).toMatchObject({ kind: 'error', what: 'the schedule' }));
  });
});
