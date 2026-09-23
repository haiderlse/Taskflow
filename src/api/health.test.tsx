import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useHealth } from './health';
import { healthOk } from '../test/render';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('useHealth', () => {
  it('loads the health envelope through the client', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => healthOk()));
    const { result } = renderHook(() => useHealth(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ status: 'ok', schemaVersion: 1 });
  });

  it('exposes an ApiError when the API is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const { result } = renderHook(() => useHealth(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 'NETWORK' });
  });
});
