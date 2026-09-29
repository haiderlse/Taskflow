import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useSettings, useUpdateSettings } from './settings';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('useUpdateSettings', () => {
  it('puts the schedule and serves the saved settings from the cache at once', async () => {
    const saved = { ...SETTINGS, workDays: [1, 2, 3, 4] };
    const calls = stubFetch((_url, init) => json(init?.method === 'PUT' ? saved : SETTINGS));
    const { result } = renderHook(() => ({ read: useSettings(), write: useUpdateSettings() }), { wrapper });
    await waitFor(() => expect(result.current.read.data?.workDays).toEqual([1, 2, 3, 4, 5]));
    const schedule = { workDays: [1, 2, 3, 4], deepWorkStart: '08:35', deepWorkMinutes: 90, shutdownTime: '17:00', officeStart: '08:15', officeEnd: '18:00', buildBlocks: SETTINGS.buildBlocks };
    await act(async () => {
      await result.current.write.mutateAsync(schedule);
    });
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ url: '/api/exec/settings', body: schedule });
    await waitFor(() => expect(result.current.read.data?.workDays).toEqual([1, 2, 3, 4]));
  });
});
