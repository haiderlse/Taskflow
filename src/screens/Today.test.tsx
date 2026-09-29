import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeBlock, makeDayView, makeMustShip, makeOutcome, makeWeekView } from '../test/fixtures';
import type { DayView } from '../shared/exec/todaySchemas';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Karachi is UTC+5: 2026-09-29T04:00:00Z is Tuesday 09:00 there. */
const at = (iso: string) => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(iso) });

function api(days: Record<string, DayView | (() => Response)>) {
  return stubFetch((url) => {
    if (url.endsWith('/settings')) return json(SETTINGS);
    const date = url.match(/\/days\/(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (date) {
      const answer = days[date] ?? makeDayView({ date });
      return typeof answer === 'function' ? answer() : json(answer);
    }
    return json([]);
  });
}

const outcome = makeOutcome({ title: 'Supplier plan confirmed' });
const planned = makeWeekView([outcome], { startDate: '2026-09-27' });

describe('Today, by the moment', () => {
  it('asks for today\'s Must Ship at 09:00 on a Tuesday, under the first-plan banner', async () => {
    at('2026-09-29T04:00:00Z');
    api({});
    renderRoute('/');
    expect(await screen.findByRole('region', { name: "Choose today's Must Ship" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plan your first week' })).toHaveAttribute('href', '/plan');
    expect(screen.getByText('Tuesday 29 September · Week 40')).toBeInTheDocument();
  });

  it('shows the Must Ship with Start deep work once it is set', async () => {
    at('2026-09-29T04:00:00Z');
    api({ '2026-09-29': makeDayView({ week: planned, hasHistory: true, mustShip: makeMustShip({ title: 'Delivery tracker sent', outcomeId: outcome.id }) }) });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Must Ship' });
    expect(card).toHaveTextContent('For: Supplier plan confirmed');
    expect(within(card).getByRole('link', { name: 'Start deep work' })).toHaveAttribute('href', '/focus');
    expect(screen.getByRole('link', { name: '0 of 1 outcomes done' })).toHaveAttribute('href', '/week');
    expect(screen.queryByRole('link', { name: /^Plan/ })).toBeNull();
  });

  it('is the Build card at 20:00, with Close the day', async () => {
    at('2026-09-29T15:00:00Z');
    api({ '2026-09-29': makeDayView({ week: planned, mustShip: makeMustShip() }) });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Build' });
    expect(card).toHaveTextContent('Nothing planned for Build');
    expect(card).toHaveTextContent('Build block 06:30 · 50 min');
    expect(screen.getByRole('link', { name: 'Close the day' })).toHaveAttribute('href', '/shutdown');
    expect(screen.queryByRole('region', { name: 'Must Ship' })).toBeNull();
  });

  it('shows tomorrow once the day is shut down', async () => {
    at('2026-09-29T12:30:00Z');
    const shutDown = { date: '2026-09-29', shutdownAt: '2026-09-29T12:10:00.000Z', notes: '', createdAt: '2026-09-29T12:10:00.000Z', updatedAt: '2026-09-29T12:10:00.000Z' };
    api({
      '2026-09-29': makeDayView({ week: planned, day: shutDown, mustShip: makeMustShip() }),
      '2026-09-30': makeDayView({ date: '2026-09-30', mustShip: makeMustShip({ title: 'Price list approved', date: '2026-09-30' }) }),
    });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Tomorrow' });
    expect(await within(card).findByText('Wednesday 30 September: Price list approved')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Close the day' })).toBeNull();
  });

  it('never reads the day before the schedule, and says so when the day fails, then retries', async () => {
    at('2026-09-29T04:00:00Z');
    let fail = true;
    const calls = api({ '2026-09-29': () => (fail ? failure(500, 'INTERNAL', 'internal server error') : json(makeDayView())) });
    renderRoute('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load today: internal server error');
    const settingsAt = calls.findIndex((c) => c.url.endsWith('/settings'));
    const dayAt = calls.findIndex((c) => c.url.includes('/days/'));
    expect(settingsAt).toBeLessThan(dayAt);
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: "Choose today's Must Ship" })).toBeInTheDocument();
  });

  it('reports a failed read of tomorrow instead of showing an empty day', async () => {
    at('2026-09-29T12:30:00Z');
    const shutDown = { date: '2026-09-29', shutdownAt: '2026-09-29T12:10:00.000Z', notes: '', createdAt: '2026-09-29T12:10:00.000Z', updatedAt: '2026-09-29T12:10:00.000Z' };
    api({
      '2026-09-29': makeDayView({ week: planned, day: shutDown, mustShip: makeMustShip() }),
      '2026-09-30': () => failure(500, 'INTERNAL', 'internal server error'),
    });
    renderRoute('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load tomorrow: internal server error');
    expect(screen.queryByText('No Must Ship for Wednesday 30 September yet')).toBeNull();
  });

  it('names the Must Ship on the resume card while a session is live', async () => {
    at('2026-09-29T04:00:00Z');
    const ship = makeMustShip({ title: 'Delivery tracker sent' });
    api({ '2026-09-29': makeDayView({ week: planned, mustShip: ship, blocks: [makeBlock({ mustShipId: ship.id, startedAt: '2026-09-29T03:40:00.000Z' })] }) });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Focus' });
    expect(card).toHaveTextContent('Delivery tracker sent');
    expect(within(card).getByRole('link', { name: 'Resume focus' })).toHaveAttribute('href', '/focus');
  });

  it('resumes a session that runs past office hours from the Build card', async () => {
    at('2026-09-29T13:30:00Z');
    api({ '2026-09-29': makeDayView({ week: planned, blocks: [makeBlock({ startedAt: '2026-09-29T12:50:00.000Z' })] }) });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Build' });
    expect(within(card).getByRole('link', { name: 'Resume focus' })).toHaveAttribute('href', '/focus');
  });
});
