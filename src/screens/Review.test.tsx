import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeLookup, makeOutcome, makeScoreboard, makeWeekView } from '../test/fixtures';

const OLDER = '20000000-0000-4000-8000-000000000002';
const current = makeWeekView([makeOutcome({ title: 'Supplier plan confirmed' })], { startDate: '2026-09-27' });
const thisWeek = makeScoreboard({
  startDate: '2026-09-27',
  outcomes: { shipped: 1, total: 3 },
  mustShips: { shipped: 3, total: 5 },
  deepWorkMinutes: 200,
  rolledForward: 1,
  killed: 2,
  delegated: 1,
  strip: [
    { date: '2026-09-28', status: 'shipped' },
    { date: '2026-09-29', status: 'partial' },
    { date: '2026-09-30', status: null },
    { date: '2026-10-01', status: 'shipped' },
    { date: '2026-10-02', status: 'shipped' },
  ],
});
const lastWeek = makeScoreboard({ weekId: OLDER, startDate: '2026-09-20', outcomes: { shipped: 2, total: 3 }, mustShips: { shipped: 4, total: 5 }, deepWorkMinutes: 450 });

type Answers = { lookup?: () => Response; board?: () => Response; history?: () => Response };

function api(answers: Answers = {}) {
  return stubFetch((url) => {
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url.startsWith('/api/exec/weeks?')) return answers.lookup?.() ?? json(makeLookup({ current }));
    if (url.startsWith('/api/exec/weeks/history')) return answers.history?.() ?? json([lastWeek]);
    const board = url.match(/\/weeks\/([^/]+)\/scoreboard$/)?.[1];
    if (board) return answers.board?.() ?? json(board === OLDER ? lastWeek : thisWeek);
    if (/\/weeks\/[^/?]+$/.test(url)) return json(current); // the Friday review (Task 11) reads the week by id
    return json([]);
  });
}

const valueOf = (term: string) => screen.getByText(term).nextElementSibling?.textContent;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-02T11:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('/review', () => {
  it("shows this week's scoreboard and strip, and the earlier weeks", async () => {
    api();
    renderRoute('/review');
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 40 · 27 Sep – 3 Oct' })).toBeInTheDocument();
    expect(valueOf('Outcomes shipped')).toBe('1 of 3');
    expect(valueOf('Must Ships shipped')).toBe('3 of 5');
    expect(valueOf('Deep work')).toBe('3 h 20 min');
    expect(valueOf('Rolled forward')).toBe('1');
    expect(valueOf('Killed')).toBe('2');
    expect(valueOf('Delegated')).toBe('1');
    expect(within(screen.getByRole('list', { name: 'Day strip' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Mon · Shipped',
      'Tue · Partial',
      'Wed · None',
      'Thu · Shipped',
      'Fri · Shipped',
    ]);
    const earlier = await screen.findByRole('region', { name: 'Earlier weeks' });
    expect(await within(earlier).findByRole('button', { name: /^Week 39 · 20–26 Sep/ })).toHaveTextContent(
      '2 of 3 outcomes · 4 of 5 Must Ships · 7 h 30 min deep work · 0 rolled · 0 killed · 0 delegated'
    );
  });

  it('shows an earlier week when chosen, and comes back', async () => {
    api();
    renderRoute('/review');
    await userEvent.click(await screen.findByRole('button', { name: /^Week 39/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 39 · 20–26 Sep' })).toBeInTheDocument();
    expect(valueOf('Outcomes shipped')).toBe('2 of 3');
    await userEvent.click(screen.getByRole('button', { name: 'Back to this week' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 40 · 27 Sep – 3 Oct' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to this week' })).toBeNull();
  });

  it('says when this week has no plan and when there are no earlier weeks', async () => {
    api({ lookup: () => json(makeLookup()), history: () => json([]) });
    renderRoute('/review');
    expect(await screen.findByRole('link', { name: 'Plan this week' })).toHaveAttribute('href', '/plan');
    expect(await screen.findByText('No earlier weeks yet.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Scoreboard' })).toBeNull();
  });

  it('says so when the scoreboard or the history cannot be read', async () => {
    const broken = () => failure(500, 'INTERNAL', 'internal server error');
    api({ board: broken, history: broken });
    renderRoute('/review');
    expect(await screen.findByText('Could not load the scoreboard: internal server error')).toBeInTheDocument();
    expect(await screen.findByText('Could not load earlier weeks: internal server error')).toBeInTheDocument();
  });

  it('says so when the schedule cannot be read, instead of loading forever', async () => {
    stubFetch((url) => (url.endsWith('/settings') ? failure(500, 'INTERNAL', 'internal server error') : json([])));
    renderRoute('/review');
    expect(await screen.findByText('Could not load the schedule: internal server error')).toBeInTheDocument();
    expect(screen.queryByText('Loading the week…')).toBeNull();
  });

  it('runs the Friday review for the selected week', async () => {
    api();
    renderRoute('/review');
    const review = await screen.findByRole('region', { name: 'Friday review' });
    expect(await within(review).findByRole('form', { name: 'Review "Supplier plan confirmed"' })).toBeInTheDocument();
  });
});
