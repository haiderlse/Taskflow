import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekDeepWork } from './WeekDeepWork';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json, failure } from '../../test/fetch';
import { SETTINGS, makeBlock, makeOutcome } from '../../test/fixtures';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';

afterEach(() => vi.unstubAllGlobals());

const office = makeOutcome({ title: 'Supplier plan confirmed', category: 'office', slot: 1 });
const business = makeOutcome({ title: 'Healify beta live', category: 'business', slot: 2 });

/** A tiny server: creating a block adds it to the list, patching one changes it. */
function server(initial: DeepWorkBlock[] = [], respond?: (url: string, init?: RequestInit) => Response | undefined) {
  const state = { blocks: initial };
  const calls = stubFetch((url, init) => {
    const custom = respond?.(url, init);
    if (custom) return custom;
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url.startsWith('/api/exec/deep-work?')) return json(state.blocks);
    if (url === '/api/exec/deep-work' && init?.method === 'POST') {
      const made = makeBlock(JSON.parse(String(init.body)));
      state.blocks = [...state.blocks, made];
      return json(made, 201);
    }
    const patch = url.match(/\/deep-work\/([^/]+)$/);
    if (patch && init?.method === 'PATCH') {
      state.blocks = state.blocks.map((block) => (block.id === patch[1] ? { ...block, ...JSON.parse(String(init.body)) } : block));
      return json(state.blocks.find((block) => block.id === patch[1]));
    }
    return json([]);
  });
  return calls;
}

const show = (flagMissing = false) =>
  renderWithProviders(<WeekDeepWork weekStartDate="2026-09-27" today="2026-09-29" outcomes={[office, business]} flagMissing={flagMissing} />);
const day = (name: string) => screen.findByRole('region', { name });

describe('WeekDeepWork', () => {
  it('lays the default blocks over the days from today on, as suggestions', async () => {
    server();
    show();
    const tuesday = await day('Tuesday 29 September');
    expect(within(tuesday).getByRole('button', { name: 'Tuesday 29 September 06:30, 50 minutes, no outcome, suggested' })).toBeInTheDocument();
    expect(within(tuesday).getByRole('button', { name: 'Tuesday 29 September 08:35, 90 minutes, no outcome, suggested' })).toBeInTheDocument();
    expect(within(await day('Monday 28 September')).getAllByRole('button')).toHaveLength(1);
    expect(within(await day('Sunday 27 September')).getAllByRole('button')).toHaveLength(1);
    expect(within(await day('Saturday 3 October')).getByRole('button', { name: /09:00, 180 minutes/ })).toBeInTheDocument();
  });

  it('saves a suggestion by assigning an outcome, and the saved block replaces it', async () => {
    const calls = server();
    show();
    const tuesday = await day('Tuesday 29 September');
    await userEvent.click(within(tuesday).getByRole('button', { name: /08:35, 90 minutes, no outcome, suggested/ }));
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Supplier plan confirmed');
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: office.id })
    );
    expect(await within(tuesday).findByRole('button', { name: 'Tuesday 29 September 08:35, 90 minutes, Supplier plan confirmed' })).toBeInTheDocument();
    expect(within(tuesday).queryByRole('button', { name: /08:35.*suggested/ })).toBeNull();
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Deep work block' })).toBeNull());
  });

  it('changes a saved block\'s outcome and length with a PATCH', async () => {
    const saved = makeBlock({ date: '2026-09-30' });
    const calls = server([saved]);
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Wednesday 30 September 08:35, 90 minutes, no outcome' }));
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Supplier plan confirmed');
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '60' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')).toMatchObject({ url: `/api/exec/deep-work/${saved.id}`, body: { plannedStart: '08:35', plannedMinutes: 60, outcomeId: office.id } }));
    expect(await screen.findByRole('button', { name: 'Wednesday 30 September 08:35, 60 minutes, Supplier plan confirmed' })).toBeInTheDocument();
  });

  it('adds an extra block on a day, choosing its context', async () => {
    const calls = server();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Add a block on Friday 2 October' }));
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Healify beta live');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '45' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ date: '2026-10-02', context: 'build', plannedStart: '14:00', plannedMinutes: 45, outcomeId: business.id })
    );
  });

  it('shows a finished block with its result and opens it read-only', async () => {
    const finished = makeBlock({ date: '2026-09-30', outcomeId: office.id, startedAt: '2026-09-30T03:35:00.000Z', endedAt: '2026-09-30T04:20:00.000Z', result: 'progress' });
    server([finished]);
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Wednesday 30 September 08:35, 90 minutes, Supplier plan confirmed, Made progress' }));
    expect(screen.getByText('Finished: Made progress')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save block' })).toBeNull();
  });

  it('says why a save failed and keeps the panel open', async () => {
    server([], (_url, init) => (init?.method === 'POST' ? failure(400, 'VALIDATION', 'that time overlaps another block') : undefined));
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Tuesday 29 September 08:35.*suggested/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    expect(await screen.findByText('Could not save the block: that time overlaps another block')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Deep work block' })).toBeInTheDocument();
  });

  it('waits for the blocks, and says so when the blocks or the schedule cannot be read', async () => {
    server();
    const { unmount } = show();
    expect(screen.getByText('Loading deep work…')).toBeInTheDocument();
    await day('Tuesday 29 September');
    unmount();
    vi.unstubAllGlobals();
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    const failed = show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load deep work: internal server error');
    failed.unmount();
    vi.unstubAllGlobals();
    stubFetch((url) => (url.endsWith('/settings') ? failure(500, 'INTERNAL', 'internal server error') : json([])));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the schedule: internal server error');
  });

  it('flags the outcomes that still have no block, and says when every one has time', async () => {
    server([makeBlock({ date: '2026-09-30', outcomeId: office.id })]);
    const { unmount } = show(true);
    expect(await screen.findByText('No time yet: Healify beta live')).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();
    server([makeBlock({ date: '2026-09-30', outcomeId: office.id }), makeBlock({ date: '2026-10-03', context: 'build', plannedStart: '09:00', outcomeId: business.id })]);
    show(true);
    expect(await screen.findByText('Every outcome has time.')).toBeInTheDocument();
  });

  it('shows no flags unless asked to', async () => {
    server();
    show(false);
    await day('Tuesday 29 September');
    expect(screen.queryByText(/No time yet/)).toBeNull();
  });
});
