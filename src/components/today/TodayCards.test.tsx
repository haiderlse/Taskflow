import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactElement } from 'react';
import { TodayHeader } from './TodayHeader';
import { Banners } from './Banners';
import { MustShipCard } from './MustShipCard';
import { BuildCard } from './BuildCard';
import { TomorrowCard } from './TomorrowCard';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { SETTINGS, makeMustShip, makeOutcome, makeWeekView } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

/** The cards hold links, so they render inside a router. */
const show = (ui: ReactElement) => renderWithProviders(<RouterProvider router={createMemoryRouter([{ path: '/', element: ui }])} />);

describe('TodayHeader', () => {
  it('names the day and the week and links the outcomes done', () => {
    const week = makeWeekView([makeOutcome({ status: 'done', slot: 1 }), makeOutcome({ slot: 2 }), makeOutcome({ slot: null, status: 'killed' })]);
    show(<TodayHeader date="2026-09-22" weekStartDay={0} week={week} />);
    expect(screen.getByText('Tuesday 22 September · Week 39')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 of 2 outcomes done' })).toHaveAttribute('href', '/week');
  });

  it('says there are no outcomes yet without a week', () => {
    show(<TodayHeader date="2026-09-29" weekStartDay={0} week={null} />);
    expect(screen.getByRole('link', { name: 'No outcomes yet' })).toHaveAttribute('href', '/week');
  });
});

describe('Banners', () => {
  it('links the first plan, or this week\'s, and closing the day', () => {
    show(<Banners banners={['plan', 'close']} firstWeek />);
    expect(screen.getByRole('link', { name: 'Plan your first week' })).toHaveAttribute('href', '/plan');
    expect(screen.getByRole('link', { name: 'Close the day' })).toHaveAttribute('href', '/shutdown');
  });

  it('asks for this week once there is history, and shows nothing without banners', () => {
    const { unmount } = show(<Banners banners={['plan']} firstWeek={false} />);
    expect(screen.getByRole('link', { name: 'Plan this week' })).toBeInTheDocument();
    unmount();
    show(<Banners banners={[]} firstWeek={false} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('MustShipCard', () => {
  const outcome = makeOutcome({ title: 'Supplier plan confirmed' });

  it('shows the Must Ship, what it serves, the window and Start deep work', () => {
    const mustShip = makeMustShip({ title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20', outcomeId: outcome.id });
    show(<MustShipCard mustShip={mustShip} outcome={outcome} outcomes={[outcome]} settings={SETTINGS} mode="start" />);
    const card = screen.getByRole('region', { name: 'Must Ship' });
    expect(within(card).getByRole('heading', { level: 2, name: 'Delivery tracker sent' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Sent to all 20');
    expect(card).toHaveTextContent('For: Supplier plan confirmed');
    expect(card).toHaveTextContent('Deep work 08:35–10:05');
    expect(within(card).getByRole('link', { name: 'Start deep work' })).toHaveAttribute('href', '/focus');
  });

  it('asks for the result once its block has ended, and shows a closed status without edits', () => {
    const { unmount } = show(<MustShipCard mustShip={makeMustShip()} outcome={null} outcomes={[]} settings={SETTINGS} mode="grade" />);
    expect(screen.getByRole('link', { name: 'Record the result' })).toHaveAttribute('href', '/focus');
    unmount();
    show(<MustShipCard mustShip={makeMustShip({ status: 'shipped' })} outcome={null} outcomes={[]} settings={SETTINGS} mode="start" />);
    expect(screen.getByText('Shipped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Put back' })).toBeNull();
  });

  it('puts a planned Must Ship back among the candidates, and edits it in place', async () => {
    const mustShip = makeMustShip({ title: 'Delivery tracker sent' });
    const calls = stubFetch(() => json(mustShip));
    show(<MustShipCard mustShip={mustShip} outcome={null} outcomes={[]} settings={SETTINGS} mode="start" />);
    await userEvent.click(screen.getByRole('button', { name: 'Put back' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: `/api/exec/must-ships/${mustShip.id}`, body: { date: null } }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText('Must Ship');
    await userEvent.clear(title);
    await userEvent.type(title, 'Delivery tracker sent to all');
    await userEvent.click(screen.getByRole('button', { name: 'Save Must Ship' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ title: 'Delivery tracker sent to all', definitionOfDone: '', outcomeId: null }));
  });
});

describe('BuildCard and TomorrowCard', () => {
  it('shows the build Must Ship with its block and Start', () => {
    show(<BuildCard mustShip={makeMustShip({ title: 'Landing page live', context: 'build' })} outcome={null} block={{ weekday: 2, start: '06:30', minutes: 50 }} tomorrow={null} />);
    const card = screen.getByRole('region', { name: 'Build' });
    expect(card).toHaveTextContent('Landing page live');
    expect(card).toHaveTextContent('Build block 06:30 · 50 min');
    expect(within(card).getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/focus');
  });

  it('falls back to a build outcome, then to nothing planned with a way to the week', () => {
    const { unmount } = show(<BuildCard mustShip={null} outcome={makeOutcome({ title: 'Healify beta', category: 'business' })} block={null} tomorrow="Price list approved" />);
    expect(screen.getByRole('region', { name: 'Build' })).toHaveTextContent('Healify beta');
    expect(screen.getByText('No build block today')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow: Price list approved')).toBeInTheDocument();
    unmount();
    show(<BuildCard mustShip={null} outcome={null} block={null} tomorrow={null} />);
    expect(screen.getByText('Nothing planned for Build')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the week' })).toHaveAttribute('href', '/week');
    expect(screen.queryByRole('link', { name: 'Start' })).toBeNull();
  });

  it('says tomorrow is ready, with its Must Ship or without', () => {
    const { unmount } = show(<TomorrowCard date="2026-09-30" mustShip={makeMustShip({ title: 'Price list approved' })} />);
    const card = screen.getByRole('region', { name: 'Tomorrow' });
    expect(within(card).getByRole('heading', { level: 2, name: 'Tomorrow is ready' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Wednesday 30 September: Price list approved');
    unmount();
    show(<TomorrowCard date="2026-09-30" mustShip={null} />);
    expect(screen.getByText('No Must Ship for Wednesday 30 September yet')).toBeInTheDocument();
  });
});
