import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReplacePicker } from './ReplacePicker';
import { makeOutcome } from '../../test/fixtures';

describe('ReplacePicker', () => {
  it('asks which outcome gives up its slot and why', async () => {
    const outcomes = [makeOutcome({ title: 'A' }), makeOutcome({ title: 'B', slot: 2 }), makeOutcome({ title: 'C', slot: 3 })];
    const onPick = vi.fn();
    render(<ReplacePicker outcomes={outcomes} onPick={onPick} onCancel={() => {}} />);
    const form = screen.getByRole('form', { name: 'Replace an outcome' });
    expect(form).toHaveTextContent('This week already has three outcomes. Which one gives up its slot?');
    await userEvent.click(screen.getByRole('radio', { name: 'B' }));
    await userEvent.selectOptions(screen.getByLabelText('Why does it give way?'), 'Urgent work came up');
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(onPick).toHaveBeenCalledWith(outcomes[1].id, 'unexpected_urgent_work');
  });

  it('defaults to the first outcome and "Priority changed"', async () => {
    const outcomes = [makeOutcome({ title: 'A' })];
    const onPick = vi.fn();
    render(<ReplacePicker outcomes={outcomes} onPick={onPick} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(onPick).toHaveBeenCalledWith(outcomes[0].id, 'priority_changed');
  });
});
