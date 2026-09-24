import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const ok = () => stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : json([])));

describe('the c key', () => {
  it('opens the capture dialog on a screen without a capture bar', async () => {
    ok();
    renderRoute('/week');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.keyboard('c');
    const dialog = await screen.findByRole('dialog', { name: 'Capture' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Capture' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('focuses the pinned bar on Today instead of opening a dialog', async () => {
    ok();
    renderRoute('/');
    await userEvent.keyboard('c');
    expect(screen.getByRole('textbox', { name: 'Capture' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores c typed inside a text field', async () => {
    ok();
    renderRoute('/');
    const input = screen.getByRole('textbox', { name: 'Capture' });
    await userEvent.type(input, 'c');
    expect(input).toHaveValue('c');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
