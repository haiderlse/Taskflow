import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, WEEK_ID, makeLookup, makeOutcome, makeTask, makeWeekView } from '../test/fixtures';
import type { WeekLookup } from '../shared/exec/schemas';

const weekFull = (outcomes: unknown) =>
  new Response(JSON.stringify({ success: false, error: 'the week already has three outcomes', code: 'WEEK_FULL', details: { outcomes } }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

function api(lookup: WeekLookup, onWrite: (url: string, init?: RequestInit) => Response = () => json(makeOutcome(), 201)) {
  return stubFetch((url, init) => {
    if (init?.method && init.method !== 'GET') return onWrite(url, init);
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url.startsWith('/api/exec/weeks?')) return json(lookup);
    if (url.includes('week=')) return json([makeTask({ title: 'Call supplier', status: 'this_week' })]);
    if (url.includes('status=delegated')) return json([makeTask({ title: 'Send tracker', status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-23' })]);
    return json([]);
  });
}

const three = () => [makeOutcome({ title: 'A', slot: 1 }), makeOutcome({ title: 'B', slot: 2 }), makeOutcome({ title: 'C', slot: 3 })];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-22T04:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('/week', () => {
  it('shows the week number, range, three outcome cards, tasks and waiting', async () => {
    api(makeLookup({ current: makeWeekView(three()) }));
    renderRoute('/week');
    expect(await screen.findByText('Week 39 · 20–26 Sep')).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'A' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: "This week's tasks" })).getByText('Call supplier')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Waiting on others' })).getByText(/Send tracker — Bilal/)).toBeInTheDocument();
  });

  it('does not look up the week until the settings have loaded', async () => {
    let release: (response: Response) => void = () => undefined;
    const settings = new Promise<Response>((resolve) => { release = resolve; });
    const calls = stubFetch((url) => {
      if (url.endsWith('/settings')) return settings;
      if (url.startsWith('/api/exec/weeks?')) return json(makeLookup({ current: makeWeekView(three()) }));
      return json([]);
    });
    renderRoute('/week');
    expect(screen.getByRole('heading', { name: 'Week' })).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/settings'))).toBe(true));
    expect(calls.some((c) => c.url.startsWith('/api/exec/weeks?'))).toBe(false);
    release(json(SETTINGS));
    await waitFor(() => expect(calls.filter((c) => c.url.startsWith('/api/exec/weeks?'))).toHaveLength(1));
    expect(calls.find((c) => c.url.startsWith('/api/exec/weeks?'))?.url).toBe('/api/exec/weeks?date=2026-09-22');
  });

  it('offers to plan an empty week and creates the week on the first add', async () => {
    const calls = api(makeLookup(), (url) => (url === '/api/exec/weeks' ? json(makeWeekView(), 201) : json(makeOutcome(), 201)));
    renderRoute('/week');
    expect(await screen.findByRole('link', { name: 'Plan this week' })).toHaveAttribute('href', '/plan');
    expect(screen.getAllByText(/is open\./)).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Add an outcome' }));
    await userEvent.type(screen.getByLabelText('Outcome'), 'Supplier plan confirmed');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual(['/api/exec/weeks', `/api/exec/weeks/${WEEK_ID}/outcomes`]));
    expect(calls.find((c) => c.url === '/api/exec/weeks')?.body).toEqual({ date: '2026-09-22' });
  });

  it('turns Add into Replace when the week is full and sends the replace with the new outcome', async () => {
    const outcomes = three();
    const calls = api(makeLookup({ current: makeWeekView(outcomes) }));
    renderRoute('/week');
    await userEvent.click(await screen.findByRole('button', { name: 'Replace an outcome' }));
    await userEvent.type(screen.getByLabelText('Outcome'), 'Supplier risks identified');
    await userEvent.click(screen.getByRole('button', { name: 'Choose what it replaces' }));
    await userEvent.click(within(screen.getByRole('form', { name: 'Replace an outcome' })).getByRole('radio', { name: 'B' }));
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeDefined());
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({
      url: `/api/exec/weeks/${WEEK_ID}/outcomes`,
      body: expect.objectContaining({ title: 'Supplier risks identified', replace: { outcomeId: outcomes[1].id, reason: 'priority_changed' } }),
    });
  });

  it('lists only active outcomes in the replace picker when one is done', async () => {
    const outcomes = three();
    outcomes[1] = makeOutcome({ title: 'B', slot: 2, status: 'done', progress: 100 });
    api(makeLookup({ current: makeWeekView(outcomes) }));
    renderRoute('/week');
    await userEvent.click(await screen.findByRole('button', { name: 'Replace an outcome' }));
    await userEvent.type(screen.getByLabelText('Outcome'), 'D');
    await userEvent.click(screen.getByRole('button', { name: 'Choose what it replaces' }));
    const picker = screen.getByRole('form', { name: 'Replace an outcome' });
    expect(within(picker).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['A', 'C']);
  });

  it('offers only active outcomes when the server refuses a fourth', async () => {
    const outcomes = three();
    outcomes[0] = makeOutcome({ title: 'A', slot: 1, status: 'done', progress: 100 });
    api(makeLookup({ current: makeWeekView(outcomes.slice(0, 2)) }), () => weekFull(outcomes));
    renderRoute('/week');
    await userEvent.click(await screen.findByRole('button', { name: 'Add an outcome' }));
    await userEvent.type(screen.getByLabelText('Outcome'), 'D');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    const picker = await screen.findByRole('form', { name: 'Replace an outcome' });
    expect(within(picker).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['B', 'C']);
  });

  it('says all three are done instead of offering a replace', async () => {
    const outcomes = three().map((o) => ({ ...o, status: 'done' as const, progress: 100 }));
    api(makeLookup({ current: makeWeekView(outcomes) }));
    renderRoute('/week');
    expect(await screen.findByText('All three outcomes are done.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace an outcome' })).not.toBeInTheDocument();
  });

  it('shows the replace prompt when the server refuses a fourth the screen did not know about', async () => {
    const outcomes = three();
    api(makeLookup({ current: makeWeekView(outcomes.slice(0, 2)) }), () => weekFull(outcomes));
    renderRoute('/week');
    await userEvent.click(await screen.findByRole('button', { name: 'Add an outcome' }));
    await userEvent.type(screen.getByLabelText('Outcome'), 'D');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    const picker = await screen.findByRole('form', { name: 'Replace an outcome' });
    expect(within(picker).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['A', 'B', 'C']);
  });

  it('saves progress from a card', async () => {
    const outcomes = three();
    const calls = api(makeLookup({ current: makeWeekView(outcomes) }), () => json(outcomes[0]));
    renderRoute('/week');
    const slider = await screen.findByLabelText('Progress for A');
    fireEvent.change(slider, { target: { value: '60' } });
    fireEvent.blur(slider);
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: `/api/exec/outcomes/${outcomes[0].id}`, body: { progress: 60 } }));
  });
});
