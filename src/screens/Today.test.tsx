import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeLookup, makeOutcome, makeWeekView } from '../test/fixtures';
import type { WeekLookup } from '../shared/exec/schemas';

afterEach(() => vi.unstubAllGlobals());

const api = (lookup: WeekLookup) =>
  stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : url.startsWith('/api/exec/weeks') ? json(lookup) : json([])));

describe('Today and the week', () => {
  it('invites the first plan when no week has ever held an outcome', async () => {
    api(makeLookup());
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Plan your first week' })).toHaveAttribute('href', '/plan');
  });

  it('asks for this week\'s plan once there is history', async () => {
    api(makeLookup({ hasHistory: true, current: makeWeekView([]) }));
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Plan this week' })).toHaveAttribute('href', '/plan');
    expect(screen.queryByRole('link', { name: 'Plan your first week' })).toBeNull();
  });

  it("lists this week's outcomes instead of a banner when the week is planned", async () => {
    api(makeLookup({ current: makeWeekView([makeOutcome({ title: 'Supplier plan confirmed', progress: 40 }), makeOutcome({ title: 'Killed', slot: null, status: 'killed' })]) }));
    renderRoute('/');
    const list = await screen.findByRole('list', { name: 'This week' });
    expect(list).toHaveTextContent('Supplier plan confirmed');
    expect(list).toHaveTextContent('40%');
    expect(list).not.toHaveTextContent('Killed');
    expect(screen.getByRole('link', { name: 'Open the week' })).toHaveAttribute('href', '/week');
    expect(screen.queryByRole('link', { name: /Plan/ })).toBeNull();
  });
});
