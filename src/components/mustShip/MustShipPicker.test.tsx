import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MustShipPicker } from './MustShipPicker';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json, failure } from '../../test/fetch';
import { makeMustShip } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const candidate = makeMustShip({ title: 'Price list approved', date: null });
const dayTaken = () =>
  new Response(JSON.stringify({ success: false, error: 'that day already has a must ship', code: 'DAY_TAKEN', details: { mustShip: makeMustShip() } }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

describe('MustShipPicker', () => {
  it('uses a candidate by giving it the date', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'PATCH' ? json(candidate) : json([candidate])));
    const onDone = vi.fn();
    renderWithProviders(<MustShipPicker date="2026-09-29" context="work" outcomes={[]} onDone={onDone} />);
    const list = await screen.findByRole('list', { name: 'Candidates' });
    await userEvent.click(within(list).getByRole('button', { name: 'Use "Price list approved"' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: `/api/exec/must-ships/${candidate.id}`, body: { date: '2026-09-29' } }));
    expect(calls[0].url).toBe('/api/exec/must-ships?date=none&status=planned&context=work');
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('writes a new one for the date and context', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'POST' ? json(makeMustShip(), 201) : json([])));
    renderWithProviders(<MustShipPicker date="2026-09-29" context="work" outcomes={[]} />);
    await userEvent.type(await screen.findByLabelText('Must Ship'), 'Delivery tracker sent');
    await userEvent.click(screen.getByRole('button', { name: 'Set Must Ship' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Delivery tracker sent', definitionOfDone: '', outcomeId: null, context: 'work', date: '2026-09-29' })
    );
    expect(screen.queryByRole('list', { name: 'Candidates' })).toBeNull();
  });

  it('says so plainly when another tab already set the day', async () => {
    stubFetch((_url, init) => (init?.method === 'POST' ? dayTaken() : json([])));
    renderWithProviders(<MustShipPicker date="2026-09-29" context="work" outcomes={[]} />);
    await userEvent.type(await screen.findByLabelText('Must Ship'), 'Second one');
    await userEvent.click(screen.getByRole('button', { name: 'Set Must Ship' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not set the Must Ship: that day already has a Must Ship');
  });

  it('says so when the candidates cannot be read, and still lets you write one', async () => {
    stubFetch(() => failure(500, 'INTERNAL', 'internal server error'));
    renderWithProviders(<MustShipPicker date="2026-09-29" context="work" outcomes={[]} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load candidates: internal server error');
    expect(screen.getByLabelText('Must Ship')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Candidates' })).toBeNull();
  });
});
