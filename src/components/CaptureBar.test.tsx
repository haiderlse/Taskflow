import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaptureBar } from './CaptureBar';
import { renderWithProviders } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeTask } from '../test/fixtures';

const settingsOr = (respond: (init?: RequestInit) => Response) => (url: string, init?: RequestInit) =>
  url.endsWith('/settings') ? json(SETTINGS) : respond(init);

beforeEach(() => {
  // 19:00 in Karachi on a Tuesday: outside office hours, so the clock says "build".
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-22T14:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CaptureBar', () => {
  it('posts the trimmed title with the context the clock suggests, clears, and toasts', async () => {
    const calls = stubFetch(settingsOr(() => json(makeTask(), 201)));
    renderWithProviders(<CaptureBar />);
    const input = screen.getByRole('textbox', { name: 'Capture' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.type(input, '  Call the supplier  {enter}');
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeDefined());
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/tasks', body: { title: 'Call the supplier', context: 'build' } });
    await waitFor(() => expect(input).toHaveValue(''));
    expect(await screen.findByRole('status')).toHaveTextContent('Captured. It is in the Inbox, not on Today.');
  });

  it('lets the toggle override the clock', async () => {
    const calls = stubFetch(settingsOr(() => json(makeTask(), 201)));
    renderWithProviders(<CaptureBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Work' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Capture' }), 'Approve pricing{enter}');
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Approve pricing', context: 'work' }));
  });

  it('does not submit a blank title and reports a server failure', async () => {
    const calls = stubFetch(settingsOr(() => failure(500, 'INTERNAL', 'internal server error')));
    renderWithProviders(<CaptureBar />);
    const input = screen.getByRole('textbox', { name: 'Capture' });
    expect(screen.getByRole('button', { name: 'Capture' })).toBeDisabled();
    await userEvent.type(input, '   {enter}');
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    await userEvent.clear(input);
    await userEvent.type(input, 'x{enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not capture: internal server error');
    expect(input).toHaveValue('x');
  });
});
