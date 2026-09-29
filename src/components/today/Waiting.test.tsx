import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Waiting } from './Waiting';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { makeTask } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('Waiting', () => {
  it('counts what needs follow-up and expands to act on it', async () => {
    const task = makeTask({ title: 'Delivery tracker', status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-10-02' });
    const calls = stubFetch(() => json({}));
    renderWithProviders(<Waiting today="2026-10-02" workDays={[1, 2, 3, 4, 5]} waiting={[task]} />);
    await userEvent.click(screen.getByRole('button', { name: '1 delegated item needs follow-up' }));
    expect(screen.getByText('Delivery tracker — Bilal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Followed up on "Delivery tracker"' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ method: 'PATCH', url: `/api/exec/tasks/${task.id}`, body: { followUpDate: '2026-10-05' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Received "Delivery tracker"' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { status: 'done' } }));
  });

  it('says when nothing is due and pluralises the count', () => {
    const { unmount } = renderWithProviders(<Waiting today="2026-10-02" workDays={[1, 2, 3, 4, 5]} waiting={[]} />);
    expect(screen.getByText('Nothing to follow up today.')).toBeInTheDocument();
    unmount();
    renderWithProviders(<Waiting today="2026-10-02" workDays={[1, 2, 3, 4, 5]} waiting={[makeTask({ ownerName: 'A' }), makeTask({ ownerName: 'B' })]} />);
    expect(screen.getByRole('button', { name: '2 delegated items need follow-up' })).toHaveAttribute('aria-expanded', 'false');
  });
});
