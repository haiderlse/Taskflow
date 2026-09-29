import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutcomeCard } from './OutcomeCard';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { makeOutcome } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

function renderCard(overrides = {}) {
  stubFetch(() => json([]));
  const outcome = makeOutcome({ title: 'Supplier plan confirmed', definitionOfDone: 'Dates for the top 20', progress: 40, ...overrides });
  const onUpdate = vi.fn();
  const onKill = vi.fn();
  renderWithProviders(<OutcomeCard outcome={outcome} onUpdate={onUpdate} onKill={onKill} />);
  return { outcome, onUpdate, onKill, card: screen.getByRole('article', { name: 'Supplier plan confirmed' }) };
}

describe('OutcomeCard', () => {
  it('shows the category, the target and the folded definition of done', () => {
    const { card } = renderCard();
    expect(card).toHaveTextContent('Office');
    expect(card).toHaveTextContent('Target 2026-09-25');
    expect(within(card).getByText('Definition of done')).toBeInTheDocument();
  });

  it('commits a progress change when the slider is released, not on every step', () => {
    const { onUpdate } = renderCard();
    const slider = screen.getByLabelText('Progress for Supplier plan confirmed');
    fireEvent.change(slider, { target: { value: '60' } });
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.blur(slider);
    expect(onUpdate).toHaveBeenCalledWith({ progress: 60 }, expect.any(Object));
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('marks done and reopens', async () => {
    const { onUpdate } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(onUpdate).toHaveBeenCalledWith({ status: 'done' });
  });

  it('offers Reopen on a done outcome and disables its slider', async () => {
    const { onUpdate } = renderCard({ status: 'done', progress: 100 });
    expect(screen.getByLabelText('Progress for Supplier plan confirmed')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(onUpdate).toHaveBeenCalledWith({ status: 'active' });
  });

  it('offers no Kill on a finished outcome, only Reopen', () => {
    renderCard({ status: 'done', progress: 100 });
    expect(screen.queryByRole('button', { name: 'Kill' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument();
  });

  it('kills with a reason', async () => {
    const { onKill } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Kill' }));
    await userEvent.selectOptions(screen.getByLabelText('Why does it go?'), 'No longer important');
    await userEvent.click(screen.getByRole('button', { name: 'Kill outcome' }));
    expect(onKill).toHaveBeenCalledWith('no_longer_important');
  });

  it('stays in edit mode until the save reports success', async () => {
    const { onUpdate } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save outcome' }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Supplier plan confirmed', definitionOfDone: 'Dates for the top 20' }), expect.any(Object));
    expect(screen.getByRole('button', { name: 'Save outcome' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('returns to the view once the save succeeds', async () => {
    const { onUpdate } = renderCard();
    onUpdate.mockImplementation((_patch, options) => options?.onSuccess?.());
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText('Outcome');
    await userEvent.clear(title);
    await userEvent.type(title, 'Supplier plan published');
    await userEvent.click(screen.getByRole('button', { name: 'Save outcome' }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Supplier plan published' }), expect.any(Object));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('puts the slider back to the saved value when the progress save fails', () => {
    const { onUpdate } = renderCard();
    onUpdate.mockImplementation((_patch, options) => options?.onError?.());
    const slider = screen.getByLabelText('Progress for Supplier plan confirmed');
    fireEvent.change(slider, { target: { value: '60' } });
    fireEvent.blur(slider);
    expect(onUpdate).toHaveBeenCalledWith({ progress: 60 }, expect.any(Object));
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(slider).toHaveValue('40');
  });
});
