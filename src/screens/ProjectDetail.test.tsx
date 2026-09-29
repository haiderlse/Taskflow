import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeOutcome, makeProjectSummary, makeTask } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('/projects/:id', () => {
  it('shows the project with its outcomes by week and open tasks, and saves status and notes', async () => {
    const project = makeProjectSummary({ name: 'Supply plan', notes: 'Top 20 suppliers' });
    const detail = { project, outcomes: [{ ...makeOutcome({ title: 'Delivery plan confirmed' }), weekStartDate: '2026-09-20' }], tasks: [makeTask({ title: 'Call supplier' })] };
    const calls = stubFetch((url, init) => (url.endsWith('/settings') ? json(SETTINGS) : init?.method === 'PATCH' ? json(project) : json(detail)));
    renderRoute(`/projects/${project.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Supply plan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All projects' })).toHaveAttribute('href', '/projects');
    expect(within(screen.getByRole('region', { name: 'Outcomes' })).getByText('Week 39 · Delivery plan confirmed')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Open tasks' })).getByText('Call supplier')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Archived');
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'archived' }));

    const notes = screen.getByLabelText('Notes');
    await userEvent.clear(notes);
    await userEvent.type(notes, 'Top 25 suppliers');
    fireEvent.blur(notes);
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ notes: 'Top 25 suppliers' }));
  });

  it('says so when the project does not exist', async () => {
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(404, 'NOT_FOUND', 'no such project')));
    renderRoute('/projects/nope');
    expect(await screen.findByText('That project does not exist.')).toBeInTheDocument();
  });
});
