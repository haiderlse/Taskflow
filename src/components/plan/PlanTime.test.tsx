import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanTime } from './PlanTime';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { SETTINGS, makeBlock, makeOutcome, makeWeekView } from '../../test/fixtures';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';

afterEach(() => vi.unstubAllGlobals());

const office = makeOutcome({ title: 'Supplier plan confirmed', category: 'office', slot: 1 });
const business = makeOutcome({ title: 'Healify beta live', category: 'business', slot: 2 });

function show(blocks: DeepWorkBlock[]) {
  stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : url.startsWith('/api/exec/deep-work?') ? json(blocks) : json([])));
  const onDone = vi.fn();
  renderWithProviders(<PlanTime view={makeWeekView([office, business])} today="2026-09-29" weekStartDate="2026-09-27" onDone={onDone} />);
  return onDone;
}

describe('PlanTime', () => {
  it('asks when the work will happen, flags outcomes without time, and never blocks finishing', async () => {
    const onDone = show([makeBlock({ date: '2026-09-30', outcomeId: office.id })]);
    expect(screen.getByRole('heading', { level: 2, name: 'When will you actually work on these?' })).toBeInTheDocument();
    expect(await screen.findByText('No time yet: Healify beta live')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done planning time' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('says every outcome has time once each one has a block', async () => {
    show([makeBlock({ date: '2026-09-30', outcomeId: office.id }), makeBlock({ date: '2026-10-03', context: 'build', plannedStart: '09:00', outcomeId: business.id })]);
    expect(await screen.findByText('Every outcome has time.')).toBeInTheDocument();
  });
});
