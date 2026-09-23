import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRoute, healthOk } from '../test/render';

beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => healthOk())));
afterEach(() => vi.unstubAllGlobals());

describe('the app shell', () => {
  it('opens on Today with the first-week banner', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /plan your first week/i })).toHaveAttribute('href', '/plan');
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
});
