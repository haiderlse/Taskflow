import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeOutcome, makeMustShip, makeProjectSummary, makeTask } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('/projects/:id', () => {
  it('shows the project with its outcomes by week and open tasks, and saves status and notes', async () => {
    const project = makeProjectSummary({ name: 'Supply plan', notes: 'Top 20 suppliers' });
    const detail = { project, outcomes: [{ ...makeOutcome({ title: 'Delivery plan confirmed' }), weekStartDate: '2026-09-20' }], tasks: [makeTask({ title: 'Call supplier' })] };
    const calls = stubFetch((url, init) =>
      url.endsWith('/settings') ? json(SETTINGS) : url.includes('/must-ships') ? json([]) : init?.method === 'PATCH' ? json(project) : json(detail)
    );
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

  it('does not claim the project is gone when the request fails for another reason', async () => {
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    renderRoute('/projects/some-id');
    expect(await screen.findByText('Could not load the project: internal server error')).toBeInTheDocument();
    expect(screen.queryByText('That project does not exist.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All projects' })).toHaveAttribute('href', '/projects');
  });

  it('lists Must Ship candidates and adds one to the project', async () => {
    const project = makeProjectSummary({ name: 'Supply plan' });
    const detail = { project, outcomes: [], tasks: [] };
    const calls = stubFetch((url, init) =>
      url.endsWith('/settings')
        ? json(SETTINGS)
        : init?.method === 'POST'
          ? json(makeMustShip(), 201)
          : url.includes('/must-ships')
            ? json([makeMustShip({ title: 'Price list approved', date: null, projectId: project.id })])
            : json(detail)
    );
    renderRoute(`/projects/${project.id}`);
    const region = await screen.findByRole('region', { name: 'Must Ship candidates' });
    expect(await within(region).findByText('Price list approved')).toBeInTheDocument();
    expect(calls.find((c) => c.url.includes('/must-ships'))?.url).toBe(`/api/exec/must-ships?date=none&status=planned&project=${project.id}`);
    await userEvent.type(within(region).getByLabelText('Must Ship'), 'Delivery tracker sent');
    await userEvent.click(within(region).getByRole('button', { name: 'Add candidate' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Delivery tracker sent', definitionOfDone: '', outcomeId: null, context: 'work', date: null, projectId: project.id })
    );
  });

  it('says so when the candidates cannot be read instead of showing an empty list', async () => {
    const project = makeProjectSummary({ name: 'Supply plan' });
    stubFetch((url) =>
      url.endsWith('/settings')
        ? json(SETTINGS)
        : url.includes('/must-ships')
          ? failure(500, 'INTERNAL', 'internal server error')
          : json({ project, outcomes: [], tasks: [] })
    );
    renderRoute(`/projects/${project.id}`);
    const region = await screen.findByRole('region', { name: 'Must Ship candidates' });
    expect(await within(region).findByRole('alert')).toHaveTextContent('Could not load candidates: internal server error');
    expect(within(region).queryByText(/No candidates yet/)).toBeNull();
  });
});
