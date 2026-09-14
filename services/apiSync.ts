import type { Project, Task, User } from '../types';
import { apiClient } from './apiClient';

/**
 * Write-through cache for enhancedApi. The facade keeps working on its in-memory arrays, so
 * all of its dependency, recurrence, ordering and project-editing logic stays in one place.
 * This module loads those arrays from the local API, then after each facade call compares
 * them with the last state the server confirmed and sends only the differences.
 *
 * A save that fails for any reason is undone in memory, so a rejected call never leaves a
 * change behind to be retried or duplicated later, and a resolved call was saved.
 */

export type SyncStore = { users: User[]; projects: Project[]; tasks: Task[] };
export type SyncOptions = { retryLoadAfterMs?: number };

type Entity = Record<string, any>;
type Fields = Set<string> | 'all';

export type SaveFailure = { seq: number; key: string; fields: Fields; message: string };

export class SaveError extends Error {
  readonly failures: SaveFailure[];

  constructor(failures: SaveFailure[]) {
    super(failures.map((f) => f.message).join('; ') || 'Could not save changes');
    this.name = 'SaveError';
    this.failures = failures;
  }
}

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

function remapUserId(store: SyncStore, from: string, to: string) {
  for (const task of store.tasks as Entity[]) {
    if (task.assigneeId === from) task.assigneeId = to;
    if (task.createdBy === from) task.createdBy = to;
    if (task.collaboratorIds?.includes(from)) task.collaboratorIds = swapId(task.collaboratorIds, from, to);
  }
  for (const project of store.projects as Entity[]) {
    if (project.ownerId === from) project.ownerId = to;
    if (project.members?.includes(from)) project.members = swapId(project.members, from, to);
  }
  for (const user of store.users as Entity[]) {
    if (user.managerId === from) user.managerId = to;
  }
}

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

const keyOf = (c: Collection, id: string) => `${c.label}:${id}`;

// The facade replaces records (`TASKS[i] = {...}`) as well as mutating them, so every step
// looks the record up by id instead of trusting an object reference taken earlier.
const findById = (c: Collection, id: string) => c.items.find((item) => item[c.key] === id);

const overlaps = (a: Fields, b: Fields) => a === 'all' || b === 'all' || [...a].some((field) => b.has(field));

const MAX_LOGGED_FAILURES = 1000;

export type CallToken = { seq: number; before: Map<string, string> };

export function createApiSync(store: SyncStore, options: SyncOptions = {}) {
  const retryLoadAfterMs = options.retryLoadAfterMs ?? 5000;
  const baselines = { users: new Map<string, Entity>(), projects: new Map<string, Entity>(), tasks: new Map<string, Entity>() };
  let loading: Promise<boolean> | null = null;
  let lastLoadFailure = -Infinity;
  let active = false;
  let currentUid: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let seq = 0;
  let openCalls = 0;
  const failureLog: SaveFailure[] = [];

  const collections = (): Collection[] => [
    {
      label: 'user', key: 'uid', items: store.users, baseline: baselines.users, ignored: ['passwordHash'],
      create: (u) => apiClient.createUser(u),
      update: (uid, changes) => apiClient.updateUser(uid, changes),
      remove: (uid) => apiClient.deleteUser(uid),
      remap: (from, to) => remapUserId(store, from, to),
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

  function load(fetched: Entity[], c: Collection) {
    c.items.splice(0, c.items.length, ...fetched);
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
      load(users, u);
      load(projects, p);
      load(tasks, t);
      currentUid = me?.uid ?? null;
      active = true;
      return true;
    } catch (error) {
      console.warn('Local API unavailable, using in-memory demo data:', error);
      return false;
    }
  }

  function record(c: Collection, id: string, fields: Fields, error: unknown): SaveFailure {
    const message = `Could not save ${c.label} "${id}": ${error instanceof Error ? error.message : String(error)}`;
    const failure = { seq: ++seq, key: keyOf(c, id), fields, message };
    failureLog.push(failure);
    if (failureLog.length > MAX_LOGGED_FAILURES) failureLog.splice(0, failureLog.length - MAX_LOGGED_FAILURES);
    return failure;
  }

  async function createNew(c: Collection, failures: SaveFailure[]) {
    for (const localId of c.items.map((item) => item[c.key])) {
      const current = findById(c, localId);
      if (!current || c.baseline.has(localId)) continue;
      const sent = structuredClone(current);
      delete sent[c.key];
      try {
        const saved = await c.create(sent);
        const serverId = saved[c.key];
        c.baseline.set(serverId, structuredClone(saved));
        const now = findById(c, localId); // replaced, or removed, while the request was in flight
        if (now) {
          adopt(now, sent, saved);
          now[c.key] = serverId;
        }
        if (serverId !== localId) c.remap?.(localId, serverId);
      } catch (error) {
        const now = findById(c, localId);
        if (now) c.items.splice(c.items.indexOf(now), 1);
        failures.push(record(c, localId, 'all', error));
      }
    }
  }

  async function updateChanged(c: Collection, failures: SaveFailure[]) {
    for (const id of c.items.map((item) => item[c.key])) {
      const base = c.baseline.get(id);
      const current = findById(c, id);
      if (!base || !current) continue;
      const changes = changedFields(current, base, c);
      if (Object.keys(changes).length === 0) continue;
      const sent = structuredClone(changes);
      try {
        const saved = await c.update(id, sent);
        c.baseline.set(id, structuredClone(saved));
        const now = findById(c, id);
        if (now) adopt(now, sent, saved);
      } catch (error) {
        const now = findById(c, id);
        if (now) {
          for (const field of Object.keys(sent)) {
            if (same(now[field], sent[field])) now[field] = structuredClone(base[field]);
          }
        }
        failures.push(record(c, id, new Set(Object.keys(sent)), error));
      }
    }
  }

  async function deleteRemoved(c: Collection, failures: SaveFailure[]) {
    const present = new Set(c.items.map((item) => item[c.key]));
    for (const [id, base] of [...c.baseline]) {
      if (present.has(id)) continue;
      try {
        await c.remove(id); // resolves false when it is already gone, e.g. cascaded with its project
        c.baseline.delete(id);
      } catch (error) {
        if (!findById(c, id)) c.items.push(structuredClone(base));
        failures.push(record(c, id, 'all', error));
      }
    }
  }

  async function saveAll() {
    const failures: SaveFailure[] = [];
    const ordered = collections(); // users, projects, tasks: parents exist before children
    for (const c of ordered) await createNew(c, failures);
    for (const c of ordered) await updateChanged(c, failures);
    for (const c of [...ordered].reverse()) await deleteRemoved(c, failures);
    if (failures.length) throw new SaveError(failures);
  }

  function persist(): Promise<void> {
    const run = queue.then(() => (active ? saveAll() : undefined));
    queue = run.catch(() => undefined); // a failed save must not block the ones queued after it
    return run;
  }

  function snapshot(): Map<string, string> {
    const snap = new Map<string, string>();
    for (const c of collections()) {
      for (const item of c.items) snap.set(keyOf(c, item[c.key]), JSON.stringify(item));
    }
    return snap;
  }

  // Which records, and which of their fields, changed since `before` was taken.
  function changesSince(before: Map<string, string>): Map<string, Fields> {
    const touched = new Map<string, Fields>();
    const seen = new Set<string>();
    for (const c of collections()) {
      for (const item of c.items) {
        const key = keyOf(c, item[c.key]);
        seen.add(key);
        const previous = before.get(key);
        if (previous === undefined) {
          touched.set(key, 'all');
        } else if (previous !== JSON.stringify(item)) {
          const old = JSON.parse(previous);
          const fields = [...new Set([...Object.keys(item), ...Object.keys(old)])].filter((f) => !same(item[f], old[f]));
          touched.set(key, new Set(fields));
        }
      }
    }
    for (const key of before.keys()) if (!seen.has(key)) touched.set(key, 'all');
    return touched;
  }

  function endCall() {
    openCalls -= 1;
    if (openCalls === 0) failureLog.length = 0; // no call can still claim an older failure
  }

  return {
    /**
     * Loads users, projects and tasks from the API; false means use the demo data for now.
     * A failed load is retried on a later call once `retryLoadAfterMs` has passed.
     */
    ensureApi(): Promise<boolean> {
      if (active) return Promise.resolve(true);
      if (loading) return loading;
      if (Date.now() - lastLoadFailure < retryLoadAfterMs) return Promise.resolve(false);
      loading = hydrate().then((ok) => {
        loading = null;
        if (!ok) lastLoadFailure = Date.now();
        return ok;
      });
      return loading;
    },
    isActive: () => active,
    currentUserId: () => currentUid,
    /** Saves every difference from the last server-confirmed state, one save at a time. */
    persist,
    /** The latest failure recorded for one record, as an error to throw. */
    failureFor(label: string, id: string): SaveError {
      const key = `${label}:${id}`;
      const latest = [...failureLog].reverse().find((f) => f.key === key);
      return new SaveError(latest ? [latest] : []);
    },
    /** Marks the start of a facade call, so its save failures can be told apart from others'. */
    beginCall(): CallToken {
      openCalls += 1;
      return { seq, before: active ? snapshot() : new Map() };
    },
    /** Saves, then rejects with the failures that hit fields this call changed. */
    async commitCall(call: CallToken): Promise<void> {
      try {
        if (!active) return;
        const touched = changesSince(call.before);
        await persist().catch(() => undefined);
        const own = failureLog.filter((f) => f.seq > call.seq && touched.has(f.key) && overlaps(touched.get(f.key)!, f.fields));
        if (own.length) throw new SaveError(own);
      } finally {
        endCall();
      }
    },
    /** Ends a call whose method threw, without saving what it left behind. */
    abandonCall: endCall,
  };
}

export type ApiSync = ReturnType<typeof createApiSync>;

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

// Facade methods named get* only read. They wait for the load but never save, so they cannot
// fail because of someone else's change, and they skip the comparison entirely.
const isRead = (name: string) => /^get[A-Z]/.test(name);

/**
 * Wraps each `async` method so it runs only after the API has been loaded (or has failed to
 * load). Non-read methods then save their changes and reject only for their own failures.
 * Synchronous methods such as subscriptions are passed through unchanged, because callers
 * rely on their immediate return value. Detection relies on native async functions, which
 * the ES2022+ build targets preserve.
 */
export function withApiSync<T extends object>(api: T, sync: ApiSync): T {
  const wrapped: Record<string, unknown> = {};
  for (const [name, member] of Object.entries(api)) {
    if (!(member instanceof AsyncFunction)) {
      wrapped[name] = member;
      continue;
    }
    const run = member as (...args: unknown[]) => Promise<unknown>;
    wrapped[name] = isRead(name)
      ? async (...args: unknown[]) => {
          await sync.ensureApi();
          return run(...args);
        }
      : async (...args: unknown[]) => {
          await sync.ensureApi();
          const call = sync.beginCall();
          let result: unknown;
          try {
            result = await run(...args);
          } catch (error) {
            sync.abandonCall();
            throw error;
          }
          await sync.commitCall(call);
          return result;
        };
  }
  return wrapped as T;
}
