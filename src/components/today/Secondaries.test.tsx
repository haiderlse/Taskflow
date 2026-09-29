import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Secondaries } from './Secondaries';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { makeTask } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('Secondaries', () => {
  it('adds an inbox task as a secondary by putting the new list', async () => {
    const kept = makeTask({ title: 'Review the dashboard', status: 'this_week' });
    const inbox = makeTask({ title: 'Send the price list' });
    const calls = stubFetch((url, init) => (init?.method === 'PUT' ? json({}) : url.includes('status=inbox') ? json([inbox]) : json([kept])));
    renderWithProviders(<Secondaries date="2026-09-29" secondaries={[{ slot: 1, task: kept }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add a secondary' }));
    const choices = await screen.findByRole('list', { name: 'Choose a secondary' });
    expect(within(choices).queryByRole('button', { name: 'Review the dashboard' })).toBeNull();
    await userEvent.click(within(choices).getByRole('button', { name: 'Send the price list' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ url: '/api/exec/days/2026-09-29/slots', body: { taskIds: [kept.id, inbox.id] } }));
  });

  it('checks a secondary off and removes one; two rows leave no way to add a third', async () => {
    const a = makeTask({ title: 'A', status: 'this_week' });
    const b = makeTask({ title: 'B', status: 'done' });
    const calls = stubFetch(() => json({}));
    renderWithProviders(<Secondaries date="2026-09-29" secondaries={[{ slot: 1, task: a }, { slot: 2, task: b }]} />);
    expect(screen.queryByRole('button', { name: 'Add a secondary' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'B' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'A' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: `/api/exec/tasks/${a.id}`, body: { status: 'done' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove "A"' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ taskIds: [b.id] }));
  });
});
