import type { Project, Task, User } from '../types';
import { apiClient, ApiError } from './apiClient';

/**
 * Write-through cache for enhancedApi. The facade keeps working on its in-memory arrays, so
 * all of its dependency, recurrence, ordering and project-editing logic stays in one place.
 * This module loads those arrays from the local API once, then after each facade call
 * compares them with the last state the server confirmed and sends only the differences.
 */

export type SyncStore = { users: User[]; projects: Project[]; tasks: Task[] };

type Entity = Record<string, any>;

type Collection = {
  label: string;
  key: 'uid' | 'id';
  items: Entity[];
  baseline: Map<string, Entity>; // last server-confirmed copy of each record, by id
  ignored: string[]; // never compared: server-owned, or never sent
  create: (payload: Entity) => Promise<Entity>;
  update: (id: string, changes: Entity) => Promise<Entity>;
  remove: (id: string) => Promise<unknown>;
  remap?: (from: string, to: string) => void; // rewrite references after a local id is replaced
};

// JSON equality: Dates compare by ISO string, and a missing field equals null (how the server
// reports an empty column).
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const swapId = (ids: string[], from: string, to: string) => ids.map((id) => (id === from ? to : id));

function remapProjectId(store: SyncStore, from: string, to: string) {
  for (const task of store.tasks as Entity[]) {
    if (task.projectId === from) task.projectId = to;
    if (task.projectIds?.includes(from)) task.projectIds = swapId(task.projectIds, from, to);
  }
  for (const project of store.projects as Entity[]) {
    if (project.statusUpdates?.some((u: Entity) => u.projectId === from)) {
      project.statusUpdates = project.statusUpdates.map((u: Entity) => (u.projectId === from ? { ...u, projectId: to } : u));
    }
  }
}

function remapTaskId(store: SyncStore, from: string, to: string) {
  for (const task of store.tasks as Entity[]) {
    for (const field of ['blockedBy', 'dependencies', 'blocking', 'subtasks']) {
      if (task[field]?.includes(from)) task[field] = swapId(task[field], from, to);
    }
    if (task.parentTaskId === from) task.parentTaskId = to;
    if (task.activities?.some((a: Entity) => a.taskId === from)) {
      task.activities = task.activities.map((a: Entity) => (a.taskId === from ? { ...a, taskId: to } : a));
    }
  }
}

function changedFields(item: Entity, base: Entity, c: Collection): Entity {
  const changes: Entity = {};
  for (const field of new Set([...Object.keys(item), ...Object.keys(base)])) {
    if (field === c.key || c.ignored.includes(field)) continue;
    if (!same(item[field], base[field])) changes[field] = item[field] ?? null;
  }
  return changes;
}

// Take the server's value for every field the caller has not changed again since `sent` was
// captured, so normalised values are adopted without clobbering edits made mid-request.
function adopt(item: Entity, sent: Entity, saved: Entity) {
  for (const [field, value] of Object.entries(saved)) {
    if (same(item[field], sent[field])) item[field] = value;
  }
}

// Only a 4xx means the server refused the data. Network failures and 5xx are retried.
const isRejected = (error: unknown) => error instanceof ApiError && error.status >= 400 && error.status < 500;

const failure = (c: Collection, id: string, error: unknown) =>
  `Could not save ${c.label} "${id}": ${error instanceof Error ? error.message : String(error)}`;

export function createApiSync(store: SyncStore) {
  const baselines = { users: new Map<string, Entity>(), projects: new Map<string, Entity>(), tasks: new Map<string, Entity>() };
  let ready: Promise<boolean> | null = null;
  let active = false;
  let currentUid: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const collections = (): Collection[] => [
    {
      label: 'user', key: 'uid', items: store.users, baseline: baselines.users, ignored: ['passwordHash'],
      create: (u) => apiClient.createUser(u),
      update: (uid, changes) => apiClient.updateUser(uid, changes),
      remove: (uid) => apiClient.deleteUser(uid),
    },
    {
      label: 'project', key: 'id', items: store.projects, baseline: baselines.projects, ignored: ['updatedAt'],
      create: (p) => apiClient.createProject(p.name, p.ownerId, p),
      update: (id, changes) => apiClient.updateProject(id, changes),
      remove: (id) => apiClient.deleteProject(id),
      remap: (from, to) => remapProjectId(store, from, to),
    },
    {
      label: 'task', key: 'id', items: store.tasks, baseline: baselines.tasks, ignored: ['updatedAt'],
      create: (t) => apiClient.createTask(t),
      update: (id, changes) => apiClient.updateTask(id, changes),
      remove: (id) => apiClient.deleteTask(id),
      remap: (from, to) => remapTaskId(store, from, to),
    },
  ];

  function load(items: Entity[], fetched: Entity[], c: Collection) {
    items.splice(0, items.length, ...fetched);
    c.baseline.clear();
    for (const item of fetched) c.baseline.set(item[c.key], structuredClone(item));
  }

  async function hydrate(): Promise<boolean> {
    try {
      const [users, projects, me] = await Promise.all([
        apiClient.getUsers(), apiClient.getProjects(), apiClient.getCurrentUser(),
      ]);
      const tasks = (await Promise.all(projects.map((p) => apiClient.getTasksForProject(p.id)))).flat();
      // Replace all three only once every request has succeeded, so a partial load never mixes
      // server records with demo records.
      const [u, p, t] = collections();
      load(u.items, users, u);
      load(p.items, projects, p);
      load(t.items, tasks, t);
      currentUid = me?.uid ?? null;
      active = true;
      return true;
    } catch (error) {
      console.warn('Local API unavailable, using in-memory demo data:', error);
      return false;
    }
  }

  async function createNew(c: Collection, failures: string[]) {
    for (const item of [...c.items]) {
      const localId = item[c.key];
      if (c.baseline.has(localId)) continue;
      const sent = structuredClone(item);
      delete sent[c.key];
      try {
        const saved = await c.create(sent);
        const serverId = saved[c.key];
        adopt(item, sent, saved);
        item[c.key] = serverId;
        c.baseline.set(serverId, structuredClone(saved));
        if (serverId !== localId) c.remap?.(localId, serverId);
      } catch (error) {
        if (isRejected(error)) c.items.splice(c.items.indexOf(item), 1);
        failures.push(failure(c, localId, error));
      }
    }
  }

  async function updateChanged(c: Collection, failures: string[]) {
    for (const item of [...c.items]) {
      const id = item[c.key];
      const base = c.baseline.get(id);
      if (!base) continue; // a create that failed without being rejected; retried next save
      const changes = changedFields(item, base, c);
      if (Object.keys(changes).length === 0) continue;
      const sent = structuredClone(changes);
      try {
        const saved = await c.update(id, sent);
        adopt(item, sent, saved);
        c.baseline.set(id, structuredClone(saved));
      } catch (error) {
        if (isRejected(error)) {
          for (const field of Object.keys(sent)) {
            if (same(item[field], sent[field])) item[field] = structuredClone(base[field]);
          }
        }
        failures.push(failure(c, id, error));
      }
    }
  }

  async function deleteRemoved(c: Collection, failures: string[]) {
    const present = new Set(c.items.map((item) => item[c.key]));
    for (const id of [...c.baseline.keys()]) {
      if (present.has(id)) continue;
      try {
        await c.remove(id); // resolves false when it is already gone, e.g. cascaded with its project
        c.baseline.delete(id);
      } catch (error) {
        failures.push(failure(c, id, error));
      }
    }
  }

  async function saveAll() {
    const failures: string[] = [];
    const ordered = collections(); // users, projects, tasks: parents exist before children
    for (const c of ordered) await createNew(c, failures);
    for (const c of ordered) await updateChanged(c, failures);
    for (const c of [...ordered].reverse()) await deleteRemoved(c, failures);
    if (failures.length) throw new Error(failures.join('; '));
  }

  return {
    /** Loads users, projects and tasks from the API once; false means stay on the demo data. */
    ensureApi(): Promise<boolean> {
      ready ??= hydrate();
      return ready;
    },
    isActive: () => active,
    currentUserId: () => currentUid,
    /** Saves every difference from the last server-confirmed state, one save at a time. */
    persist(): Promise<void> {
      const run = queue.then(() => (active ? saveAll() : undefined));
      queue = run.catch(() => undefined); // a failed save must not block the ones queued after it
      return run;
    },
  };
}

export type ApiSync = ReturnType<typeof createApiSync>;

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

/**
 * Wraps each `async` method so it runs only after the API has been loaded (or has failed to
 * load) and saves its changes before resolving. Synchronous methods such as subscriptions
 * are passed through unchanged, because callers rely on their immediate return value.
 * Detection relies on native async functions, which the ES2022+ build targets preserve.
 */
export function withApiSync<T extends object>(api: T, sync: ApiSync): T {
  const wrapped: Record<string, unknown> = {};
  for (const [name, member] of Object.entries(api)) {
    wrapped[name] = member instanceof AsyncFunction
      ? async (...args: unknown[]) => {
          await sync.ensureApi();
          const result = await (member as (...a: unknown[]) => Promise<unknown>)(...args);
          await sync.persist();
          return result;
        }
      : member;
  }
  return wrapped as T;
}
