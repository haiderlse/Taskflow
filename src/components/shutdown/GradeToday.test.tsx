import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GradeToday } from './GradeToday';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json, failure } from '../../test/fetch';
import { makeMustShip } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const ship = makeMustShip({ title: 'Delivery tracker sent', date: '2026-09-29' });
const writes = (calls: { method: string; url: string; body?: unknown }[]) => calls.filter((c) => c.method !== 'GET');
const render = () => renderWithProviders(<GradeToday next="2026-09-30" mustShip={ship} />);

describe('GradeToday', () => {
  it('keeps Save disabled until a grade is chosen, then grades Shipped without rolling', async () => {
    const calls = stubFetch(() => json({}));
    render();
    expect(screen.getByRole('region', { name: 'What shipped today?' })).toHaveTextContent('Delivery tracker sent');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Shipped' }));
    expect(screen.getByRole('button', { name: 'Shipped' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('checkbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toEqual([{ method: 'PATCH', url: `/api/exec/must-ships/${ship.id}`, body: { status: 'shipped' } }]));
  });

  it('rolls a partial one to the next work day before grading it', async () => {
    const calls = stubFetch(() => json({}));
    render();
    await userEvent.click(screen.getByRole('button', { name: 'Partial' }));
    expect(screen.getByRole('checkbox', { name: 'Roll to Wednesday 30 September' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(writes(calls)).toEqual([
        { method: 'POST', url: `/api/exec/must-ships/${ship.id}/roll`, body: { date: '2026-09-30' } },
        { method: 'PATCH', url: `/api/exec/must-ships/${ship.id}`, body: { status: 'partial' } },
      ])
    );
  });

  it('grades a missed one without rolling when the box is unticked', async () => {
    const calls = stubFetch(() => json({}));
    render();
    await userEvent.click(screen.getByRole('button', { name: 'Missed' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Roll to Wednesday 30 September' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toEqual([{ method: 'PATCH', url: `/api/exec/must-ships/${ship.id}`, body: { status: 'missed' } }]));
  });

  it('still grades when the roll is refused, and says why', async () => {
    const calls = stubFetch((url) => (url.endsWith('/roll') ? failure(409, 'DAY_TAKEN', 'that day already has a must ship') : json({})));
    render();
    await userEvent.click(screen.getByRole('button', { name: 'Partial' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Could not roll it to Wednesday 30 September: that day already has a Must Ship')).toBeInTheDocument();
    await waitFor(() => expect(writes(calls).at(-1)).toEqual({ method: 'PATCH', url: `/api/exec/must-ships/${ship.id}`, body: { status: 'partial' } }));
  });

  it('records a blocker and files its next action', async () => {
    const calls = stubFetch(() => json({}));
    render();
    await userEvent.click(screen.getByRole('button', { name: 'Blocked' }));
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    await userEvent.type(screen.getByLabelText('What blocks it?'), 'No quote from the venue');
    await userEvent.type(screen.getByLabelText('Who owns the unblock?'), 'Sana');
    await userEvent.type(screen.getByLabelText('What is the next action?'), 'Chase the venue quote');
    await userEvent.click(screen.getByRole('button', { name: 'Record the blocker' }));
    await waitFor(() =>
      expect(writes(calls)).toEqual([
        {
          method: 'POST',
          url: `/api/exec/must-ships/${ship.id}/block`,
          body: { what: 'No quote from the venue', owner: 'Sana', nextAction: 'Chase the venue quote' },
        },
      ])
    );
  });
});
