import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { openDb, initSchema } from '../../server/db/connection';
import { seed } from '../../server/db/seed';
import { createApp } from '../../server/app';
import { apiClient } from '../apiClient';

// Captured before any stub so the forwarding wrapper never calls itself.
const realFetch = globalThis.fetch;
let server: Server;

// apiClient requests same-origin '/api/...' paths (Vite proxies them in dev). Point those
// paths at a real in-process server so URLs, methods, bodies and status codes are all
// exercised against the actual routes rather than hand-written mock responses.
beforeEach(async () => {
  const db = openDb(':memory:');
  initSchema(db);
  seed(db);
  server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => realFetch(`${origin}${path}`, init));
});

afterEach(async () => {
  vi.unstubAllGlobals();
  server.closeAllConnections(); // fetch keeps connections alive, which would stall close()
  await new Promise((resolve) => server.close(resolve));
});

describe('apiClient users', () => {
  it('lists users with createdAt revived as a Date', async () => {
    const users = await apiClient.getUsers();
    expect(users.map((u) => u.uid)).toEqual(expect.arrayContaining(['user-1', 'user-2', 'user-3']));
    expect(users[0].createdAt).toBeInstanceOf(Date);
  });

  it('fetches one user by uid', async () => {
    const user = await apiClient.getUserById('user-2');
    expect(user?.displayName).toBe('Bob');
    expect(user?.createdAt).toBeInstanceOf(Date);
  });

  it('returns null for an unknown uid, matching the facade contract', async () => {
    expect(await apiClient.getUserById('nope')).toBeNull();
  });

  it('returns null for an empty uid instead of hitting the list route', async () => {
    expect(await apiClient.getUserById('')).toBeNull();
  });

  it('returns the seeded current user', async () => {
    expect((await apiClient.getCurrentUser())?.uid).toBe('user-1');
  });

  it('creates and updates a user', async () => {
    const created = await apiClient.createUser({ email: 'd@example.com', displayName: 'Dana', role: 'member' });
    expect(created.uid).toBeTruthy();
    expect(created.createdAt).toBeInstanceOf(Date);

    const updated = await apiClient.updateUser(created.uid, { workload: 12, lastLogin: new Date('2026-09-01T10:00:00Z') });
    expect(updated.workload).toBe(12);
    expect(updated.lastLogin).toEqual(new Date('2026-09-01T10:00:00Z'));
  });

  it('drops passwordHash, which has no server column, instead of failing with 400', async () => {
    const created = await apiClient.createUser({ email: 'e@example.com', displayName: 'Eve', role: 'member', passwordHash: 'h' });
    expect(created.uid).toBeTruthy();
    expect(created).not.toHaveProperty('passwordHash');

    const updated = await apiClient.updateUser('user-3', { passwordHash: 'h2', workload: 5 });
    expect(updated.workload).toBe(5);
  });

  it('soft-deletes a project owner so they drop out of the user list', async () => {
    // user-2 owns projects, so a hard delete would violate the owner foreign key.
    expect(await apiClient.deleteUser('user-2')).toBe(true);
    expect((await apiClient.getUserById('user-2'))?.isActive).toBe(false);
    expect((await apiClient.getUsers()).map((u) => u.uid)).not.toContain('user-2');
  });

  it('reports false when deleting a user that does not exist', async () => {
    expect(await apiClient.deleteUser('nope')).toBe(false);
  });
});

describe('apiClient projects', () => {
  it('lists projects with dates revived and null dates left null', async () => {
    const projects = await apiClient.getProjects();
    const proj3 = projects.find((p) => p.id === 'proj-3')!;
    expect(proj3.createdAt).toBeInstanceOf(Date);
    expect(proj3.dueDate ?? null).toBeNull();
  });

  it('creates a project from a name and owner', async () => {
    const project = await apiClient.createProject('Launch', 'user-1');
    expect(project.name).toBe('Launch');
    expect(project.members).toEqual(['user-1']);
    expect(project.updatedAt).toBeInstanceOf(Date);
  });

  it('keeps the extra fields the facade builds, but not a client-chosen id', async () => {
    const start = new Date('2026-10-01T00:00:00.000Z');
    const due = new Date('2026-12-31T00:00:00.000Z');
    const project = await apiClient.createProject('Launch', 'user-1', {
      id: 'client-id',
      description: 'Q4 launch',
      color: 'bg-pink-600',
      members: ['user-1', 'user-2'],
      sections: [{ id: 's1', name: 'Backlog', order: 0, color: 'bg-slate-500' }],
      startDate: start,
      dueDate: due,
    });
    expect(project.id).not.toBe('client-id');
    expect(project.description).toBe('Q4 launch');
    expect(project.color).toBe('bg-pink-600');
    expect(project.members).toEqual(['user-1', 'user-2']);
    expect(project.sections).toHaveLength(1);

    const listed = (await apiClient.getProjects()).find((p) => p.id === project.id)!;
    expect(listed.startDate).toEqual(start);
    expect(listed.dueDate).toEqual(due);
  });

  it('updates a project and revives its dates', async () => {
    const due = new Date('2027-01-15T00:00:00.000Z');
    const updated = await apiClient.updateProject('proj-3', { name: 'Renamed', dueDate: due });
    expect(updated.name).toBe('Renamed');
    expect(updated.dueDate).toEqual(due);
    expect(updated.updatedAt).toBeInstanceOf(Date);
  });

  it('deletes a project along with its tasks', async () => {
    expect(await apiClient.deleteProject('proj-3')).toBe(true);
    expect((await apiClient.getProjects()).map((p) => p.id)).not.toContain('proj-3');
    expect(await apiClient.getTasksForProject('proj-3')).toEqual([]);
    expect(await apiClient.deleteProject('proj-3')).toBe(false);
  });
});

describe('apiClient tasks', () => {
  it('lists a project\'s tasks in order with dates revived', async () => {
    const tasks = await apiClient.getTasksForProject('proj-1');
    expect(tasks.map((t) => t.id).sort()).toEqual(['task-1', 'task-2', 'task-3', 'task-8']);
    const task1 = tasks.find((t) => t.id === 'task-1')!;
    expect(task1.dueDate).toBeInstanceOf(Date);
    expect(task1.completedDate).toBeNull();
  });

  it('lists a user\'s assigned tasks', async () => {
    const tasks = await apiClient.getTasksForUser('user-2');
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks.every((t) => t.assigneeId === 'user-2')).toBe(true);
  });

  it('round-trips Date objects through create and update', async () => {
    const due = new Date('2026-10-01T09:30:00.000Z');
    const created = await apiClient.createTask({ title: 'Wire', projectId: 'proj-1', createdBy: 'user-1', dueDate: due });
    expect(created.dueDate).toEqual(due);

    const updated = await apiClient.updateTask(created.id, { status: 'Done', completedDate: due });
    expect(updated.status).toBe('Done');
    expect(updated.completedDate).toEqual(due);
    expect(updated.createdAt).toBeInstanceOf(Date);
  });

  it('revives scheduled work-block dates', async () => {
    const start = new Date('2026-10-02T09:00:00.000Z');
    const end = new Date('2026-10-02T11:00:00.000Z');
    const created = await apiClient.createTask({
      title: 'Block', projectId: 'proj-1', createdBy: 'user-1', scheduledStart: start, scheduledEnd: end,
    });
    const listed = (await apiClient.getTasksForProject('proj-1')).find((t) => t.id === created.id)!;
    expect(listed.scheduledStart).toEqual(start);
    expect(listed.scheduledEnd).toEqual(end);
  });

  it('deletes a task and reports false for one that does not exist', async () => {
    expect(await apiClient.deleteTask('task-1')).toBe(true);
    expect((await apiClient.getTasksForProject('proj-1')).map((t) => t.id)).not.toContain('task-1');
    expect(await apiClient.deleteTask('task-1')).toBe(false);
  });

  it('encodes ids so they cannot rewrite the request path', async () => {
    // Unencoded, '?' would turn '/tasks' into a query string and hit GET /users/user-2.
    expect(await apiClient.getTasksForUser('user-2?x=/')).toEqual([]);
  });
});

describe('apiClient errors', () => {
  it('rejects with the status and the server\'s error message', async () => {
    await expect(apiClient.createTask({ title: 'Orphan', projectId: 'ghost', createdBy: 'user-1' }))
      .rejects.toThrow(/POST \/tasks failed: 400 constraint violation/);
  });

  it('rejects on a missing task instead of returning null', async () => {
    await expect(apiClient.updateTask('does-not-exist', { title: 'x' })).rejects.toThrow(/404/);
  });

  it('rethrows non-404 failures from getUserById instead of returning null', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"error":"internal server error"}', { status: 500 }));
    await expect(apiClient.getUserById('user-1')).rejects.toThrow(/GET \/users\/user-1 failed: 500 internal server error/);
  });

  it('returns null from getCurrentUser when there is no current user', async () => {
    vi.stubGlobal('fetch', async () => new Response('{"error":"no seeded user"}', { status: 404 }));
    expect(await apiClient.getCurrentUser()).toBeNull();
  });

  it('rejects with the status when the error body is not JSON', async () => {
    vi.stubGlobal('fetch', async () => new Response('Bad Gateway', { status: 502 }));
    await expect(apiClient.getProjects()).rejects.toThrow(/GET \/projects failed: 502$/);
  });
});
