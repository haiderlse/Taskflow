import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { OpenItems } from './OpenItems';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json, failure, type FetchCall } from '../../test/fetch';
import { makeDayView, makeTask } from '../../test/fixtures';
import type { DayView } from '../../shared/exec/todaySchemas';
import type { Task } from '../../shared/exec/schemas';

afterEach(() => vi.unstubAllGlobals());

const TODAY = '2026-09-29';
const NEXT = '2026-09-30';
const memo = makeTask({ title: 'Pricing memo', status: 'this_week', scheduledDate: TODAY });
const call = makeTask({ title: 'Call the bank', status: 'this_week', scheduledDate: TODAY });
const quote = makeTask({ title: 'Venue quote', status: 'waiting', ownerName: 'Sana', followUpDate: TODAY });

function render(view: DayView, onNext = vi.fn()) {
  renderWithProviders(
    <MemoryRouter>
      <OpenItems today={TODAY} next={NEXT} weekStartDay={0} view={view} onNext={onNext} />
    </MemoryRouter>
  );
  return onNext;
}
/** The last write: a write refreshes the task list, so the last call of all is often a read. */
const lastWrite = (calls: FetchCall[]) => calls.filter((c) => c.method !== 'GET').at(-1);
const api = (scheduled: Task[]) => stubFetch((url) => (url === `/api/exec/tasks?week=${TODAY}` ? json(scheduled) : json({})));

describe('OpenItems', () => {
  it('lists the open secondaries, the tasks scheduled today and the waiting items, and holds Next', async () => {
    api([memo, call]);
    render(makeDayView({ secondaries: [{ slot: 1, task: memo }], waiting: [quote], inboxCount: 3 }));
    const open = await screen.findByRole('list', { name: 'Open tasks' });
    expect(within(open).getAllByRole('listitem').map((item) => item.firstChild?.textContent)).toEqual(['Pricing memo', 'Call the bank']);
    expect(within(screen.getByRole('list', { name: 'Waiting on others' })).getByText('Venue quote — Sana')).toBeInTheDocument();
    expect(screen.getByText('3 still open.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Next: tomorrow's Must Ship" })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Process now' })).toHaveAttribute('href', '/inbox');
    expect(screen.getByText(/^3 captured items/)).toBeInTheDocument();
  });

  it('moves, parks and kills rows with one click each', async () => {
    const calls = api([memo, call]);
    render(makeDayView({ waiting: [quote] }));
    await userEvent.click(await screen.findByRole('button', { name: 'Move "Pricing memo" to tomorrow' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'POST', url: `/api/exec/tasks/${memo.id}/roll`, body: { date: NEXT } }));
    await userEvent.click(screen.getByRole('button', { name: 'Park "Call the bank" for later' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', url: `/api/exec/tasks/${call.id}`, body: { status: 'later', scheduledDate: null } }));
    await userEvent.click(screen.getByRole('button', { name: 'Kill "Call the bank"' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', body: { status: 'killed' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Follow up on "Venue quote" tomorrow' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', url: `/api/exec/tasks/${quote.id}`, body: { followUpDate: NEXT } }));
    await userEvent.click(screen.getByRole('button', { name: 'Received "Venue quote"' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', body: { status: 'done' } }));
  });

  it('schedules and delegates through their panels', async () => {
    const calls = api([memo]);
    render(makeDayView());
    await userEvent.click(await screen.findByRole('button', { name: 'Schedule "Pricing memo"' }));
    const schedule = screen.getByRole('form', { name: 'Schedule Pricing memo' });
    await userEvent.clear(within(schedule).getByLabelText('On'));
    await userEvent.type(within(schedule).getByLabelText('On'), '2026-10-07');
    await userEvent.click(within(schedule).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', body: { status: 'later', scheduledDate: '2026-10-07' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Delegate "Pricing memo"' }));
    const delegate = screen.getByRole('form', { name: 'Delegate Pricing memo' });
    await userEvent.type(within(delegate).getByLabelText('Owner'), 'Bilal');
    await userEvent.click(within(delegate).getByRole('button', { name: 'Delegate' }));
    await waitFor(() =>
      expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', body: { status: 'delegated', ownerName: 'Bilal', expectedOutput: null, followUpDate: NEXT } })
    );
  });

  it('moves on once nothing is open', async () => {
    api([makeTask({ status: 'this_week', scheduledDate: NEXT })]);
    const onNext = render(makeDayView());
    expect(await screen.findByText('Nothing left open today.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Process now' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: "Next: tomorrow's Must Ship" }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("says so when today's tasks cannot be read, and holds Next", async () => {
    stubFetch(() => failure(500, 'INTERNAL', 'internal server error'));
    render(makeDayView());
    expect(await screen.findByRole('alert')).toHaveTextContent("Could not load today's tasks: internal server error");
    expect(screen.getByRole('button', { name: "Next: tomorrow's Must Ship" })).toBeDisabled();
  });
});
