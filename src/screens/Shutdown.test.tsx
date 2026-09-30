import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeDayView, makeMustShip, makeTask } from '../test/fixtures';
import type { DayView, MustShip } from '../shared/exec/todaySchemas';
import type { Task } from '../shared/exec/schemas';

const TODAY = '2026-09-29';
const NEXT = '2026-09-30';
const CLOSED = '2026-09-29T12:40:00.000Z';
const ship = makeMustShip({ title: 'Delivery tracker sent', date: TODAY });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Tuesday 29 September, 17:30 in Karachi. */
const at530pm = () => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T12:30:00Z') });
const closedDay = { date: TODAY, shutdownAt: CLOSED, notes: '', createdAt: CLOSED, updatedAt: CLOSED };

type World = { today: DayView; tomorrow: DayView; tasks: Task[] };

/** A stateful fake of the routes Shutdown reads and writes. */
function fakeShutdownApi(start: Partial<World> = {}) {
  const world: World = { today: makeDayView({ date: TODAY }), tomorrow: makeDayView({ date: NEXT }), tasks: [], ...start };
  return stubFetch((url, init) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const current = world.today.mustShip as MustShip;
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url === `/api/exec/days/${TODAY}`) return json(world.today);
    if (url === `/api/exec/days/${NEXT}`) return json(world.tomorrow);
    if (url.startsWith('/api/exec/tasks?')) return json(world.tasks);
    if (method === 'POST' && url.startsWith('/api/exec/tasks/')) {
      world.tasks = world.tasks.map((task) => (url.includes(task.id) ? { ...task, scheduledDate: body.date } : task));
      return json({});
    }
    if (method === 'POST' && url.endsWith('/roll')) {
      const rolled = { ...current, id: '40000000-0000-4000-8000-000000000777', date: NEXT, rolledFromId: current.id, rollCount: 1 };
      world.tomorrow = { ...world.tomorrow, mustShip: rolled };
      return json(rolled, 201);
    }
    if (method === 'PATCH' && url.includes('/must-ships/')) {
      world.today = { ...world.today, mustShip: { ...current, ...body } };
      return json(world.today.mustShip);
    }
    if (method === 'POST' && url.endsWith('/shutdown')) {
      world.today = { ...world.today, day: closedDay };
      return json(world.today);
    }
    return json([]);
  });
}

const clickWhenEnabled = async (name: string) => {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
};

describe('/shutdown', () => {
  it('walks the four steps and ends on "Tomorrow is ready"', async () => {
    at530pm();
    const memo = makeTask({ title: 'Pricing memo', status: 'this_week', scheduledDate: TODAY });
    const calls = fakeShutdownApi({ today: makeDayView({ date: TODAY, mustShip: ship }), tasks: [memo] });
    renderRoute('/shutdown');
    expect(await screen.findByText('Tuesday 29 September')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Partial' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const open = await screen.findByRole('region', { name: 'What remains open?' });
    expect(screen.getByText('Today: Delivery tracker sent · Partial')).toBeInTheDocument();
    await userEvent.click(await within(open).findByRole('button', { name: 'Move "Pricing memo" to tomorrow' }));
    await clickWhenEnabled("Next: tomorrow's Must Ship");

    const next = await screen.findByRole('region', { name: "Tomorrow's Must Ship" });
    expect(within(next).getByText('Delivery tracker sent')).toBeInTheDocument();
    expect(within(next).getByText('Rolled forward once')).toBeInTheDocument();
    await userEvent.click(within(next).getByRole('button', { name: 'Continue' }));
    await clickWhenEnabled('Close the day');

    expect(await screen.findByRole('heading', { level: 2, name: 'Tomorrow is ready' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday 30 September: Delivery tracker sent')).toBeInTheDocument();
    expect(calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST /api/exec/must-ships/${ship.id}/roll`,
      `PATCH /api/exec/must-ships/${ship.id}`,
      `POST /api/exec/tasks/${memo.id}/roll`,
      `POST /api/exec/days/${TODAY}/shutdown`,
    ]);
  });

  it("lands on step 2 when today's Must Ship is already graded, and step 3 asks for tomorrow's", async () => {
    at530pm();
    fakeShutdownApi({ today: makeDayView({ date: TODAY, mustShip: { ...ship, status: 'shipped' } }) });
    renderRoute('/shutdown');
    const open = await screen.findByRole('region', { name: 'What remains open?' });
    expect(await within(open).findByText('Nothing left open today.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What shipped today?' })).toBeNull();
    await clickWhenEnabled("Next: tomorrow's Must Ship");
    const next = await screen.findByRole('region', { name: "Tomorrow's Must Ship" });
    expect(within(next).getByRole('heading', { name: 'Must Ship for Wednesday 30 September' })).toBeInTheDocument();
    expect(within(next).getByRole('button', { name: 'Set Must Ship' })).toBeInTheDocument();
    expect(within(next).queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('keeps closing the day it was opened on after local midnight passes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T18:59:00Z') });
    const graded = { ...ship, status: 'shipped' as const };
    const calls = fakeShutdownApi({
      today: makeDayView({ date: TODAY, mustShip: graded }),
      tomorrow: makeDayView({ date: NEXT, mustShip: makeMustShip({ title: 'Price list sent', date: NEXT }) }),
    });
    renderRoute('/shutdown');
    expect(await screen.findByText('Tuesday 29 September')).toBeInTheDocument();
    await clickWhenEnabled("Next: tomorrow's Must Ship");
    act(() => { vi.advanceTimersByTime(3 * 60_000); });
    expect(screen.getByText('Tuesday 29 September')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await clickWhenEnabled('Close the day');
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([`/api/exec/days/${TODAY}/shutdown`]));
    expect(calls.some((c) => c.url.includes('2026-10-01'))).toBe(false);
  });

  it('shows "Tomorrow is ready" when the day is already closed', async () => {
    at530pm();
    fakeShutdownApi({
      today: makeDayView({ date: TODAY, day: closedDay }),
      tomorrow: makeDayView({
        date: NEXT,
        mustShip: makeMustShip({ title: 'Price list sent', date: NEXT }),
        secondaries: [{ slot: 1, task: makeTask({ title: 'Book the venue' }) }],
      }),
    });
    renderRoute('/shutdown');
    expect(await screen.findByRole('heading', { level: 2, name: 'Tomorrow is ready' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday 30 September: Price list sent')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: "Tomorrow's secondaries" })).getByText('Book the venue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/');
  });

  it('says so when the server refuses to close the day', async () => {
    at530pm();
    stubFetch((url) => {
      if (url.endsWith('/settings')) return json(SETTINGS);
      if (url === `/api/exec/days/${TODAY}`) return json(makeDayView({ date: TODAY }));
      if (url === `/api/exec/days/${NEXT}`) return json(makeDayView({ date: NEXT, mustShip: makeMustShip({ title: 'Price list sent', date: NEXT }) }));
      if (url.endsWith('/shutdown')) return failure(409, 'SHUTDOWN_NOT_READY', "grade today's Must Ship before closing the day");
      return json([]);
    });
    renderRoute('/shutdown');
    await clickWhenEnabled("Next: tomorrow's Must Ship");
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await clickWhenEnabled('Close the day');
    expect(await screen.findByText("Could not close the day: grade today's Must Ship first")).toBeInTheDocument();
  });

  it('says so when today cannot be read', async () => {
    at530pm();
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : url.includes('/days/') ? failure(500, 'INTERNAL', 'internal server error') : json([])));
    renderRoute('/shutdown');
    expect(await screen.findByText('Could not load today: internal server error')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What shipped today?' })).toBeNull();
  });

  it('says so when the schedule cannot be read, instead of loading forever', async () => {
    at530pm();
    stubFetch((url) => (url.endsWith('/settings') ? failure(500, 'INTERNAL', 'internal server error') : json([])));
    renderRoute('/shutdown');
    expect(await screen.findByText('Could not load the schedule: internal server error')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });
});
