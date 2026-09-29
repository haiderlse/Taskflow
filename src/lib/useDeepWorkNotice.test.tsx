import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from '../api/queryClient';
import { useDeepWorkNotice } from './useDeepWorkNotice';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS } from '../test/fixtures';

const fresh = () => {
  const client = createQueryClient({ retry: false });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

let calls: ReturnType<typeof stubFetch>;

/** Waits until the schedule has been asked for, then lets it land, so a quiet result is not just a slow one. */
const settled = async () => {
  await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  calls.length = 0;
};

function notification(permission: string) {
  const ctor = Object.assign(vi.fn(), { permission });
  vi.stubGlobal('Notification', ctor);
  return ctor;
}

beforeEach(() => {
  localStorage.clear();
  calls = stubFetch(() => json(SETTINGS));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useDeepWorkNotice', () => {
  it('fires once on the day, five minutes before deep work, however often it ticks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T03:31:00Z') });
    const shown = notification('granted');
    renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await waitFor(() => expect(shown).toHaveBeenCalledWith('Deep work begins in 5 minutes'));
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(shown).toHaveBeenCalledTimes(1);
  });

  it('stays quiet without permission, outside the window, on a non-work day, or when it already fired today', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T03:31:00Z') });
    const denied = notification('default');
    const first = renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(denied).not.toHaveBeenCalled();
    first.unmount();

    vi.setSystemTime(new Date('2026-09-29T03:40:00Z'));
    const late = notification('granted');
    const second = renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(late).not.toHaveBeenCalled();
    second.unmount();

    vi.setSystemTime(new Date('2026-10-03T03:31:00Z'));
    const weekend = notification('granted');
    const third = renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(weekend).not.toHaveBeenCalled();
    third.unmount();

    vi.setSystemTime(new Date('2026-09-29T03:31:00Z'));
    localStorage.setItem('taskflow.noticeFired', '2026-09-29');
    const again = notification('granted');
    renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(again).not.toHaveBeenCalled();
  });

  it('survives a browser that refuses to construct a Notification, and does not retry that day', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T03:31:00Z') });
    const refusing = Object.assign(
      vi.fn(() => {
        throw new TypeError('Illegal constructor');
      }),
      { permission: 'granted' },
    );
    vi.stubGlobal('Notification', refusing);
    const { result } = renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await waitFor(() => expect(refusing).toHaveBeenCalledTimes(1));
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(refusing).toHaveBeenCalledTimes(1);
    expect(result.current).toBeUndefined();
  });

  it('renders normally and shows nothing where the browser has no notifications', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T03:31:00Z') });
    vi.stubGlobal('Notification', undefined);
    const { result } = renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(result.current).toBeUndefined();
    expect(localStorage.getItem('taskflow.noticeFired')).toBeNull();
  });
});
