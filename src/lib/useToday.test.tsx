import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from '../api/queryClient';
import { useToday } from './useToday';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useToday', () => {
  it('rolls over at Karachi midnight without a reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T18:59:30Z') });
    stubFetch(() => json(SETTINGS));
    const { result } = renderHook(() => useToday(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.today).toBe('2026-09-29');
    expect(result.current.settings?.workDays).toEqual([1, 2, 3, 4, 5]);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.today).toBe('2026-09-30');
  });
});
