import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutcomeForm } from './OutcomeForm';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { makeProjectSummary } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const active = makeProjectSummary({ name: 'September supply plan' });
const archived = makeProjectSummary({ name: 'Old plan', status: 'archived' });

function renderForm(props: Partial<Parameters<typeof OutcomeForm>[0]> = {}) {
  stubFetch(() => json([active, archived]));
  const onSubmit = vi.fn();
  renderWithProviders(<OutcomeForm defaultTargetDate="2026-09-25" submitLabel="Add outcome" onSubmit={onSubmit} {...props} />);
  return onSubmit;
}

describe('OutcomeForm', () => {
  it('submits a trimmed outcome with the default target date and no project', async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText('Outcome'), '  Supplier delivery plan confirmed ');
    await userEvent.type(screen.getByLabelText('Definition of done'), 'Dates confirmed for the top 20 suppliers');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Supplier delivery plan confirmed',
      category: 'office',
      definitionOfDone: 'Dates confirmed for the top 20 suppliers',
      targetDate: '2026-09-25',
      projectId: null,
    });
  });

  it('nudges an activity title, moves focus to the definition of done, and still saves', async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText('Outcome'), 'Work on supplier meetings');
    expect(screen.getByRole('note')).toHaveTextContent('This sounds like an activity. What will exist when it is finished?');
    // A blur event, not userEvent.tab(): tab would move focus on to the next field after the handler runs.
    fireEvent.blur(screen.getByLabelText('Outcome'));
    expect(screen.getByLabelText('Definition of done')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('requires a definition of done only when asked to', async () => {
    const onSubmit = renderForm({ requireDefinition: true });
    await userEvent.type(screen.getByLabelText('Outcome'), 'Pinkbox P&L dashboard live');
    expect(screen.getByRole('button', { name: 'Add outcome' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Definition of done'), 'Dashboard shows live franchise data');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Business');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: 'business' }));
  });

  it('offers only active projects', async () => {
    const onSubmit = renderForm();
    await waitFor(() => expect(screen.getByRole('option', { name: 'September supply plan' })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Old plan' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Project'), 'September supply plan');
    await userEvent.type(screen.getByLabelText('Outcome'), 'Tracker sent');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ projectId: active.id }));
  });
});
