import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeTask } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('/capture', () => {
  it('shows the inbox count and the five most recent captures, newest first', async () => {
    const tasks = [6, 5, 4, 3, 2, 1].map((n) => makeTask({ title: `Item ${n}` }));
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : json(tasks)));
    renderRoute('/capture');
    expect(await screen.findByText('6 in inbox')).toBeInTheDocument();
    const recent = screen.getByRole('list', { name: 'Recent captures' });
    expect(within(recent).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Item 6work',
      'Item 5work',
      'Item 4work',
      'Item 3work',
      'Item 2work',
    ]);
    expect(screen.getByRole('textbox', { name: 'Capture' })).toHaveFocus();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  });
});
