import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeDayView, makeMustShip } from '../test/fixtures';
import type { DayView } from '../shared/exec/todaySchemas';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Serves `day` for 09:00 on a Tuesday in Karachi, and resolves once the day has been read and rendered. */
async function opened(day: DayView) {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T04:00:00Z') });
  const calls = stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : url === '/api/exec/days/2026-09-29' ? json(day) : json([])));
  const view = renderRoute('/inbox');
  await screen.findByRole('heading', { level: 1, name: 'Inbox' });
  await vi.waitFor(() => expect(calls.some((call) => call.url === '/api/exec/days/2026-09-29')).toBe(true));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
  return view;
}

const pressF = (target: Element = document.body) => fireEvent.keyDown(target, { key: 'f' });

describe('the f key', () => {
  it('opens focus from any screen when today has a Must Ship', async () => {
    await opened(makeDayView({ mustShip: makeMustShip() }));
    pressF();
    expect(await screen.findByRole('heading', { level: 1, name: 'Focus' })).toBeInTheDocument();
  });

  it('opens focus for a build Must Ship too, and does nothing without one', async () => {
    const { unmount } = await opened(makeDayView({ buildMustShip: makeMustShip({ context: 'build' }) }));
    pressF();
    expect(await screen.findByRole('heading', { level: 1, name: 'Focus' })).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();
    await opened(makeDayView());
    pressF();
    expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument();
  });

  it('ignores an f typed into a field, and still answers one pressed elsewhere', async () => {
    await opened(makeDayView({ mustShip: makeMustShip() }));
    const field = document.createElement('input');
    document.body.appendChild(field);
    pressF(field);
    expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument();
    field.remove();
    pressF();
    expect(await screen.findByRole('heading', { level: 1, name: 'Focus' })).toBeInTheDocument();
  });
});
