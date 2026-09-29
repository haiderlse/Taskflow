import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeDayView } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const api = () => stubFetch((url, init) => (init?.method === 'PUT' ? json(SETTINGS) : url.includes('/days/') ? json(makeDayView()) : url.endsWith('/settings') ? json(SETTINGS) : json([])));

describe('/settings', () => {
  it('shows the schedule and saves the edits', async () => {
    const calls = api();
    renderRoute('/settings');
    const friday = await screen.findByRole('checkbox', { name: 'Friday' });
    expect(friday).toBeChecked();
    await userEvent.click(friday);
    fireEvent.change(screen.getByLabelText('Deep work starts'), { target: { value: '09:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add a build block' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove build block 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
        workDays: [1, 2, 3, 4],
        deepWorkStart: '09:00',
        deepWorkMinutes: 90,
        shutdownTime: '17:00',
        officeStart: '08:15',
        officeEnd: '18:00',
        buildBlocks: [
          { weekday: 4, start: '06:30', minutes: 50 },
          { weekday: 6, start: '09:00', minutes: 180 },
          { weekday: 6, start: '09:00', minutes: 120 },
        ],
      })
    );
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
  });

  it('refuses reversed office hours before sending them', async () => {
    api();
    renderRoute('/settings');
    fireEvent.change(await screen.findByLabelText('Office opens'), { target: { value: '19:00' } });
    expect(screen.getByText('Office hours must start before they end.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });

  it('allows a week with no work days', async () => {
    const calls = api();
    renderRoute('/settings');
    await screen.findByRole('checkbox', { name: 'Monday' });
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) await userEvent.click(screen.getByRole('checkbox', { name: day }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ workDays: [] }));
  });

  it('is reachable from the shell without joining the five-entry navigation', async () => {
    api();
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('navigation', { name: 'Primary' })).not.toHaveTextContent('Settings');
  });
});
