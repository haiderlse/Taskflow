import type { User, Project, Task } from '../types';

// Same-origin in the browser: the Vite dev server proxies /api to the loopback-only API.
const BASE = '/api';

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// The server only ever sends short, safe `{ error }` messages, so they are worth surfacing.
async function errorDetail(res: Response): Promise<string> {
  try {
    const body = await res.json();
    return typeof body?.error === 'string' ? ` ${body.error}` : '';
  } catch {
    return ''; // non-JSON body, e.g. a proxy's 502 page
  }
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const method = init?.method ?? 'GET';
    throw new ApiError(`API ${method} ${path} failed: ${res.status}${await errorDetail(res)}`, res.status);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

// Resolves to null when the server answers 404; every other failure still throws.
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

// The facade's deletes return a boolean: false means there was nothing to delete.
async function deleted(request: Promise<unknown>): Promise<boolean> {
  return (await orNull(request.then(() => true))) ?? false;
}

// Ids go into the path, so a '/', '?' or '#' in one must not change which route is hit.
const seg = encodeURIComponent;

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

// types.ts still carries the demo-auth passwordHash, but the server has no such column and
// rejects unknown fields, so it never leaves the browser.
const withoutPasswordHash = ({ passwordHash: _dropped, ...user }: Partial<User>) => user;

// The server sends ISO strings; types.ts expects Date objects.
const reviveUser = (u: any): User => ({
  ...u,
  createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
  lastLogin: u.lastLogin ? new Date(u.lastLogin) : undefined,
});

const reviveDates = <T,>(o: any, fields: string[]): T => {
  const out = { ...o };
  for (const f of fields) if (out[f]) out[f] = new Date(out[f]);
  return out as T;
};

const PROJECT_DATES = ['createdAt', 'updatedAt', 'startDate', 'dueDate'];
const TASK_DATES = ['createdAt', 'updatedAt', 'dueDate', 'startDate',
                    'completedDate', 'scheduledStart', 'scheduledEnd'];

// Mirrors supabaseService's method names, signatures and null/boolean results so the facade
// swap is a rename. updateProject, deleteProject and deleteTask are included because the
// facade reaches them through `(supabaseService as any)`, which a plain rename would miss.
export const apiClient = {
  // Users are soft-deleted (as supabaseService did), so inactive users are hidden here.
  getUsers: async (): Promise<User[]> =>
    (await http<any[]>('/users')).filter((u) => u.isActive).map(reviveUser),
  getUserById: async (uid: string): Promise<User | null> => {
    if (!uid) return null; // '/users/' would hit the list route
    const user = await orNull(http<any>(`/users/${seg(uid)}`));
    return user && reviveUser(user);
  },
  getCurrentUser: async (): Promise<User | null> => {
    const user = await orNull(http<any>('/users/me'));
    return user && reviveUser(user);
  },
  createUser: async (data: Partial<User>): Promise<User> =>
    reviveUser(await http<any>('/users', json('POST', withoutPasswordHash(data)))),
  updateUser: async (uid: string, updates: Partial<User>): Promise<User> =>
    reviveUser(await http<any>(`/users/${seg(uid)}`, json('PATCH', withoutPasswordHash(updates)))),
  // A hard delete would fail for any project owner (foreign key) and 404 the UI's follow-up
  // `isActive: false` update, so deactivate instead.
  deleteUser: async (uid: string): Promise<boolean> =>
    deleted(http(`/users/${seg(uid)}`, json('PATCH', { isActive: false }))),

  getProjects: async (): Promise<Project[]> =>
    (await http<any[]>('/projects')).map((p) => reviveDates<Project>(p, PROJECT_DATES)),
  // `extra` carries the sections, colour, members and so on that the facade builds; the
  // server still assigns the id.
  createProject: async (name: string, ownerId: string, extra: Partial<Project> = {}): Promise<Project> =>
    reviveDates<Project>(await http<any>('/projects', json('POST', { ...extra, name, ownerId })), PROJECT_DATES),
  updateProject: async (projectId: string, updates: Partial<Project>): Promise<Project> =>
    reviveDates<Project>(await http<any>(`/projects/${seg(projectId)}`, json('PATCH', updates)), PROJECT_DATES),
  deleteProject: async (projectId: string): Promise<boolean> =>
    deleted(http(`/projects/${seg(projectId)}`, { method: 'DELETE' })),

  getTasksForProject: async (projectId: string): Promise<Task[]> =>
    (await http<any[]>(`/projects/${seg(projectId)}/tasks`)).map((t) => reviveDates<Task>(t, TASK_DATES)),
  getTasksForUser: async (userId: string): Promise<Task[]> =>
    (await http<any[]>(`/users/${seg(userId)}/tasks`)).map((t) => reviveDates<Task>(t, TASK_DATES)),
  createTask: async (data: Partial<Task>): Promise<Task> =>
    reviveDates<Task>(await http<any>('/tasks', json('POST', data)), TASK_DATES),
  updateTask: async (taskId: string, updates: Partial<Task>): Promise<Task> =>
    reviveDates<Task>(await http<any>(`/tasks/${seg(taskId)}`, json('PATCH', updates)), TASK_DATES),
  deleteTask: async (taskId: string): Promise<boolean> =>
    deleted(http(`/tasks/${seg(taskId)}`, { method: 'DELETE' })),
};
