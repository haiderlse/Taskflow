import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TaskRecurrence } from '../../types';
import { startLiveApi, type LiveApi } from './support/liveApi';

let live: LiveApi;

// enhancedApi keeps its cache in module state, so a fresh import behaves like a page reload.
const loadFacade = async () => {
  vi.resetModules();
  const { enhancedApi } = await import('../enhancedApi');
  const { notificationService } = await import('../notificationService');
  const { mockApi } = await import('../mockApi');
  return { api: enhancedApi, notifications: notificationService, mockApi };
};
const reload = async () => (await loadFacade()).api;

beforeEach(async () => {
  // notificationService logs about the missing localStorage when run under Node.
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  live = await startLiveApi();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await live.stop();
});

describe('enhancedApi backed by the local API', () => {
  it('loads the workspace from the database rather than the demo arrays', async () => {
    live.db.prepare("UPDATE projects SET name = 'From SQLite' WHERE id = 'proj-1'").run();
    const { api } = await loadFacade();

    expect((await api.getProjects()).find((p) => p.id === 'proj-1')?.name).toBe('From SQLite');
    expect(await api.getTasks()).toHaveLength(8);
    expect((await api.getCurrentUser()).uid).toBe('user-1');
  });

  it('keeps the mockApi shim bound to the synced facade', async () => {
    const { api, mockApi } = await loadFacade();
    expect(mockApi.updateTask).toBe(api.updateTask);
  });

  it('persists a created task under its server id and notifies with that id', async () => {
    const { api, notifications } = await loadFacade();
    const notifiedIds: string[] = [];
    vi.spyOn(notifications, 'notifyTaskAssignment').mockImplementation((task) => {
      notifiedIds.push(task.id); // captured now: the task object itself is updated later
      return undefined as never;
    });

    const created = await api.createTask('Ship it', 'proj-1', 'To Do', { createdBy: 'user-1', assigneeId: 'user-2' });

    expect(created.id).not.toMatch(/^task-/);
    expect(notifiedIds).toEqual([created.id]);
    expect((await (await reload()).getTaskById(created.id))?.title).toBe('Ship it');
  });

  it('persists both sides of a new dependency', async () => {
    const { api } = await loadFacade();
    await api.addDependency('task-4', 'task-6');

    const reloaded = await reload();
    expect((await reloaded.getTaskById('task-4'))?.blockedBy).toContain('task-6');
    expect((await reloaded.getTaskById('task-6'))?.blocking).toContain('task-4');
  });

  it('persists a drag between columns, including the renumbered neighbours', async () => {
    const { api } = await loadFacade();
    await api.updateTaskOrder('proj-1', 'task-3', 'In Progress', 0);

    const inProgress = (await (await reload()).getTasksForProject('proj-1'))
      .filter((t) => t.status === 'In Progress')
      .sort((a, b) => a.order - b.order);
    expect(inProgress[0].id).toBe('task-3');
    expect(inProgress.map((t) => t.order)).toEqual([0, 1, 2]);
  });

  it('persists edits to a project that was created through the API', async () => {
    const { api } = await loadFacade();
    const project = await api.createProject('Launch', 'user-1');
    expect(project.id).not.toMatch(/^proj-/);

    await api.updateProject(project.id, { name: 'Launch v2' });
    await api.addProjectSection(project.id, 'QA');
    await api.updateProjectBrief(project.id, { overview: 'Ship v2' });
    await api.addStatusUpdate(project.id, { title: 'Slipping', status: 'at_risk', authorId: 'user-1' });

    const reloaded = (await (await reload()).getProjects()).find((p) => p.id === project.id)!;
    expect(reloaded.name).toBe('Launch v2');
    expect(reloaded.sections!.map((s) => s.name)).toEqual(['To Do', 'In Progress', 'Done', 'QA']);
    expect(reloaded.brief?.overview).toBe('Ship v2');
    expect(reloaded.statusUpdates![0]).toMatchObject({ title: 'Slipping', projectId: project.id });
    expect(reloaded.healthStatus).toBe('at_risk');
  });

  it('creates a project from a template with its tasks linked to the server project id', async () => {
    const { api } = await loadFacade();
    const template = (await api.getTemplates())[0];
    const project = await api.createProjectFromTemplate(template.id, 'From template', 'user-1');

    const reloaded = await reload();
    const tasks = await reloaded.getTasksForProject(project.id);
    expect(project.id).not.toMatch(/^proj-/);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks).toHaveLength(template.sampleTasks.length);
    expect(tasks.every((t) => !t.id.startsWith('task-'))).toBe(true);
    const stored = (await reloaded.getProjects()).find((p) => p.id === project.id)!;
    expect(stored.statusUpdates![0].projectId).toBe(project.id);
  });

  it('persists deletes, including the cleanup of references to a deleted task', async () => {
    const { api } = await loadFacade();
    expect(await api.deleteTask('task-2')).toBe(true); // task-8 lists task-2 in `blocking`
    expect(await api.deleteProject('proj-3')).toBe(true);

    const reloaded = await reload();
    expect(await reloaded.getTaskById('task-2')).toBeNull();
    expect((await reloaded.getTaskById('task-8'))?.blocking).not.toContain('task-2');
    expect((await reloaded.getProjects()).map((p) => p.id)).not.toContain('proj-3');
    expect((await reloaded.getTasks()).some((t) => t.projectId === 'proj-3')).toBe(false);
  });

  it('deactivates a deleted user instead of removing the row', async () => {
    const { api } = await loadFacade();
    expect(await api.deleteUser('user-3')).toBe(true);

    expect((await (await reload()).getUsers()).map((u) => u.uid)).not.toContain('user-3');
    expect(live.db.prepare("SELECT is_active FROM users WHERE uid = 'user-3'").get()).toEqual({ is_active: 0 });
  });

  it('persists the next occurrence spawned when a recurring task is completed', async () => {
    const { api } = await loadFacade();
    const recurrence: TaskRecurrence = { frequency: 'weekly', interval: 1 };
    const title = (await api.getTaskById('task-2'))!.title;
    await api.updateTask('task-2', { recurrence });
    await api.updateTask('task-2', { status: 'Done' });

    const occurrences = (await (await reload()).getTasksForProject('proj-1')).filter((t) => t.title === title);
    expect(occurrences.map((t) => t.status).sort()).toEqual(['Done', 'To Do']);
    const next = occurrences.find((t) => t.status === 'To Do')!;
    expect(next.id).not.toMatch(/^task-/);
    expect(next.activities![0].taskId).toBe(next.id);
  });

  it('persists time added through a time entry', async () => {
    const { api } = await loadFacade();
    await api.createTimeEntry('task-3', 'user-1', 45);
    expect((await (await reload()).getTaskById('task-3'))?.timeTracked).toBe(45);
  });

  it('creates a user even when the demo sign-up flow supplies a passwordHash', async () => {
    const { api } = await loadFacade();
    const user = await api.createUser({ email: 'new@example.com', displayName: 'New', role: 'member', passwordHash: 'hash' });
    expect(user.uid).not.toMatch(/^user-/);
    expect((await (await reload()).getUsers()).some((u) => u.email === 'new@example.com')).toBe(true);
  });

  it('rejects an update the server refuses and keeps the cached task unchanged', async () => {
    const { api } = await loadFacade();
    const title = (await api.getTaskById('task-1'))!.title;

    await expect(api.updateTask('task-1', { title: null as unknown as string })).rejects.toThrow(/400/);
    expect((await api.getTaskById('task-1'))?.title).toBe(title);
  });
});

describe('enhancedApi when saves fail', () => {
  const dbTaskCount = () => (live.db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n;

  // Forwards to the live API, except for requests matching `fail`, which reject like a dropped connection.
  const failWhen = (fail: (path: string, init?: RequestInit) => boolean) => {
    const forward = globalThis.fetch;
    vi.stubGlobal('fetch', (path: string, init?: RequestInit) =>
      fail(path, init) ? Promise.reject(new TypeError('fetch failed')) : forward(path, init));
  };

  it('keeps serving reads while the API is unreachable, and rejects edits it cannot save', async () => {
    const { api } = await loadFacade();
    const title = (await api.getTaskById('task-1'))!.title;
    failWhen(() => true);

    await expect(api.updateTask('task-1', { title: 'Lost' })).rejects.toThrow(/fetch failed/);
    expect(await api.getTasks()).toHaveLength(8);
    expect((await api.getTaskById('task-1'))?.title).toBe(title);
  });

  it('does not duplicate a task when a create that failed on the network is retried', async () => {
    const { api } = await loadFacade();
    await api.getTasks(); // load first, so only the create fails
    let failNextPost = true;
    failWhen((_path, init) => {
      if (!failNextPost || init?.method !== 'POST') return false;
      failNextPost = false;
      return true;
    });

    await expect(api.createTask('Quarterly report', 'proj-1', 'To Do', { createdBy: 'user-1' })).rejects.toThrow(/fetch failed/);
    await api.createTask('Quarterly report', 'proj-1', 'To Do', { createdBy: 'user-1' });

    const copies = (await (await reload()).getTasks()).filter((t) => t.title === 'Quarterly report');
    expect(copies).toHaveLength(1);
  });

  it('leaves nothing behind when a template project cannot be saved', async () => {
    const { api } = await loadFacade();
    const template = (await api.getTemplates())[0];
    failWhen((path, init) => init?.method === 'POST' && path === '/api/projects');

    await expect(api.createProjectFromTemplate(template.id, 'Doomed', 'user-1')).rejects.toThrow(/fetch failed/);

    expect((await api.getProjects()).some((p) => p.name === 'Doomed')).toBe(false);
    expect(await api.getTasks()).toHaveLength(8);
    expect(dbTaskCount()).toBe(8);
  });

  it('creates two template projects at once without mixing their tasks', async () => {
    const { api } = await loadFacade();
    const template = (await api.getTemplates())[0];

    const [alpha, beta] = await Promise.all([
      api.createProjectFromTemplate(template.id, 'Alpha', 'user-1'),
      api.createProjectFromTemplate(template.id, 'Beta', 'user-1'),
    ]);

    const reloaded = await reload();
    expect(alpha.id).not.toBe(beta.id);
    expect(await reloaded.getTasksForProject(alpha.id)).toHaveLength(template.sampleTasks.length);
    expect(await reloaded.getTasksForProject(beta.id)).toHaveLength(template.sampleTasks.length);
  });
});

describe('enhancedApi without the local API', () => {
  it('falls back to the in-memory demo data', async () => {
    vi.stubGlobal('fetch', async () => { throw new TypeError('fetch failed'); });
    const { api } = await loadFacade();

    expect(await api.getProjects()).toHaveLength(5);
    const created = await api.createTask('Offline', 'proj-1', 'To Do');
    expect(created.id).toMatch(/^task-/);
    expect(await api.getTaskById(created.id)).toBe(created);
  });
});
