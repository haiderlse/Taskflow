import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeBlock, makeDayView, makeMustShip } from '../test/fixtures';
import type { DayView } from '../shared/exec/todaySchemas';

const DATE = '2026-09-29';
const ship = makeMustShip({ title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20', notes: 'Use the March template' });
const BLOCKER = { what: 'Supplier has not replied', owner: 'Bilal', nextAction: 'Call Bilal about the tracker' };

/** 09:00 on a Tuesday in Karachi. */
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T04:00:00Z') }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const live = (overrides = {}) => makeBlock({ mustShipId: ship.id, startedAt: '2026-09-29T03:40:00.000Z', ...overrides });
const seconds = (text: string | null) => {
  const [minutes, rest] = (text ?? '').replace('+', '').split(':').map(Number);
  return minutes * 60 + rest;
};
const timer = () => screen.getByRole('timer', { name: 'Time remaining' });

function server(day: DayView, respond?: (url: string, init?: RequestInit) => Response | undefined) {
  return stubFetch((url, init) => respond?.(url, init) ?? (url.endsWith('/settings') ? json(SETTINGS) : url === `/api/exec/days/${DATE}` ? json(day) : json([])));
}

describe('/focus', () => {
  it('shows the Must Ship, its definition and notes, and a countdown from the server timestamps that keeps moving', async () => {
    server(makeDayView({ mustShip: ship, blocks: [live()] }));
    renderRoute('/focus');
    expect(await screen.findByRole('heading', { level: 2, name: 'Delivery tracker sent' })).toBeInTheDocument();
    expect(screen.getByText('Sent to all 20')).toBeInTheDocument();
    expect(screen.getByText('Use the March template')).toBeInTheDocument();
    expect(timer()).toHaveTextContent(/^(70:00|69:5\d)$/);
    const before = seconds(timer().textContent);
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(seconds(timer().textContent)).toBeLessThanOrEqual(before - 60);
  });

  it('stays frozen while paused, offers Resume, and counts up quietly past the plan', async () => {
    server(makeDayView({ mustShip: ship, blocks: [live({ pauseStartedAt: '2026-09-29T03:50:00.000Z' })] }));
    renderRoute('/focus');
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(timer()).toHaveTextContent('80:00');
    expect(screen.getByText('Paused')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(300_000);
    });
    expect(timer()).toHaveTextContent('80:00');
  });

  it('counts up past zero with a plus, without an alarm', async () => {
    server(makeDayView({ mustShip: ship, blocks: [live({ startedAt: '2026-09-29T02:20:00.000Z' })] }));
    renderRoute('/focus');
    await screen.findByRole('timer', { name: 'Time remaining' });
    expect(timer().textContent?.startsWith('+')).toBe(true);
  });

  it('pauses and resumes through the API', async () => {
    const block = live();
    const calls = server(makeDayView({ mustShip: ship, blocks: [block] }), (_url, init) => (init?.method === 'POST' ? json(block) : undefined));
    renderRoute('/focus');
    await userEvent.click(await screen.findByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')).toMatchObject({ url: `/api/exec/deep-work/${block.id}/pause` }));
  });

  it('ends on Today after Completed and after Made progress', async () => {
    const block = live();
    for (const [name, result] of [['Completed', 'completed'], ['Made progress', 'progress']] as const) {
      const calls = server(makeDayView({ mustShip: ship, blocks: [block] }), (_url, init) =>
        init?.method === 'POST' ? json({ block, mustShip: null, task: null }) : undefined
      );
      const { unmount } = renderRoute('/focus');
      await userEvent.click(await screen.findByRole('button', { name }));
      await waitFor(() => expect(calls.find((call) => call.method === 'POST')).toMatchObject({ url: `/api/exec/deep-work/${block.id}/finish`, body: { result } }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
      unmount();
      vi.unstubAllGlobals();
    }
  });

  it('asks the three blocker questions inline, needs every answer, files them and ends on Today', async () => {
    const block = live();
    const calls = server(makeDayView({ mustShip: ship, blocks: [block] }), (_url, init) => (init?.method === 'POST' ? json({ block, mustShip: null, task: null }) : undefined));
    renderRoute('/focus');
    await userEvent.click(await screen.findByRole('button', { name: 'Blocked' }));
    const form = screen.getByRole('form', { name: 'Blocked' });
    const file = screen.getByRole('button', { name: 'File the next action and stop' });
    expect(file).toBeDisabled();
    await userEvent.type(screen.getByLabelText('What blocks it?'), BLOCKER.what);
    await userEvent.type(screen.getByLabelText('Who owns the unblock?'), '   ');
    await userEvent.type(screen.getByLabelText('What is the next action?'), BLOCKER.nextAction);
    expect(file).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Who owns the unblock?'));
    await userEvent.type(screen.getByLabelText('Who owns the unblock?'), BLOCKER.owner);
    expect(form).toBeInTheDocument();
    await userEvent.click(file);
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ result: 'blocked', blocker: BLOCKER }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  });

  it('keeps the session live and says why when finishing fails', async () => {
    const block = live();
    server(makeDayView({ mustShip: ship, blocks: [block] }), (_url, init) => (init?.method === 'POST' ? failure(500, 'INTERNAL', 'internal server error') : undefined));
    renderRoute('/focus');
    await userEvent.click(await screen.findByRole('button', { name: 'Completed' }));
    expect(await screen.findByText('Could not finish the session: internal server error')).toBeInTheDocument();
    expect(timer()).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Today' })).toBeNull();
  });

  it('says so, with a way back, when there is nothing to focus on or the Must Ship is closed', async () => {
    server(makeDayView());
    const { unmount } = renderRoute('/focus');
    expect(await screen.findByText('Nothing to focus on.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/');
    unmount();
    vi.unstubAllGlobals();
    server(makeDayView({ mustShip: makeMustShip({ title: 'Delivery tracker sent', status: 'shipped' }) }));
    renderRoute('/focus');
    expect(await screen.findByText('Delivery tracker sent is shipped. Nothing left to focus on.')).toBeInTheDocument();
  });

  it('shows a failed start with a retry, and a failed read with the standard error', async () => {
    let creates = 0;
    const calls = server(makeDayView({ mustShip: ship }), (url, init) => {
      if (url === '/api/exec/deep-work' && init?.method === 'POST') {
        creates += 1;
        return failure(500, 'INTERNAL', 'internal server error');
      }
      return undefined;
    });
    const { unmount } = renderRoute('/focus');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not start the session: internal server error');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(creates).toBe(2));
    expect(calls.filter((call) => call.method === 'POST' && call.url.endsWith('/start'))).toEqual([]);
    unmount();
    vi.unstubAllGlobals();
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    renderRoute('/focus');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load today: internal server error');
  });
});
