import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FridayReview } from './FridayReview';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json, failure, type FetchCall } from '../../test/fetch';
import { WEEK_ID, makeOutcome, makeWeekView } from '../../test/fixtures';
import type { Outcome, WeekView } from '../../shared/exec/schemas';

afterEach(() => vi.unstubAllGlobals());

const TODAY = '2026-10-02';
const supplier = makeOutcome({ title: 'Supplier plan confirmed', slot: 1 });
const haleon = makeOutcome({ title: 'Haleon target signed', slot: 2 });
const pinkbox = makeOutcome({ title: 'Pinkbox P&L live', slot: 3, category: 'business' });
const weekOf = (outcomes: Outcome[]) => makeWeekView(outcomes, { startDate: '2026-09-27' });

/** A stateful fake: a grade updates its outcome, and the stamp updates the week. */
function fakeReviewApi(start: WeekView) {
  let view = start;
  return stubFetch((url, init) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (method === 'GET') return json(view);
    const graded = url.match(/\/outcomes\/([^/]+)\/review$/)?.[1];
    if (graded) {
      view = { ...view, outcomes: view.outcomes.map((o) => (o.id === graded ? { ...o, reviewGrade: body.grade, reviewDisposition: body.disposition ?? null } : o)) };
      return json(view.outcomes.find((o) => o.id === graded));
    }
    view = { ...view, week: { ...view.week, reviewedAt: '2026-10-02T12:00:00.000Z', reviewNotes: body.notes } };
    return json(view.week);
  });
}

const render = () => renderWithProviders(<FridayReview weekId={WEEK_ID} today={TODAY} />);
const writes = (calls: FetchCall[]) => calls.filter((c) => c.method !== 'GET').map((c) => ({ url: c.url, body: c.body }));

describe('FridayReview', () => {
  it('grades each outcome in turn, then stamps the review with its note', async () => {
    const calls = fakeReviewApi(weekOf([supplier, haleon, pinkbox]));
    render();
    let form = await screen.findByRole('form', { name: 'Review "Supplier plan confirmed"' });
    expect(within(form).getByText('Outcome 1 of 3 · Office')).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeDisabled();
    await userEvent.click(within(form).getByRole('radio', { name: 'Done' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Save grade' }));

    form = await screen.findByRole('form', { name: 'Review "Haleon target signed"' });
    expect(within(form).getByText('Outcome 2 of 3 · Office')).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('radio', { name: 'Partial' }));
    await userEvent.selectOptions(within(form).getByLabelText('Why did it slip?'), 'Priority changed');
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeDisabled();
    await userEvent.click(within(form).getByRole('radio', { name: 'Roll into next week' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Save grade' }));

    form = await screen.findByRole('form', { name: 'Review "Pinkbox P&L live"' });
    expect(within(form).getByText('Outcome 3 of 3 · Business')).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('radio', { name: 'Missed' }));
    await userEvent.click(within(form).getByRole('radio', { name: 'Delegate' }));
    await userEvent.type(within(form).getByLabelText('Owner'), 'Sana');
    await userEvent.click(within(form).getByRole('button', { name: 'Save grade' }));

    expect(await screen.findByText('Every outcome is graded.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Notes (optional)'), 'Too many meetings');
    await userEvent.click(screen.getByRole('button', { name: 'Review done' }));
    expect(await screen.findByText('Reviewed.')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Graded outcomes' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Supplier plan confirmed: Done',
      'Haleon target signed: Partial · Roll into next week',
      'Pinkbox P&L live: Missed · Delegate',
    ]);
    expect(writes(calls)).toEqual([
      { url: `/api/exec/outcomes/${supplier.id}/review`, body: { grade: 'done' } },
      { url: `/api/exec/outcomes/${haleon.id}/review`, body: { grade: 'partial', reason: 'priority_changed', disposition: 'roll_forward' } },
      {
        url: `/api/exec/outcomes/${pinkbox.id}/review`,
        body: { grade: 'missed', reason: 'insufficient_time', disposition: 'delegate', owner: 'Sana', followUpDate: '2026-10-05' },
      },
      { url: `/api/exec/weeks/${WEEK_ID}/review`, body: { notes: 'Too many meetings' } },
    ]);
  });

  it('resumes at the first ungraded outcome, and offers only Done for a finished one', async () => {
    fakeReviewApi(weekOf([{ ...supplier, reviewGrade: 'done', status: 'done' }, { ...haleon, status: 'done' }, pinkbox]));
    render();
    const form = await screen.findByRole('form', { name: 'Review "Haleon target signed"' });
    expect(within(form).getByText('Outcome 2 of 3 · Office')).toBeInTheDocument();
    expect(within(form).getByRole('radio', { name: 'Done' })).toBeChecked();
    expect(within(form).getByRole('radio', { name: 'Partial' })).toBeDisabled();
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeEnabled();
  });

  it('holds a reschedule until its date lands in a later week', async () => {
    fakeReviewApi(weekOf([supplier]));
    render();
    const form = await screen.findByRole('form', { name: 'Review "Supplier plan confirmed"' });
    await userEvent.click(within(form).getByRole('radio', { name: 'Missed' }));
    await userEvent.click(within(form).getByRole('radio', { name: 'Reschedule' }));
    const date = within(form).getByLabelText('Move to');
    expect(date).toHaveValue('2026-10-05');
    expect(date).toHaveAttribute('min', '2026-10-04');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-02');
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeDisabled();
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-14');
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeEnabled();
  });

  it('says so when a grade is refused', async () => {
    stubFetch((_url, init) => (init?.method === 'POST' ? failure(400, 'VALIDATION', 'that outcome is already reviewed') : json(weekOf([supplier]))));
    render();
    const form = await screen.findByRole('form', { name: 'Review "Supplier plan confirmed"' });
    await userEvent.click(within(form).getByRole('radio', { name: 'Done' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Save grade' }));
    expect(await screen.findByText('Could not save the grade: that outcome is already reviewed')).toBeInTheDocument();
  });

  it('says so when the week cannot be read, and finishes a week with nothing to grade', async () => {
    stubFetch(() => failure(500, 'INTERNAL', 'internal server error'));
    const { unmount } = render();
    expect(await screen.findByRole('alert')).toHaveTextContent("Could not load the week's outcomes: internal server error");
    unmount();
    fakeReviewApi(weekOf([]));
    render();
    expect(await screen.findByText('No outcomes to grade this week.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review done' })).toBeEnabled();
  });
});
