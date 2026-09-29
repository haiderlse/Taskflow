import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MustShipForm } from './MustShipForm';
import { renderWithProviders } from '../../test/render';
import { makeOutcome } from '../../test/fixtures';
import { NUDGE_MESSAGE } from '../../shared/exec/nudge';

const outcome = makeOutcome({ title: 'Supplier plan confirmed' });

function renderForm() {
  const onSubmit = vi.fn();
  renderWithProviders(<MustShipForm outcomes={[outcome]} submitLabel="Set Must Ship" onSubmit={onSubmit} />);
  return onSubmit;
}

describe('MustShipForm', () => {
  it('submits the trimmed title, definition and the outcome it serves', async () => {
    const onSubmit = renderForm();
    expect(screen.getByRole('button', { name: 'Set Must Ship' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Must Ship'), '  Delivery tracker sent ');
    await userEvent.type(screen.getByLabelText('Definition of done'), 'Sent to all 20 suppliers');
    await userEvent.selectOptions(screen.getByLabelText('Serves outcome'), 'Supplier plan confirmed');
    await userEvent.click(screen.getByRole('button', { name: 'Set Must Ship' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20 suppliers', outcomeId: outcome.id });
  });

  it('nudges an activity, moves to the definition, and still saves', async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText('Must Ship'), 'Follow up with suppliers');
    expect(screen.getByRole('note')).toHaveTextContent(NUDGE_MESSAGE);
    fireEvent.blur(screen.getByLabelText('Must Ship'));
    expect(screen.getByLabelText('Definition of done')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Set Must Ship' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Follow up with suppliers', definitionOfDone: '', outcomeId: null });
  });

  it('leaves focus alone when leaving an activity title goes to another control', async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText('Must Ship'), 'Follow up with suppliers');
    fireEvent.blur(screen.getByLabelText('Must Ship'), { relatedTarget: screen.getByRole('button', { name: 'Set Must Ship' }) });
    expect(screen.getByLabelText('Definition of done')).not.toHaveFocus();
  });
});
