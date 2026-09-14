import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Project, Task, User } from '../../types';
import { startLiveApi, type LiveApi } from './support/liveApi';
import { createApiSync, withApiSync, type SyncStore } from '../apiSync';

let live: LiveApi;
let store: SyncStore;

beforeEach(async () => {
  live = await startLiveApi();
  store = { users: [], projects: [], tasks: [] };
});

afterEach(() => live.stop());

const task = (id: string) => store.tasks.find((t) => t.id === id)!;
const dbTask = (id: string) => live.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
const writes = () => live.calls.filter((c) => c.method !== 'GET');
const ready = async () => {
  const sync = createApiSync(store);
  await sync.ensureApi();
  return sync;
};

describe('createApiSync hydration', () => {
  it('loads users, projects and tasks into the existing arrays', async () => {
    const demoUsers = [{ uid: 'demo' } as User];
    store = { users: demoUsers, projects: [], tasks: [] };
    const sync = createApiSync(store);

    expect(await sync.ensureApi()).toBe(true);
    expect(store.users).toBe(demoUsers); // same array, so the facade's references stay valid
    expect(store.users.map((u) => u.uid).sort()).toEqual(['user-1', 'user-2', 'user-3']);
    expect(store.projects).toHaveLength(5);
    expect(store.tasks.map((t) => t.id).sort()).toEqual(
      ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6', 'task-7', 'task-8']
    );
    expect(task('task-1').dueDate).toBeInstanceOf(Date);
    expect(sync.isActive()).toBe(true);
    expect(sync.currentUserId()).toBe('user-1');
  });

  it('keeps the demo data and never writes when the API is unreachable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unreachable = vi.fn(async () => { throw new TypeError('fetch failed'); });
    vi.stubGlobal('fetch', unreachable);
    store.tasks.push({ id: 'demo-task', title: 'Demo' } as Task);
    const sync = createApiSync(store);

    expect(await sync.ensureApi()).toBe(false);
    expect(sync.isActive()).toBe(false);
    const probes = unreachable.mock.calls.length;

    store.tasks[0].title = 'Changed';
    await sync.persist();
    expect(store.tasks.map((t) => t.id)).toEqual(['demo-task']);
    expect(unreachable).toHaveBeenCalledTimes(probes);
  });

  it('loads only once, even for concurrent callers', async () => {
    const sync = createApiSync(store);
    const results = await Promise.all([sync.ensureApi(), sync.ensureApi()]);
    expect(results).toEqual([true, true]);
    expect(live.calls.filter((c) => c.path === '/api/projects')).toHaveLength(1);
  });
});

describe('createApiSync persist', () => {
  it('makes no writes when nothing has changed', async () => {
    const sync = await ready();
    await sync.persist();
    expect(writes()).toEqual([]);
  });

  it('patches only the fields that changed', async () => {
    const sync = await ready();
    task('task-1').title = 'Renamed';
    task('task-1').order = 7;
    await sync.persist();

    expect(writes()).toEqual([
      { method: 'PATCH', path: '/api/tasks/task-1', body: { title: 'Renamed', order: 7 } },
    ]);
    expect(dbTask('task-1')).toMatchObject({ title: 'Renamed', order: 7 });
  });

  it('sends null for a field that was cleared', async () => {
    const sync = await ready();
    task('task-1').sectionId = 'sec-101';
    await sync.persist();
    task('task-1').sectionId = undefined;
    await sync.persist();

    expect(writes()[1]).toEqual({ method: 'PATCH', path: '/api/tasks/task-1', body: { sectionId: null } });
    expect(dbTask('task-1').section_id).toBeNull();
  });

  it('ignores updatedAt, which the server always overwrites, so saves never loop', async () => {
    const sync = await ready();
    task('task-1').updatedAt = new Date(0);
    await sync.persist();
    expect(writes()).toEqual([]);

    task('task-1').title = 'Once';
    await sync.persist();
    await sync.persist();
    expect(writes()).toHaveLength(1);
  });

  it('adopts the server-normalised value so the same save is not repeated', async () => {
    const sync = await ready();
    (task('task-1') as any).dueDate = '2026-10-01T09:00:00+05:00';
    await sync.persist();
    expect(task('task-1').dueDate).toEqual(new Date('2026-10-01T04:00:00.000Z'));

    await sync.persist();
    expect(writes()).toHaveLength(1);
  });

  it('creates new records and rewrites references to their local ids', async () => {
    const sync = await ready();
    const project = {
      id: 'proj-local', name: 'Local', ownerId: 'user-1', members: ['user-1'],
      statusUpdates: [{
        id: 'su-1', projectId: 'proj-local', authorId: 'user-1', status: 'on_track',
        title: 'Kickoff', summary: '', createdAt: new Date(),
      }],
    } as unknown as Project;
    const blocked = {
      id: 'task-local-2', title: 'Blocked', projectId: 'proj-local', createdBy: 'user-1',
      blockedBy: ['task-local'], dependencies: ['task-local'],
    } as unknown as Task;
    const blocker = { id: 'task-local', title: 'Blocker', projectId: 'proj-local', createdBy: 'user-1' } as Task;
    store.projects.push(project);
    store.tasks.push(blocked, blocker); // the dependent is created first, before its blocker has a server id

    await sync.persist();

    expect(project.id).not.toBe('proj-local');
    expect(project.statusUpdates![0].projectId).toBe(project.id);
    expect(blocker.id).not.toBe('task-local');
    expect(blocker.projectId).toBe(project.id);
    expect(blocked.blockedBy).toEqual([blocker.id]);
    expect(blocked.dependencies).toEqual([blocker.id]);
    expect(dbTask(blocked.id)).toMatchObject({ project_id: project.id, blocked_by: JSON.stringify([blocker.id]) });

    const before = writes().length;
    await sync.persist();
    expect(writes()).toHaveLength(before);
  });

  it('deletes removed tasks and projects, and deactivates removed users', async () => {
    const sync = await ready();
    store.tasks.splice(store.tasks.indexOf(task('task-1')), 1);
    // proj-3 together with its only task, as the facade's deleteProject does
    store.projects.splice(store.projects.findIndex((p) => p.id === 'proj-3'), 1);
    store.tasks.splice(store.tasks.indexOf(task('task-6')), 1);
    // user-2 owns projects, so the user must be deactivated rather than deleted
    store.users.splice(store.users.findIndex((u) => u.uid === 'user-2'), 1);

    await sync.persist();

    expect(dbTask('task-1')).toBeUndefined();
    expect(dbTask('task-6')).toBeUndefined();
    expect(live.db.prepare("SELECT id FROM projects WHERE id = 'proj-3'").get()).toBeUndefined();
    expect(live.db.prepare("SELECT is_active FROM users WHERE uid = 'user-2'").get()).toEqual({ is_active: 0 });

    const before = writes().length;
    await sync.persist();
    expect(writes()).toHaveLength(before);
  });

  it('rolls back a change the server rejects and reports it', async () => {
    const sync = await ready();
    const original = task('task-1').title;
    (task('task-1') as any).title = null;

    await expect(sync.persist()).rejects.toThrow(/task-1.*400/);
    expect(task('task-1').title).toBe(original);

    await sync.persist();
    expect(writes()).toHaveLength(1);
  });

  it('drops a new record the server rejects', async () => {
    const sync = await ready();
    store.tasks.push({ id: 'task-orphan', title: 'Orphan', projectId: 'ghost', createdBy: 'user-1' } as Task);

    await expect(sync.persist()).rejects.toThrow(/task-orphan.*400/);
    expect(store.tasks.some((t) => t.id === 'task-orphan')).toBe(false);
  });

  it('keeps a change made while an earlier save of the same field is in flight', async () => {
    const sync = await ready();
    const forward = globalThis.fetch;
    vi.stubGlobal('fetch', (path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') task('task-1').title = 'Second';
      return forward(path, init);
    });

    task('task-1').title = 'First';
    await sync.persist();
    expect(task('task-1').title).toBe('Second');

    await sync.persist();
    expect(dbTask('task-1').title).toBe('Second');
  });

  it('retries an unsaved change on the next save after a network failure', async () => {
    const sync = await ready();
    const forward = globalThis.fetch;
    vi.stubGlobal('fetch', async () => { throw new TypeError('fetch failed'); });

    task('task-1').title = 'Offline edit';
    await expect(sync.persist()).rejects.toThrow(/task-1.*fetch failed/);
    expect(task('task-1').title).toBe('Offline edit'); // nothing was rejected, so nothing is rolled back

    vi.stubGlobal('fetch', forward);
    await sync.persist();
    expect(dbTask('task-1').title).toBe('Offline edit');
  });

  it('serialises overlapping saves so a new record is created exactly once', async () => {
    const sync = await ready();
    store.tasks.push({ id: 'task-new', title: 'New', projectId: 'proj-1', createdBy: 'user-1' } as Task);

    await Promise.all([sync.persist(), sync.persist()]);

    expect(writes().filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(live.db.prepare('SELECT COUNT(*) AS n FROM tasks').get()).toEqual({ n: 9 });
  });
});

describe('withApiSync', () => {
  it('waits for hydration before an async call and saves its changes after', async () => {
    const api = withApiSync({
      countTasks: async () => store.tasks.length,
      rename: async (id: string, title: string) => {
        task(id).title = title;
        return 'renamed';
      },
    }, createApiSync(store));

    expect(await api.countTasks()).toBe(8);
    expect(await api.rename('task-1', 'Wrapped')).toBe('renamed');
    expect(dbTask('task-1').title).toBe('Wrapped');
  });

  it('passes synchronous methods through without waiting or saving', () => {
    const api = withApiSync({ subscribe: () => 'unsubscribe' }, createApiSync(store));
    expect(api.subscribe()).toBe('unsubscribe');
    expect(live.calls).toEqual([]);
  });

  it('rejects the call when saving its changes fails', async () => {
    const api = withApiSync({
      breakTitle: async () => { (task('task-1') as any).title = null; },
    }, createApiSync(store));

    await expect(api.breakTitle()).rejects.toThrow(/task-1.*400/);
  });
});
