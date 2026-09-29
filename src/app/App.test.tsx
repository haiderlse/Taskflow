import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRoute, healthOk } from '../test/render';
import { SETTINGS } from '../test/fixtures';
import { json } from '../test/fetch';

beforeEach(() => vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (String(input).endsWith('/settings') ? json(SETTINGS) : healthOk()))));
afterEach(() => vi.unstubAllGlobals());

describe('the app shell', () => {
  it('opens on Today with the first-week banner', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /plan your first week/i })).toHaveAttribute('href', '/plan');
  });

  it('offers exactly the five primary destinations, in order', async () => {
    renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Today',
      'Week',
      'Inbox',
      'Projects',
      'Review',
    ]);
  });

  it.each([
    ['/week', 'Week'],
    ['/inbox', 'Inbox'],
    ['/projects', 'Projects'],
    ['/review', 'Review'],
  ])('shows %s inside the shell', async (path, title) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it.each([
    ['/focus', 'Focus'],
    ['/shutdown', 'Shutdown'],
    ['/plan', 'Plan the week'],
    ['/capture', 'Capture'],
  ])('shows %s full screen, without the primary navigation', async (path, title) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  });

  it('shows a way back from an unknown URL, inside the shell', async () => {
    renderRoute('/nowhere');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('warns about an unreachable API on the full-screen capture page too', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    renderRoute('/capture');
    expect(await screen.findByText(/Local API not reachable/)).toBeInTheDocument();
  });
});
