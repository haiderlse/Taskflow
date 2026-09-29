import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockPanel } from './BlockPanel';
import { makeBlock, makeOutcome } from '../../test/fixtures';

const office = makeOutcome({ title: 'Supplier plan confirmed', category: 'office', slot: 1 });
const build = makeOutcome({ title: 'Healify beta live', category: 'business', slot: 2 });
const killed = makeOutcome({ title: 'Killed one', category: 'office', slot: null, status: 'killed' });
const outcomes = [office, build, killed];
const proposal = { date: '2026-09-29', context: 'work' as const, plannedStart: '08:35', plannedMinutes: 90 };

describe('BlockPanel', () => {
  it('offers only active outcomes of the block\'s context, and saves what was chosen', async () => {
    const onSave = vi.fn();
    render(<BlockPanel target={{ kind: 'proposal', proposal }} outcomes={outcomes} pending={false} onSave={onSave} onClose={vi.fn()} />);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['No outcome', 'Supplier plan confirmed']);
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Supplier plan confirmed');
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '60' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    expect(onSave).toHaveBeenCalledWith({ context: 'work', plannedStart: '08:35', plannedMinutes: 60, outcomeId: office.id });
  });

  it('lets a new block choose its context, which changes the outcomes on offer', async () => {
    const onSave = vi.fn();
    render(<BlockPanel target={{ kind: 'new', date: '2026-10-02' }} outcomes={outcomes} pending={false} onSave={onSave} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Start')).toHaveValue('09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['No outcome', 'Healify beta live']);
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    expect(onSave).toHaveBeenCalledWith({ context: 'build', plannedStart: '09:00', plannedMinutes: 60, outcomeId: null });
  });

  it('refuses a length outside 15 to 600 minutes and disables saving while pending', () => {
    const { rerender } = render(<BlockPanel target={{ kind: 'proposal', proposal }} outcomes={outcomes} pending={false} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: 'Save block' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '90' } });
    expect(screen.getByRole('button', { name: 'Save block' })).toBeEnabled();
    rerender(<BlockPanel target={{ kind: 'proposal', proposal }} outcomes={outcomes} pending onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save block' })).toBeDisabled();
  });

  it('accepts the start and length the defaults use, which are not multiples of 15 (08:35 for 90, or 50 minutes)', () => {
    render(<BlockPanel target={{ kind: 'proposal', proposal: { date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 } }} outcomes={outcomes} pending={false} onSave={vi.fn()} onClose={vi.fn()} />);
    expect((screen.getByLabelText('Start') as HTMLInputElement).checkValidity()).toBe(true);
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '50' } });
    // A browser runs this check on submit and silently refuses the form when it fails; a `step` on the field breaks it.
    expect((screen.getByLabelText('Minutes') as HTMLInputElement).checkValidity()).toBe(true);
  });

  it('shows a running or finished block as read-only', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<BlockPanel target={{ kind: 'block', block: makeBlock({ startedAt: '2026-09-29T03:35:00.000Z' }) }} outcomes={outcomes} pending={false} onSave={vi.fn()} onClose={onClose} />);
    expect(screen.getByText('Running now.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save block' })).toBeNull();
    rerender(<BlockPanel target={{ kind: 'block', block: makeBlock({ startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T04:20:00.000Z', result: 'blocked' }) }} outcomes={outcomes} pending={false} onSave={vi.fn()} onClose={onClose} />);
    expect(screen.getByText('Finished: Blocked')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
