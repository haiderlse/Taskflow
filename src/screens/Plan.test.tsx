import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, WEEK_ID, makeLookup, makeOutcome, makeScoreboard, makeWeekView } from '../test/fixtures';
import type { Outcome, WeekLookup } from '../shared/exec/schemas';

/** A stateful fake: POST /weeks creates the current week, adding and rolling append to it. */
function fakePlanApi(start: WeekLookup) {
  let lookup = start;
  const current = () => lookup.current ?? makeWeekView([]);
  const append = (outcome: Outcome) => {
    lookup = { ...lookup, current: makeWeekView([...current().outcomes, outcome]) };
    return json(outcome, 201);
  };
  const calls = stubFetch((url, init) => {
    const method = init?.method ?? 'GET';
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (method === 'GET' && url.startsWith('/api/exec/weeks?')) return json(lookup);
    if (method === 'POST' && url === '/api/exec/weeks') {
      lookup = { ...lookup, current: current() };
      return json(current(), 201);
    }
    if (url.endsWith('/scoreboard')) return json(makeScoreboard({ weekId: url.split('/').at(-2) ?? WEEK_ID, outcomes: { shipped: 1, total: 3 } }));
    const slot = current().outcomes.filter((o) => o.slot !== null).length + 1;
    if (url.endsWith('/outcomes')) return append(makeOutcome({ title: JSON.parse(String(init?.body)).title, slot }));
    if (url.endsWith('/roll')) return append(makeOutcome({ title: 'Carried', slot, rolledFromId: url.split('/').at(-2) ?? null }));
    return json([]);
  });
  return calls;
}

const addOutcome = async (title: string, definition: string, button: string) => {
  await userEvent.type(screen.getByLabelText('Outcome'), title);
  await userEvent.type(screen.getByLabelText('Definition of done'), definition);
  await userEvent.click(screen.getByRole('button', { name: button }));
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-22T04:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('/plan', () => {
  it('chooses three outcomes, requiring a definition of done, and ends on "Week 39 is planned."', async () => {
    const calls = fakePlanApi(makeLookup());
    renderRoute('/plan');
    expect(await screen.findByText('Week 39 · 20–26 Sep')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: "This week's outcomes" })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Last week' })).toBeNull();

    await userEvent.type(screen.getByLabelText('Outcome'), 'Work on supplier meetings');
    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add outcome 1' })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Outcome'));

    await addOutcome('Supplier plan confirmed', 'Dates for the top 20', 'Add outcome 1');
    await screen.findByRole('button', { name: 'Add outcome 2' });
    expect(within(screen.getByRole('list', { name: 'Chosen outcomes' })).getByText('Supplier plan confirmed')).toBeInTheDocument();
    await addOutcome('Haleon target signed off', 'Signed by the commercial head', 'Add outcome 2');
    await screen.findByRole('button', { name: 'Add outcome 3' });
    await addOutcome('Pinkbox P&L live', 'Live franchise data', 'Add outcome 3');

    expect(await screen.findByRole('heading', { level: 2, name: 'When will you actually work on these?' })).toBeInTheDocument();
    expect(await screen.findByText(/^No time yet: /)).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Done planning time' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 39 is planned.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the week' })).toHaveAttribute('href', '/week');
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/');
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
      '/api/exec/weeks',
      `/api/exec/weeks/${WEEK_ID}/outcomes`,
      `/api/exec/weeks/${WEEK_ID}/outcomes`,
      `/api/exec/weeks/${WEEK_ID}/outcomes`,
    ]);
  });

  it('offers last week\'s open outcomes first, carries one, then moves on', async () => {
    const open = makeOutcome({ title: 'Delivery tracker sent', weekId: '20000000-0000-4000-8000-000000000002', progress: 60 });
    const finished = makeOutcome({ title: 'Price list approved', weekId: '20000000-0000-4000-8000-000000000002', slot: 2, status: 'done', progress: 100 });
    const calls = fakePlanApi(makeLookup({ hasHistory: true, previous: makeWeekView([open, finished], { id: '20000000-0000-4000-8000-000000000002', startDate: '2026-09-13' }) }));
    renderRoute('/plan');
    expect(await screen.findByRole('heading', { level: 2, name: 'Last week' })).toBeInTheDocument();
    expect(screen.getByText(/Delivery tracker sent/)).toBeInTheDocument();
    expect(screen.queryByText(/Price list approved/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Carry "Delivery tracker sent" into this week' }));
    await waitFor(() => expect(calls.some((c) => c.url === `/api/exec/outcomes/${open.id}/roll`)).toBe(true));
    expect(calls.find((c) => c.url.endsWith('/roll'))?.body).toEqual({ weekId: WEEK_ID });
    expect(await screen.findByRole('heading', { level: 2, name: "This week's outcomes" })).toBeInTheDocument();
  });

  it('lets you stop at fewer than three', async () => {
    fakePlanApi(makeLookup({ current: makeWeekView([makeOutcome({ title: 'Only one' })]) }));
    renderRoute('/plan');
    await userEvent.click(await screen.findByRole('button', { name: 'Done choosing' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Done planning time' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 39 is planned.' })).toBeInTheDocument();
    expect(screen.getByRole('listitem')).toHaveTextContent('Only one');
  });

  it('offers the next work day\'s Must Ship once the week is planned', async () => {
    const calls = fakePlanApi(makeLookup({ current: makeWeekView([makeOutcome({ slot: 1 }), makeOutcome({ slot: 2 }), makeOutcome({ slot: 3 })]) }));
    renderRoute('/plan');
    await userEvent.click(await screen.findByRole('button', { name: 'Done planning time' }));
    const next = await screen.findByRole('region', { name: 'Next Must Ship' });
    expect(within(next).getByRole('heading', { name: 'Must Ship for Wednesday 23 September' })).toBeInTheDocument();
    await userEvent.type(await within(next).findByLabelText('Must Ship'), 'Price list approved');
    await userEvent.click(within(next).getByRole('button', { name: 'Set Must Ship' }));
    await waitFor(() => expect(calls.find((c) => c.url === '/api/exec/must-ships' && c.method === 'POST')?.body).toMatchObject({ title: 'Price list approved', date: '2026-09-23', context: 'work' }));
  });

  it('says so when the next work day cannot be read', async () => {
    const planned = makeLookup({ current: makeWeekView([makeOutcome({ slot: 1 }), makeOutcome({ slot: 2 }), makeOutcome({ slot: 3 })]) });
    stubFetch((url) => {
      if (url.endsWith('/settings')) return json(SETTINGS);
      if (url.startsWith('/api/exec/weeks?')) return json(planned);
      if (url.includes('/days/2026-09-23')) return failure(500, 'INTERNAL', 'internal server error');
      return json([]);
    });
    renderRoute('/plan');
    await userEvent.click(await screen.findByRole('button', { name: 'Done planning time' }));
    const next = await screen.findByRole('region', { name: 'Next Must Ship' });
    expect(await within(next).findByRole('alert')).toHaveTextContent('Could not load that day: internal server error');
  });

  it('says so when the week cannot be read', async () => {
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    renderRoute('/plan');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the week: internal server error');
  });

  it('says so when the schedule cannot be read instead of loading forever', async () => {
    stubFetch(() => failure(500, 'INTERNAL', 'internal server error'));
    renderRoute('/plan');
    expect(await screen.findByText('Could not load the schedule: internal server error')).toBeInTheDocument();
    expect(screen.queryByText('Loading the week…')).toBeNull();
  });

  it('lands on the time step when three outcomes are already chosen, and finishes from there', async () => {
    fakePlanApi(makeLookup({ current: makeWeekView([makeOutcome({ title: 'A', slot: 1 }), makeOutcome({ title: 'B', slot: 2 }), makeOutcome({ title: 'C', slot: 3 })]) }));
    renderRoute('/plan');
    expect(await screen.findByRole('heading', { level: 2, name: 'When will you actually work on these?' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /is planned\./ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Done planning time' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 39 is planned.' })).toBeInTheDocument();
  });

  it('shows the grid with the default blocks from today on', async () => {
    fakePlanApi(makeLookup({ current: makeWeekView([makeOutcome({ title: 'A', slot: 1 }), makeOutcome({ title: 'B', slot: 2 }), makeOutcome({ title: 'C', slot: 3 })]) }));
    renderRoute('/plan');
    const tuesday = await screen.findByRole('region', { name: 'Tuesday 22 September' });
    expect(within(tuesday).getByRole('button', { name: /08:35, 90 minutes, no outcome, suggested/ })).toBeInTheDocument();
    expect(within(await screen.findByRole('region', { name: 'Monday 21 September' })).getAllByRole('button')).toHaveLength(1);
  });

  it("shows last week's numbers, and after a Friday review offers only what it rolled forward", async () => {
    const PREVIOUS = '20000000-0000-4000-8000-000000000002';
    const rolled = makeOutcome({ title: 'Delivery tracker sent', weekId: PREVIOUS, reviewGrade: 'partial', reviewDisposition: 'roll_forward' });
    const killed = makeOutcome({ title: 'Price list approved', weekId: PREVIOUS, slot: null, status: 'killed', reviewGrade: 'missed', reviewDisposition: 'kill' });
    const rescheduled = makeOutcome({ title: 'Venue booked', weekId: PREVIOUS, slot: 2, reviewGrade: 'missed', reviewDisposition: 'reschedule' });
    const previous = makeWeekView([rolled, killed, rescheduled], { id: PREVIOUS, startDate: '2026-09-13', reviewedAt: '2026-09-18T11:00:00.000Z' });
    fakePlanApi(makeLookup({ hasHistory: true, previous }));
    renderRoute('/plan');
    expect(await screen.findByRole('heading', { level: 2, name: 'Last week' })).toBeInTheDocument();
    expect(await screen.findByText('Last week: 1 of 3 outcomes · 0 of 0 Must Ships · 0 min deep work')).toBeInTheDocument();
    expect(screen.getByText("Friday's review rolled these forward. Carry the ones that still matter.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carry "Delivery tracker sent" into this week' })).toBeInTheDocument();
    expect(screen.queryByText(/Price list approved/)).toBeNull();
    expect(screen.queryByText(/Venue booked/)).toBeNull();
  });

  it("says so when last week's numbers cannot be read, and still offers the carry", async () => {
    const PREVIOUS = '20000000-0000-4000-8000-000000000002';
    const open = makeOutcome({ title: 'Delivery tracker sent', weekId: PREVIOUS });
    const lookup = makeLookup({ hasHistory: true, previous: makeWeekView([open], { id: PREVIOUS, startDate: '2026-09-13' }) });
    stubFetch((url) => {
      if (url.endsWith('/settings')) return json(SETTINGS);
      if (url.startsWith('/api/exec/weeks?')) return json(lookup);
      if (url.endsWith('/scoreboard')) return failure(500, 'INTERNAL', 'internal server error');
      return json([]);
    });
    renderRoute('/plan');
    expect(await screen.findByRole('alert')).toHaveTextContent("Could not load last week's numbers: internal server error");
    expect(screen.getByRole('button', { name: 'Carry "Delivery tracker sent" into this week' })).toBeInTheDocument();
  });
});
