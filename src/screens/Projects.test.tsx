import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeProjectSummary } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('/projects', () => {
  it('lists work and build projects apart, with counts and links', async () => {
    const supply = makeProjectSummary({ name: 'Supply plan', activeOutcomes: 1, openTasks: 3 });
    const pinkbox = makeProjectSummary({ name: 'Pinkbox', context: 'build', status: 'done' });
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : json([supply, pinkbox])));
    renderRoute('/projects');
    const work = await screen.findByRole('region', { name: 'Work' });
    expect(within(work).getByRole('link', { name: 'Supply plan' })).toHaveAttribute('href', `/projects/${supply.id}`);
    expect(work).toHaveTextContent('1 outcome · 3 open tasks');
    const build = screen.getByRole('region', { name: 'Build' });
    expect(within(build).getByRole('link', { name: 'Pinkbox' })).toBeInTheDocument();
    expect(build).toHaveTextContent('Done');
  });

  it('creates a project in the chosen context', async () => {
    const calls = stubFetch((url, init) => (url.endsWith('/settings') ? json(SETTINGS) : init?.method === 'POST' ? json(makeProjectSummary(), 201) : json([])));
    renderRoute('/projects');
    expect(await screen.findByText('No work projects yet.')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Project name' }), 'Healify launch');
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/projects', body: { name: 'Healify launch', context: 'build' } }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue(''));
  });
});
