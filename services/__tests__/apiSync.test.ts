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

const SEEDED_TASK_IDS = ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6', 'task-7', 'task-8'];
const task = (id: string) => store.tasks.find((t) => t.id === id)!;
const dbTask = (id: string) => live.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as any;
const dbTaskCount = () => (live.db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n;
const writes = () => live.calls.filter((c) => c.method !== 'GET');
const ready = async () => {
  const sync = createApiSync(store);
  await sync.ensureApi();
  return sync;
};
const networkDown = () => Promise.reject(new TypeError('fetch failed'));

// Forwards to the live API, except for requests matching `fail`, which reject like a dropped connection.
const failWhen = (fail: (path: string, init?: RequestInit) => boolean) => {
  const forward = globalThis.fetch;
  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => (fail(path, init) ? networkDown() : forward(path, init)));
  return () => vi.stubGlobal('fetch', forward);
};

// Runs `during` once, the first time a request matching `when` is sent, then forwards it.
const interceptOnce = (when: (path: string, init?: RequestInit) => boolean, during: () => void) => {
  const forward = globalThis.fetch;
  let done = false;
  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => {
    if (!done && when(path, init)) {
      done = true;
      during();
    }
    return forward(path, init);
  });
};

describe('createApiSync loading', () => {
  it('loads users, projects and tasks into the existing arrays', async () => {
    const demoUsers = [{ uid: 'demo' } as User];
    store = { users: demoUsers, projects: [], tasks: [] };
    const sync = createApiSync(store);

    expect(await sync.ensureApi()).toBe(true);
    expect(store.users).toBe(demoUsers); // same array, so the facade's references stay valid
    expect(store.users.map((u) => u.uid).sort()).toEqual(['user-1', 'user-2', 'user-3']);
    expect(store.projects).toHaveLength(5);
    expect(store.tasks.map((t) => t.id).sort()).toEqual(SEEDED_TASK_IDS);
    expect(task('task-1').dueDate).toBeInstanceOf(Date);
    expect(sync.isActive()).toBe(true);
    expect(sync.currentUserId()).toBe('user-1');
  });

  it('keeps the demo data and never writes when the API is unreachable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const unreachable = vi.fn(networkDown);
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

  it('retries a failed load once the backoff has passed', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const restore = failWhen(() => true);
    const sync = createApiSync(store, { retryLoadAfterMs: 0 });
    expect(await sync.ensureApi()).toBe(false);

    restore();
    expect(await sync.ensureApi()).toBe(true);
    expect(store.tasks).toHaveLength(8);
  });

  it('does not retry a failed load within the backoff window', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const restore = failWhen(() => true);
    const sync = createApiSync(store, { retryLoadAfterMs: 60_000 });
    expect(await sync.ensureApi()).toBe(false);

    restore();
    expect(await sync.ensureApi()).toBe(false);
    expect(store.tasks).toEqual([]);
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

  it('rewrites references to a new user once it has a server id', async () => {
    const sync = await ready();
    store.users.push({
      uid: 'user-local', email: 'n@example.com', displayName: 'N', role: 'member', isActive: true, createdAt: new Date(),
    } as User);
    task('task-1').assigneeId = 'user-local';
    task('task-1').collaboratorIds = ['user-local'];

    await sync.persist();

    const user = store.users.find((u) => u.email === 'n@example.com')!;
    expect(user.uid).not.toBe('user-local');
    expect(task('task-1').assigneeId).toBe(user.uid);
    expect(task('task-1').collaboratorIds).toEqual([user.uid]);
    expect(dbTask('task-1').assignee_id).toBe(user.uid);
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

  it('serialises overlapping saves so a new record is created exactly once', async () => {
    const sync = await ready();
    store.tasks.push({ id: 'task-new', title: 'New', projectId: 'proj-1', createdBy: 'user-1' } as Task);

    await Promise.all([sync.persist(), sync.persist()]);

    expect(writes().filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(dbTaskCount()).toBe(9);
  });

  it('keeps a change made while an earlier save of the same field is in flight', async () => {
    const sync = await ready();
    interceptOnce((_path, init) => init?.method === 'PATCH', () => { task('task-1').title = 'Second'; });

    task('task-1').title = 'First';
    await sync.persist();
    expect(task('task-1').title).toBe('Second');

    await sync.persist();
    expect(dbTask('task-1').title).toBe('Second');
  });

  it('gives the server id to the current object when the record was replaced during its create', async () => {
    const sync = await ready();
    interceptOnce((_path, init) => init?.method === 'POST', () => {
      const i = store.tasks.findIndex((t) => t.id === 'task-new');
      store.tasks[i] = { ...store.tasks[i], title: 'Edited' };
    });
    store.tasks.push({ id: 'task-new', title: 'New', projectId: 'proj-1', createdBy: 'user-1' } as Task);

    await sync.persist();

    const created = store.tasks.find((t) => t.title === 'Edited')!;
    expect(created.id).not.toBe('task-new');
    expect(dbTask(created.id).title).toBe('Edited');
    expect(dbTaskCount()).toBe(9);
  });
});

describe('createApiSync failed saves are rolled back', () => {
  it('rolls back a change the server rejects and reports it', async () => {
    const sync = await ready();
    const original = task('task-1').title;
    (task('task-1') as any).title = null;

    await expect(sync.persist()).rejects.toThrow(/task-1.*400/);
    expect(task('task-1').title).toBe(original);

    await sync.persist();
    expect(writes()).toHaveLength(1);
  });

  it('rolls back a change whose save fails on the network, instead of retrying it later', async () => {
    const sync = await ready();
    const original = task('task-1').title;
    const restore = failWhen(() => true);

    task('task-1').title = 'Offline edit';
    await expect(sync.persist()).rejects.toThrow(/task-1.*fetch failed/);
    expect(task('task-1').title).toBe(original);

    restore();
    await sync.persist();
    expect(writes()).toEqual([]);
  });

  it('rolls back a change the server fails on with a 5xx', async () => {
    const sync = await ready();
    const original = task('task-1').title;
    vi.stubGlobal('fetch', async () => new Response('{"error":"internal server error"}', { status: 500 }));

    task('task-1').title = 'Unlucky';
    await expect(sync.persist()).rejects.toThrow(/task-1.*500/);
    expect(task('task-1').title).toBe(original);
  });

  it('drops a new record the server rejects', async () => {
    const sync = await ready();
    store.tasks.push({ id: 'task-orphan', title: 'Orphan', projectId: 'ghost', createdBy: 'user-1' } as Task);

    await expect(sync.persist()).rejects.toThrow(/task-orphan.*400/);
    expect(store.tasks.some((t) => t.id === 'task-orphan')).toBe(false);
  });

  it('drops a new record whose create fails on the network, so a retry cannot duplicate it', async () => {
    const sync = await ready();
    const restore = failWhen((_path, init) => init?.method === 'POST');
    store.tasks.push({ id: 'task-new', title: 'New', projectId: 'proj-1', createdBy: 'user-1' } as Task);

    await expect(sync.persist()).rejects.toThrow(/task-new.*fetch failed/);
    expect(store.tasks.some((t) => t.id === 'task-new')).toBe(false);

    restore();
    await sync.persist();
    expect(writes()).toEqual([]);
    expect(dbTaskCount()).toBe(8);
  });

  it('removes only the rejected record when it was replaced during its save', async () => {
    const sync = await ready();
    interceptOnce((_path, init) => init?.method === 'POST', () => {
      const i = store.tasks.findIndex((t) => t.id === 'task-orphan');
      store.tasks[i] = { ...store.tasks[i] };
    });
    // At index 0, so removing "the item at indexOf(stale object)" would hit a seeded task instead.
    store.tasks.unshift({ id: 'task-orphan', title: 'Orphan', projectId: 'ghost', createdBy: 'user-1' } as Task);

    await expect(sync.persist()).rejects.toThrow(/task-orphan.*400/);

    expect(store.tasks.map((t) => t.id).sort()).toEqual(SEEDED_TASK_IDS);
    expect(dbTaskCount()).toBe(8);
  });

  it('rolls back on the current object when it was replaced during the save', async () => {
    const sync = await ready();
    const original = task('task-1').title;
    interceptOnce((_path, init) => init?.method === 'PATCH', () => {
      const i = store.tasks.indexOf(task('task-1'));
      store.tasks[i] = { ...store.tasks[i], description: 'Valid edit' };
    });

    (task('task-1') as any).title = null;
    await expect(sync.persist()).rejects.toThrow(/task-1.*400/);
    expect(task('task-1').title).toBe(original);
    expect(task('task-1').description).toBe('Valid edit');

    await sync.persist();
    expect(dbTask('task-1')).toMatchObject({ title: original, description: 'Valid edit' });
  });

  it('restores a record whose delete fails', async () => {
    const sync = await ready();
    const restore = failWhen((_path, init) => init?.method === 'DELETE');
    store.tasks.splice(store.tasks.indexOf(task('task-1')), 1);

    await expect(sync.persist()).rejects.toThrow(/task-1.*fetch failed/);
    expect(task('task-1')).toBeDefined();
    expect(dbTask('task-1')).toBeDefined();

    restore();
    await sync.persist();
    expect(writes()).toEqual([]);
  });

  it('drops the children of a new parent whose create failed, leaving nothing half-saved', async () => {
    const sync = await ready();
    failWhen((path, init) => init?.method === 'POST' && path === '/api/projects');
    store.projects.push({ id: 'proj-new', name: 'Parent', ownerId: 'user-1', members: ['user-1'] } as unknown as Project);
    store.tasks.push({ id: 'task-child', title: 'Child', projectId: 'proj-new', createdBy: 'user-1' } as Task);

    await expect(sync.persist()).rejects.toThrow(/proj-new.*fetch failed/);

    expect(store.projects.some((p) => p.id === 'proj-new')).toBe(false);
    expect(store.tasks.some((t) => t.id === 'task-child')).toBe(false);
    expect(dbTaskCount()).toBe(8);
  });
});

describe('withApiSync', () => {
  it('waits for loading before an async call and saves its changes after', async () => {
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

  it('does not save or fail on get* reads', async () => {
    const api = withApiSync({ getTitle: async () => task('task-1').title }, createApiSync(store));
    await api.getTitle(); // loads

    failWhen(() => true);
    task('task-1').title = 'Changed outside the facade';
    await expect(api.getTitle()).resolves.toBe('Changed outside the facade');
  });

  it('does not save when the wrapped method throws', async () => {
    const api = withApiSync({
      failHalfway: async () => {
        task('task-1').title = 'Half done';
        throw new Error('boom');
      },
    }, createApiSync(store));

    await expect(api.failHalfway()).rejects.toThrow('boom');
    expect(writes()).toEqual([]);
  });

  it('rejects only the call whose change failed when saves overlap', async () => {
    let other: Promise<unknown> | undefined;
    const api = withApiSync({
      renameProject: async () => { store.projects.find((p) => p.id === 'proj-1')!.name = 'Renamed'; },
      breakTitle: async () => { (task('task-1') as any).title = null; },
    }, createApiSync(store));
    // The task change starts while the project save is in flight, so both land in that save.
    interceptOnce((path, init) => init?.method === 'PATCH' && path === '/api/projects/proj-1', () => {
      other = api.breakTitle();
    });

    await expect(api.renameProject()).resolves.toBeUndefined();
    await expect(other).rejects.toThrow(/task-1.*400/);
    expect(task('task-1').title).not.toBeNull();
  });

  it('keeps a valid edit to another field made while a rejected save of the same record is in flight', async () => {
    let other: Promise<unknown> | undefined;
    const api = withApiSync({
      breakTitle: async () => { (task('task-1') as any).title = null; },
      describe: async () => {
        const i = store.tasks.indexOf(task('task-1'));
        store.tasks[i] = { ...store.tasks[i], description: 'Valid edit' }; // replaces the object, as updateTask does
      },
    }, createApiSync(store));
    // The description edit starts while the rejected title save is in flight.
    interceptOnce((path, init) => init?.method === 'PATCH' && path === '/api/tasks/task-1', () => {
      other = api.describe();
    });

    const original = dbTask('task-1').title;
    await expect(api.breakTitle()).rejects.toThrow(/task-1.*400/);
    await expect(other).resolves.toBeUndefined();

    expect(task('task-1').title).toBe(original);
    expect(task('task-1').description).toBe('Valid edit');
    expect(dbTask('task-1')).toMatchObject({ title: original, description: 'Valid edit' });
  });
});
