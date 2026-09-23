import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ApiStatus } from './ApiStatus';
import { renderWithProviders, healthOk } from '../test/render';

afterEach(() => vi.unstubAllGlobals());

describe('ApiStatus', () => {
  it('says nothing while the API answers', async () => {
    const fetchMock = vi.fn(async () => healthOk());
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ApiStatus />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells you how to start the API when it is not reachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    renderWithProviders(<ApiStatus />);
    expect(await screen.findByRole('status')).toHaveTextContent('Local API not reachable. Start it with npm run server.');
  });
});
