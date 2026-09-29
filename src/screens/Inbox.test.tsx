import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeTask } from '../test/fixtures';
import type { Project, Task } from '../shared/exec/schemas';

/** A fake /api/exec that keeps a task list in memory so processed rows really leave the list. */
function fakeApi(initial: Task[], projects: Project[] = []) {
  let store = [...initial];
  const calls = stubFetch((url, init) => {
    const method = init?.method ?? 'GET';
    const parsed = new URL(url, 'http://local');
    if (parsed.pathname.endsWith('/settings')) return json(SETTINGS);
    if (parsed.pathname.endsWith('/projects')) return json(projects);
    if (method === 'GET') {
      const statuses = (parsed.searchParams.get('status') ?? '').split(',');
      return json(store.filter((task) => statuses.includes(task.status)));
    }
    const id = parsed.pathname.split('/').at(-1) as string;
    if (method === 'DELETE') {
      store = store.filter((task) => task.id !== id);
      return json({ id });
    }
    const patch = JSON.parse(String(init?.body)) as Partial<Task>;
    store = store.map((task) => (task.id === id ? { ...task, ...patch } : task));
    return json(store.find((task) => task.id === id));
  });
  return { calls, current: () => store };
}

/** A fake /api/exec whose PATCH always fails, to check that write failures are reported. */
function fakeApiFailingPatch(initial: Task[]) {
  return {
    calls: stubFetch((url, init) => {
      const method = init?.method ?? 'GET';
      const parsed = new URL(url, 'http://local');
      if (parsed.pathname.endsWith('/settings')) return json(SETTINGS);
      if (parsed.pathname.endsWith('/projects')) return json([]);
      if (method === 'GET') {
        const statuses = (parsed.searchParams.get('status') ?? '').split(',');
        return json(initial.filter((task) => statuses.includes(task.status)));
      }
      if (method === 'PATCH') return failure(500, 'INTERNAL', 'internal server error');
      return json(initial[0]);
    }),
  };
}

const rows = () => within(screen.getByRole('listbox')).getAllByRole('option');
const patches = (calls: ReturnType<typeof fakeApi>['calls']) => calls.filter((c) => c.method === 'PATCH');

beforeEach(() => {
  // Tuesday 22 Sep 2026, 09:00 in Karachi; the planning week is 20–26 Sep.
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-22T04:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('/inbox', () => {
  it('lists captures newest first with the counter and the key legend', async () => {
    fakeApi([makeTask({ title: 'Newest', capturedAt: '2026-09-22T03:50:00.000Z' }), makeTask({ title: 'Older', capturedAt: '2026-09-22T02:00:00.000Z' })]);
    renderRoute('/inbox');
    expect(await screen.findByText('2 to process')).toBeInTheDocument();
    expect(rows().map((row) => row.textContent)).toEqual([expect.stringContaining('Newest'), expect.stringContaining('Older')]);
    expect(rows()[0]).toHaveAttribute('aria-selected', 'true');
    expect(rows()[0]).toHaveTextContent('10 min ago');
    expect(screen.getByText(/T this week/)).toBeInTheDocument();
  });

  it('T commits the selected row to this week and it leaves the inbox', async () => {
    const api = fakeApi([makeTask({ title: 'A' }), makeTask({ title: 'B' })]);
    renderRoute('/inbox');
    await screen.findByText('2 to process');
    await userEvent.keyboard('t');
    await waitFor(() => expect(screen.getByText('1 to process')).toBeInTheDocument());
    expect(patches(api.calls)[0]).toMatchObject({ url: `/api/exec/tasks/${api.current()[0].id}`, body: { status: 'this_week' } });
    expect(rows().map((row) => row.textContent)).toEqual([expect.stringContaining('B')]);
  });

  it('a server failure on a key is reported, not swallowed', async () => {
    fakeApiFailingPatch([makeTask({ title: 'Stubborn' })]);
    renderRoute('/inbox');
    await screen.findByText('1 to process');
    await userEvent.keyboard('t');
    expect(await screen.findByRole('status')).toHaveTextContent('Could not update: internal server error');
    expect(screen.getByText('1 to process')).toBeInTheDocument();
  });

  it('j moves the selection down and L parks that row for later', async () => {
    const api = fakeApi([makeTask({ title: 'A' }), makeTask({ title: 'B' })]);
    renderRoute('/inbox');
    await screen.findByText('2 to process');
    await userEvent.keyboard('j');
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.keyboard('l');
    await waitFor(() => expect(screen.getByText('1 to process')).toBeInTheDocument());
    expect(patches(api.calls)[0].body).toEqual({ status: 'later' });
    expect(api.current().find((t) => t.title === 'B')?.status).toBe('later');
  });

  it('X deletes an inbox item and the empty inbox says so', async () => {
    const api = fakeApi([makeTask({ title: 'Oops' })]);
    renderRoute('/inbox');
    await screen.findByText('1 to process');
    await userEvent.keyboard('x');
    await waitFor(() => expect(screen.getByText('Inbox zero.')).toBeInTheDocument());
    expect(api.calls.find((c) => c.method === 'DELETE')?.url).toMatch(/\/api\/exec\/tasks\//);
  });

  it('D asks for an owner, defaults the follow-up to tomorrow and delegates', async () => {
    const api = fakeApi([makeTask({ title: 'Send the tracker' })]);
    renderRoute('/inbox');
    await screen.findByText('1 to process');
    await userEvent.keyboard('d');
    const form = await screen.findByRole('form', { name: 'Delegate Send the tracker' });
    expect(within(form).getByLabelText('Follow up on')).toHaveValue('2026-09-23');
    await userEvent.click(within(form).getByRole('button', { name: 'Delegate' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Owner is required');
    expect(patches(api.calls)).toHaveLength(0);
    await userEvent.type(within(form).getByLabelText('Owner'), 'Bilal');
    await userEvent.type(within(form).getByLabelText('Expected output'), 'The tracker in the shared drive');
    await userEvent.click(within(form).getByRole('button', { name: 'Delegate' }));
    await waitFor(() => expect(patches(api.calls)).toHaveLength(1));
    expect(patches(api.calls)[0].body).toEqual({
      status: 'delegated',
      ownerName: 'Bilal',
      expectedOutput: 'The tracker in the shared drive',
      followUpDate: '2026-09-23',
    });
    await waitFor(() => expect(screen.getByText('Inbox zero.')).toBeInTheDocument());
  });

  it('a cleared follow-up date is refused', async () => {
    const api = fakeApi([makeTask({ title: 'Send the tracker' })]);
    renderRoute('/inbox');
    await screen.findByText('1 to process');
    await userEvent.keyboard('d');
    const form = await screen.findByRole('form', { name: 'Delegate Send the tracker' });
    await userEvent.type(within(form).getByLabelText('Owner'), 'Bilal');
    await userEvent.clear(within(form).getByLabelText('Follow up on'));
    await userEvent.click(within(form).getByRole('button', { name: 'Delegate' }));
    expect(within(form).getByRole('alert')).toHaveTextContent('Follow-up date is required');
    expect(patches(api.calls)).toHaveLength(0);
  });

  it('typing in a panel never triggers the list keys', async () => {
    const api = fakeApi([makeTask({ title: 'Keep me' })]);
    renderRoute('/inbox');
    await screen.findByText('1 to process');
    await userEvent.keyboard('d');
    await userEvent.type(await screen.findByLabelText('Owner'), 'x');
    expect(api.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    expect(screen.getByText('1 to process')).toBeInTheDocument();
  });

  it('S commits a date inside the week and parks a date beyond it', async () => {
    const api = fakeApi([makeTask({ title: 'Soon' }), makeTask({ title: 'Far' })]);
    renderRoute('/inbox');
    await screen.findByText('2 to process');
    await userEvent.keyboard('s');
    let form = await screen.findByRole('form', { name: 'Schedule Soon' });
    expect(within(form).getByLabelText('On')).toHaveValue('2026-09-23');
    await userEvent.click(within(form).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(patches(api.calls)).toHaveLength(1));
    expect(patches(api.calls)[0].body).toEqual({ status: 'this_week', scheduledDate: '2026-09-23' });
    await screen.findByText('1 to process');
    await userEvent.keyboard('s');
    form = await screen.findByRole('form', { name: 'Schedule Far' });
    await userEvent.clear(within(form).getByLabelText('On'));
    await userEvent.type(within(form).getByLabelText('On'), '2026-10-05');
    await userEvent.click(within(form).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(patches(api.calls)).toHaveLength(2));
    expect(patches(api.calls)[1].body).toEqual({ status: 'later', scheduledDate: '2026-10-05' });
  });

  it('P explains that projects arrive later, or assigns one and parks the item', async () => {
    const project: Project = {
      id: '11111111-1111-4111-8111-111111111111',
      name: 'September supply plan',
      context: 'work',
      status: 'active',
      notes: '',
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-20T00:00:00.000Z',
    };
    const api = fakeApi([makeTask({ title: 'Analyse open POs' })], [project]);
    renderRoute('/inbox');
    await screen.findByText('1 to process');
    await userEvent.keyboard('p');
    await userEvent.click(await screen.findByRole('button', { name: 'September supply plan' }));
    await waitFor(() => expect(patches(api.calls)).toHaveLength(1));
    expect(patches(api.calls)[0].body).toEqual({ projectId: project.id, status: 'later' });
  });

  it('P with no projects shows the empty state', async () => {
    fakeApi([makeTask({ title: 'x' })]);
    renderRoute('/inbox');
    await screen.findByText('1 to process');
    await userEvent.keyboard('p');
    expect(await screen.findByText('No projects yet. Projects arrive in Phase 3.')).toBeInTheDocument();
  });

  it('the Later tab lists parked items and refuses to delete them', async () => {
    const api = fakeApi([makeTask({ title: 'Parked', status: 'later' })]);
    renderRoute('/inbox');
    await screen.findByText('Inbox zero.');
    await userEvent.click(screen.getByRole('tab', { name: 'Later' }));
    expect(await screen.findByText('1 parked')).toBeInTheDocument();
    expect(api.calls.some((c) => c.url === '/api/exec/tasks?status=later')).toBe(true);
    await userEvent.keyboard('x');
    expect(await screen.findByRole('status')).toHaveTextContent('Only an inbox item can be deleted.');
    expect(api.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
  });

  it('L on the Later tab explains itself', async () => {
    fakeApi([makeTask({ title: 'Parked', status: 'later' })]);
    renderRoute('/inbox');
    await screen.findByText('Inbox zero.');
    await userEvent.click(screen.getByRole('tab', { name: 'Later' }));
    await screen.findByText('1 parked');
    await userEvent.keyboard('l');
    expect(await screen.findByRole('status')).toHaveTextContent('This item is already parked.');
  });

  it('the row buttons do what the keys do', async () => {
    const api = fakeApi([makeTask({ title: 'Click me' })]);
    renderRoute('/inbox');
    await screen.findByText('1 to process');
    await userEvent.click(screen.getByRole('button', { name: 'This week (T)' }));
    await waitFor(() => expect(patches(api.calls)[0]?.body).toEqual({ status: 'this_week' }));
  });
  it('starts the selection at the first row when the tab changes', async () => {
    fakeApi([makeTask({ title: 'A' }), makeTask({ title: 'B' }), makeTask({ title: 'P1', status: 'later' }), makeTask({ title: 'P2', status: 'later' })]);
    renderRoute('/inbox');
    await screen.findByText('2 to process');
    await userEvent.keyboard('j');
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Later' }));
    await screen.findByText('2 parked');
    expect(rows()[0]).toHaveAttribute('aria-selected', 'true');
  });
});
