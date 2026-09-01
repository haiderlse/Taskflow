# Local SQLite Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Supabase with a local SQLite file served by a loopback-bound Node API, so TaskFlow runs offline with durable data and no cloud account.

**Architecture:** `services/enhancedApi.ts` is an existing facade — 25 files import it, none reference Supabase. We build an Express + better-sqlite3 server, add a typed `apiClient` in the browser, and swap the 17 `supabaseService.*` call sites behind the facade. The UI layer is not touched.

**Tech Stack:** Node 22.22, Express 4, better-sqlite3 11, tsx (TS execution), vitest + supertest, Vite 6 dev proxy.

**Spec:** `docs/superpowers/specs/2026-09-01-sqlite-local-db-migration-design.md`

## Global Constraints

- API binds to `127.0.0.1` only, port `4000`. Never `0.0.0.0` — there is no auth.
- No authentication. `GET /api/users/me` always returns seeded `user-1`.
- `types.ts` is the schema authority, NOT `supabase-schema.sql`.
- Nested object fields are stored as JSON TEXT columns, not normalised tables.
- `PRAGMA foreign_keys = ON` must be set on every connection.
- SQLite column `order` is a reserved word — always quote as `"order"`.
- Dates cross the wire as ISO-8601 strings; `types.ts` expects `Date` objects in the browser.
- Coverage target 80% on `server/`. Pre-existing untested UI is out of scope.
- Do not refactor `enhancedApi.ts` beyond replacing Supabase branches.

---

### Task 1: Backend scaffold and test harness

**Files:**
- Create: `server/index.ts`, `server/app.ts`, `server/tsconfig.json`, `vitest.config.ts`
- Modify: `package.json`, `.gitignore`
- Test: `server/__tests__/health.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `createApp(): express.Express` from `server/app.ts` — every later route task mounts onto this.

- [ ] **Step 1: Install dependencies**

```bash
npm install express better-sqlite3
npm install -D tsx vitest @vitest/coverage-v8 supertest @types/express @types/better-sqlite3 @types/supertest
```

- [ ] **Step 2: Write the failing test**

Create `server/__tests__/health.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 3: Add vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
    coverage: { include: ['server/**/*.ts'], thresholds: { lines: 80 } },
  },
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run server/__tests__/health.test.ts`
Expected: FAIL — cannot resolve `../app`.

- [ ] **Step 5: Write minimal implementation**

Create `server/app.ts`:

```ts
import express from 'express';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  return app;
}
```

Create `server/index.ts`:

```ts
import { createApp } from './app';

const PORT = 4000;
const HOST = '127.0.0.1'; // never 0.0.0.0 — no auth guards this API

createApp().listen(PORT, HOST, () => {
  console.log(`TaskFlow API listening on http://${HOST}:${PORT}`);
});
```

Create `server/tsconfig.json` (the root tsconfig targets the DOM and sets `noEmit`):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["./**/*.ts"]
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run server/__tests__/health.test.ts`
Expected: PASS

- [ ] **Step 7: Add scripts and ignore the database directory**

In `package.json` `scripts`, add:

```json
"server": "tsx watch server/index.ts",
"test": "vitest run",
"test:watch": "vitest"
```

Append to `.gitignore`:

```
# local database
data/
```

- [ ] **Step 8: Commit**

```bash
git add server vitest.config.ts package.json package-lock.json .gitignore
git commit -m "feat: add Express server scaffold with vitest harness"
```

---

### Task 2: SQLite schema and connection module

**Files:**
- Create: `server/db/schema.sql`, `server/db/connection.ts`
- Test: `server/__tests__/connection.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `openDb(path: string): Database` and `initSchema(db: Database): void` from `server/db/connection.ts`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/connection.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { openDb, initSchema } from '../db/connection';

describe('database connection', () => {
  it('enables foreign key enforcement', () => {
    const db = openDb(':memory:');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
  });

  it('creates the three core tables', () => {
    const db = openDb(':memory:');
    initSchema(db);
    const names = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r: any) => r.name);
    expect(names).toEqual(expect.arrayContaining(['users', 'projects', 'tasks']));
  });

  it('rejects a task referencing a missing project', () => {
    const db = openDb(':memory:');
    initSchema(db);
    // created_at/updated_at are NOT NULL with no default — supply them so the
    // statement fails on the FOREIGN KEY, not on NOT NULL.
    const now = new Date().toISOString();
    expect(() =>
      db.prepare(
        'INSERT INTO tasks (id, title, project_id, created_at, updated_at) VALUES (?,?,?,?,?)'
      ).run('t1', 'orphan', 'no-such-project', now, now)
    ).toThrow(/FOREIGN KEY/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/connection.test.ts`
Expected: FAIL — cannot resolve `../db/connection`.

- [ ] **Step 3: Write the schema**

Create `server/db/schema.sql`. Columns are derived from `types.ts`, not `supabase-schema.sql`. JSON columns hold arrays and nested objects.

```sql
CREATE TABLE IF NOT EXISTS users (
  uid            TEXT PRIMARY KEY,
  email          TEXT NOT NULL UNIQUE,
  display_name   TEXT NOT NULL,
  avatar         TEXT,
  role           TEXT NOT NULL DEFAULT 'member',
  department     TEXT,
  time_zone      TEXT,
  workload       INTEGER,
  is_active      INTEGER NOT NULL DEFAULT 1,
  last_login     TEXT,
  created_at     TEXT NOT NULL,
  manager_id     TEXT,
  approval_limit INTEGER
);

CREATE TABLE IF NOT EXISTS projects (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  description    TEXT,
  owner_id       TEXT NOT NULL REFERENCES users(uid),
  members        TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  color          TEXT NOT NULL DEFAULT 'bg-slate-500',
  is_template    INTEGER NOT NULL DEFAULT 0,
  template_id    TEXT,
  is_favorite    INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active',
  health_status  TEXT,
  sections       TEXT NOT NULL DEFAULT '[]',
  brief          TEXT,
  status_updates TEXT NOT NULL DEFAULT '[]',
  start_date     TEXT,
  due_date       TEXT,
  visibility     TEXT NOT NULL DEFAULT 'team',
  custom_fields  TEXT NOT NULL DEFAULT '[]',
  tags           TEXT NOT NULL DEFAULT '[]',
  portfolio_id   TEXT
);

CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'To Do',
  task_status     TEXT NOT NULL DEFAULT 'not_started',
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_ids     TEXT NOT NULL DEFAULT '[]',
  section_id      TEXT,
  assignee_id     TEXT,
  collaborator_ids TEXT NOT NULL DEFAULT '[]',
  created_by      TEXT,
  due_date        TEXT,
  due_time        TEXT,
  start_date      TEXT,
  completed_date  TEXT,
  scheduled_start TEXT,
  scheduled_end   TEXT,
  priority        TEXT NOT NULL DEFAULT 'medium',
  "order"         INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  dependencies    TEXT NOT NULL DEFAULT '[]',
  blocked_by      TEXT NOT NULL DEFAULT '[]',
  blocking        TEXT NOT NULL DEFAULT '[]',
  subtasks        TEXT NOT NULL DEFAULT '[]',
  parent_task_id  TEXT,
  time_tracked    INTEGER NOT NULL DEFAULT 0,
  estimated_time  INTEGER,
  custom_fields   TEXT NOT NULL DEFAULT '{}',
  tags            TEXT NOT NULL DEFAULT '[]',
  attachments     TEXT NOT NULL DEFAULT '[]',
  approval        TEXT,
  is_milestone    INTEGER NOT NULL DEFAULT 0,
  subtask_items   TEXT NOT NULL DEFAULT '[]',
  recurrence      TEXT,
  activities      TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
```

- [ ] **Step 4: Write the connection module**

Create `server/db/connection.ts`:

```ts
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export function openDb(path: string) {
  const db = new Database(path);
  db.pragma('foreign_keys = ON'); // SQLite ignores FK constraints unless enabled per connection
  db.pragma('journal_mode = WAL');
  return db;
}

export function initSchema(db: Database.Database) {
  db.exec(readFileSync(join(here, 'schema.sql'), 'utf8'));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/__tests__/connection.test.ts`
Expected: PASS — all three tests.

- [ ] **Step 6: Commit**

```bash
git add server/db server/__tests__/connection.test.ts
git commit -m "feat: add SQLite schema and connection module"
```

---

### Task 3: Row mappers

The database is `snake_case` with JSON strings; `types.ts` is `camelCase` with `Date` objects and real arrays. This module owns that translation. It is the highest-risk surface in the migration and is tested in isolation.

**Files:**
- Create: `server/db/mappers.ts`
- Test: `server/__tests__/mappers.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type FieldSpec = { json: string[]; dates: string[]; bools: string[] }`
  - `USER_SPEC`, `PROJECT_SPEC`, `TASK_SPEC` constants
  - `rowToEntity<T>(row: Record<string, unknown>, spec: FieldSpec): T`
  - `entityToRow(entity: Record<string, unknown>, spec: FieldSpec): Record<string, unknown>`

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/mappers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rowToEntity, entityToRow, TASK_SPEC, USER_SPEC } from '../db/mappers';

describe('rowToEntity', () => {
  it('converts snake_case columns to camelCase keys', () => {
    const e = rowToEntity<any>({ project_id: 'p1', due_time: '09:00' }, TASK_SPEC);
    expect(e.projectId).toBe('p1');
    expect(e.dueTime).toBe('09:00');
  });

  it('parses JSON columns into arrays and objects', () => {
    const e = rowToEntity<any>({ tags: '["a","b"]', custom_fields: '{"k":1}' }, TASK_SPEC);
    expect(e.tags).toEqual(['a', 'b']);
    expect(e.customFields).toEqual({ k: 1 });
  });

  it('parses date columns into Date objects and keeps null as null', () => {
    const e = rowToEntity<any>({ created_at: '2026-09-01T00:00:00.000Z', due_date: null }, TASK_SPEC);
    expect(e.createdAt).toBeInstanceOf(Date);
    expect(e.dueDate).toBeNull();
  });

  it('converts integer booleans to real booleans', () => {
    expect(rowToEntity<any>({ is_active: 1 }, USER_SPEC).isActive).toBe(true);
    expect(rowToEntity<any>({ is_active: 0 }, USER_SPEC).isActive).toBe(false);
  });
});

describe('entityToRow', () => {
  it('is the inverse of rowToEntity for a full task', () => {
    const row = {
      id: 't1', project_id: 'p1', "order": 3, tags: '["x"]',
      custom_fields: '{}', created_at: '2026-09-01T00:00:00.000Z',
      is_milestone: 1, due_date: null,
    };
    expect(entityToRow(rowToEntity<any>(row, TASK_SPEC), TASK_SPEC)).toMatchObject(row);
  });

  it('serialises arrays back to JSON strings', () => {
    expect(entityToRow({ tags: ['a'] }, TASK_SPEC).tags).toBe('["a"]');
  });

  it('drops undefined values so partial updates are safe', () => {
    expect('title' in entityToRow({ id: 't1', title: undefined }, TASK_SPEC)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/mappers.test.ts`
Expected: FAIL — cannot resolve `../db/mappers`.

- [ ] **Step 3: Write minimal implementation**

Create `server/db/mappers.ts`:

```ts
export type FieldSpec = { json: string[]; dates: string[]; bools: string[] };

const toCamel = (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());

export const USER_SPEC: FieldSpec = {
  json: [],
  dates: ['lastLogin', 'createdAt'],
  bools: ['isActive'],
};

export const PROJECT_SPEC: FieldSpec = {
  json: ['members', 'sections', 'brief', 'statusUpdates', 'customFields', 'tags'],
  dates: ['createdAt', 'updatedAt', 'startDate', 'dueDate'],
  bools: ['isTemplate', 'isFavorite'],
};

export const TASK_SPEC: FieldSpec = {
  json: ['projectIds', 'collaboratorIds', 'dependencies', 'blockedBy', 'blocking',
         'subtasks', 'customFields', 'tags', 'attachments', 'approval',
         'subtaskItems', 'recurrence', 'activities'],
  dates: ['dueDate', 'startDate', 'completedDate', 'scheduledStart',
          'scheduledEnd', 'createdAt', 'updatedAt'],
  bools: ['isMilestone'],
};

export function rowToEntity<T>(row: Record<string, unknown>, spec: FieldSpec): T {
  const out: Record<string, unknown> = {};
  for (const [col, val] of Object.entries(row)) {
    const key = toCamel(col);
    if (val === null || val === undefined) { out[key] = null; continue; }
    if (spec.json.includes(key)) out[key] = JSON.parse(val as string);
    else if (spec.dates.includes(key)) out[key] = new Date(val as string);
    else if (spec.bools.includes(key)) out[key] = val === 1 || val === true;
    else out[key] = val;
  }
  return out as T;
}

export function entityToRow(
  entity: Record<string, unknown>,
  spec: FieldSpec
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(entity)) {
    if (val === undefined) continue; // omit so PATCH only touches provided fields
    const col = toSnake(key);
    if (val === null) { out[col] = null; }
    else if (spec.json.includes(key)) out[col] = JSON.stringify(val);
    else if (spec.dates.includes(key)) out[col] = new Date(val as string).toISOString();
    else if (spec.bools.includes(key)) out[col] = val ? 1 : 0;
    else out[col] = val;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/mappers.test.ts`
Expected: PASS — all seven tests.

- [ ] **Step 5: Commit**

```bash
git add server/db/mappers.ts server/__tests__/mappers.test.ts
git commit -m "feat: add snake_case/camelCase row mappers with JSON and date codecs"
```

---

### Task 4: Idempotent seed

The existing mock arrays in `enhancedApi.ts:28-495` become the seed, so first run looks identical to today.

**Files:**
- Create: `server/db/seed.ts`
- Read for reference: `services/enhancedApi.ts:28-231` (USERS, PROJECTS, TASKS)
- Test: `server/__tests__/seed.test.ts`

**Interfaces:**
- Consumes: `openDb`, `initSchema` (Task 2); `entityToRow`, specs (Task 3)
- Produces: `seed(db: Database): void` — inserts only when `users` is empty.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/seed.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { openDb, initSchema } from '../db/connection';
import { seed } from '../db/seed';

const fresh = () => { const db = openDb(':memory:'); initSchema(db); return db; };
const count = (db: any, t: string) =>
  db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;

describe('seed', () => {
  it('inserts the demo users, project and tasks', () => {
    const db = fresh();
    seed(db);
    expect(count(db, 'users')).toBeGreaterThan(0);
    expect(count(db, 'projects')).toBeGreaterThan(0);
    expect(db.prepare('SELECT uid FROM users WHERE uid = ?').get('user-1')).toBeTruthy();
  });

  it('is idempotent — running twice does not duplicate rows', () => {
    const db = fresh();
    seed(db);
    const before = count(db, 'users');
    seed(db);
    expect(count(db, 'users')).toBe(before);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/seed.test.ts`
Expected: FAIL — cannot resolve `../db/seed`.

- [ ] **Step 3: Write minimal implementation**

Create `server/db/seed.ts`. Copy the USERS / PROJECTS / TASKS literals out of `services/enhancedApi.ts` (lines 28-231) into this file, then insert them:

```ts
import type Database from 'better-sqlite3';
import { entityToRow, USER_SPEC, PROJECT_SPEC, TASK_SPEC, type FieldSpec } from './mappers';

const now = new Date().toISOString();

// Copied verbatim from services/enhancedApi.ts:28-33
const USERS = [
  { uid: 'user-1', email: 'ali@example.com', displayName: 'Ali', role: 'admin', workload: 40, isActive: true, createdAt: now },
  { uid: 'user-2', email: 'bob@example.com', displayName: 'Bob', role: 'manager', workload: 35, isActive: true, createdAt: now },
  { uid: 'user-3', email: 'charlie@example.com', displayName: 'Charlie', role: 'member', workload: 40, isActive: true, createdAt: now },
];

// Copied from services/enhancedApi.ts:34-226 — keep every field, including
// sections, brief and statusUpdates, which supabase-schema.sql omitted.
const PROJECTS: Record<string, unknown>[] = [ /* see Step 3a */ ];
const TASKS: Record<string, unknown>[] = [ /* see Step 3a */ ];

function insertAll(db: Database.Database, table: string, rows: Record<string, unknown>[], spec: FieldSpec) {
  for (const entity of rows) {
    const row = entityToRow(entity, spec);
    const cols = Object.keys(row).map((c) => (c === 'order' ? '"order"' : c));
    const stmt = `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`;
    db.prepare(stmt).run(...Object.values(row));
  }
}

export function seed(db: Database.Database) {
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number };
  if (n > 0) return; // idempotent: only seed an empty database

  db.transaction(() => {
    insertAll(db, 'users', USERS as Record<string, unknown>[], USER_SPEC);
    insertAll(db, 'projects', PROJECTS, PROJECT_SPEC);
    insertAll(db, 'tasks', TASKS, TASK_SPEC);
  })();
}
```

- [ ] **Step 3a: Copy the real fixtures — do not leave the arrays empty**

Open `services/enhancedApi.ts` and copy the array literals verbatim:

- `const PROJECTS: Project[] = [...]` — lines **34-226** — into `PROJECTS`
- `let TASKS: Task[] = [...]` — lines **227-432** — into `TASKS`

Two edits are required while copying:
1. Replace every `new Date()` / `new Date(...)` expression with an ISO string
   (`new Date(...).toISOString()`), because `entityToRow` expects string or Date
   and the seed runs once at startup.
2. Keep every field, including `sections`, `brief` and `statusUpdates` on projects
   and `subtaskItems` / `recurrence` / `activities` on tasks. These are exactly the
   fields `supabase-schema.sql` omitted and the reason the schema is derived from
   `types.ts`.

Verify the copy: `grep -c "id:" server/db/seed.ts` should be non-trivial, and the
demo project name `AOP 2025-26 Enterprise Plan` must appear in the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run server/__tests__/seed.test.ts`
Expected: PASS — both tests.

- [ ] **Step 5: Commit**

```bash
git add server/db/seed.ts server/__tests__/seed.test.ts
git commit -m "feat: seed database from existing demo fixtures"
```

---

### Task 5: Users routes

**Files:**
- Create: `server/routes/users.ts`
- Modify: `server/app.ts`
- Test: `server/__tests__/users.test.ts`

**Interfaces:**
- Consumes: `openDb`, `initSchema`, `seed`, `rowToEntity`, `entityToRow`, `USER_SPEC`
- Produces: `usersRouter(db: Database): express.Router`; `createApp(db?: Database)` now accepts an injected database so tests use `:memory:`.

Routes: `GET /api/users`, `GET /api/users/me`, `GET /api/users/:uid`, `POST /api/users`, `PATCH /api/users/:uid`, `DELETE /api/users/:uid`.

Route order matters: `/users/me` must be registered **before** `/users/:uid`, or `me` is captured as a uid.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/users.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb, initSchema } from '../db/connection';
import { seed } from '../db/seed';
import { createApp } from '../app';

let app: any;
beforeEach(() => {
  const db = openDb(':memory:');
  initSchema(db);
  seed(db);
  app = createApp(db);
});

describe('users routes', () => {
  it('lists seeded users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty('displayName');
  });

  it('returns user-1 from /me (no auth)', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('user-1');
  });

  it('fetches one user by uid', async () => {
    const res = await request(app).get('/api/users/user-2');
    expect(res.body.displayName).toBe('Bob');
  });

  it('404s an unknown uid', async () => {
    expect((await request(app).get('/api/users/nope')).status).toBe(404);
  });

  it('creates a user and returns it with a generated uid', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'd@example.com', displayName: 'Dana', role: 'member' });
    expect(res.status).toBe(201);
    expect(res.body.uid).toBeTruthy();
    expect(res.body.isActive).toBe(true);
  });

  it('patches only the provided fields', async () => {
    const res = await request(app).patch('/api/users/user-3').send({ workload: 12 });
    expect(res.status).toBe(200);
    expect(res.body.workload).toBe(12);
    expect(res.body.displayName).toBe('Charlie');
  });

  it('deletes a user', async () => {
    expect((await request(app).delete('/api/users/user-3')).status).toBe(204);
    expect((await request(app).get('/api/users/user-3')).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/users.test.ts`
Expected: FAIL — `createApp` takes no db argument; `/api/users` is 404.

- [ ] **Step 3: Write the router**

Create `server/routes/users.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { rowToEntity, entityToRow, USER_SPEC } from '../db/mappers';
import type { User } from '../../types';

export function usersRouter(db: Database.Database) {
  const r = Router();
  const one = (uid: string) =>
    db.prepare('SELECT * FROM users WHERE uid = ?').get(uid) as Record<string, unknown> | undefined;

  r.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM users').all() as Record<string, unknown>[];
    res.json(rows.map((row) => rowToEntity<User>(row, USER_SPEC)));
  });

  // Must precede '/:uid' or 'me' is captured as a uid
  r.get('/me', (_req, res) => {
    const row = one('user-1');
    if (!row) return res.status(404).json({ error: 'no seeded user' });
    res.json(rowToEntity<User>(row, USER_SPEC));
  });

  r.get('/:uid', (req, res) => {
    const row = one(req.params.uid);
    if (!row) return res.status(404).json({ error: 'user not found' });
    res.json(rowToEntity<User>(row, USER_SPEC));
  });

  r.post('/', (req, res) => {
    const entity = {
      uid: randomUUID(),
      isActive: true,
      createdAt: new Date().toISOString(),
      ...req.body,
    };
    const row = entityToRow(entity, USER_SPEC);
    const cols = Object.keys(row);
    db.prepare(
      `INSERT INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...Object.values(row));
    res.status(201).json(rowToEntity<User>(one(entity.uid)!, USER_SPEC));
  });

  r.patch('/:uid', (req, res) => {
    if (!one(req.params.uid)) return res.status(404).json({ error: 'user not found' });
    const row = entityToRow(req.body, USER_SPEC);
    delete row.uid;
    const cols = Object.keys(row);
    if (cols.length) {
      db.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE uid = ?`)
        .run(...Object.values(row), req.params.uid);
    }
    res.json(rowToEntity<User>(one(req.params.uid)!, USER_SPEC));
  });

  r.delete('/:uid', (req, res) => {
    const info = db.prepare('DELETE FROM users WHERE uid = ?').run(req.params.uid);
    res.status(info.changes ? 204 : 404).end();
  });

  return r;
}
```

- [ ] **Step 4: Wire it into the app**

Rewrite `server/app.ts` to accept an injected database:

```ts
import express from 'express';
import type Database from 'better-sqlite3';
import { openDb, initSchema } from './db/connection';
import { seed } from './db/seed';
import { usersRouter } from './routes/users';

export function createApp(injected?: Database.Database) {
  let db = injected;
  if (!db) {
    db = openDb(process.env.DB_PATH ?? 'data/taskflow.db');
    initSchema(db);
    seed(db);
  }
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/users', usersRouter(db));
  return app;
}
```

In `server/index.ts`, create `data/` before listening:

```ts
import { mkdirSync } from 'node:fs';
mkdirSync('data', { recursive: true });
```

- [ ] **Step 5: Stop the health test from touching the real database**

`createApp()` now opens `data/taskflow.db` when no database is injected, so the
Task 1 health test would create and seed a real file during the suite. Update
`server/__tests__/health.test.ts` to inject an in-memory database:

```ts
import { openDb, initSchema } from '../db/connection';

const db = openDb(':memory:');
initSchema(db);
const res = await request(createApp(db)).get('/api/health');
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run`
Expected: PASS — users suite (7 tests) and health suite, with no `data/` directory created.

- [ ] **Step 7: Commit**

```bash
git add server/routes/users.ts server/app.ts server/index.ts server/__tests__
git commit -m "feat: add users API routes"
```

---

### Task 6: Projects routes

**Files:**
- Create: `server/routes/projects.ts`
- Modify: `server/app.ts`
- Test: `server/__tests__/projects.test.ts`

**Interfaces:**
- Consumes: `PROJECT_SPEC`, `rowToEntity`, `entityToRow`
- Produces: `projectsRouter(db: Database): express.Router`

Routes: `GET /api/projects`, `POST /api/projects`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/projects.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb, initSchema } from '../db/connection';
import { seed } from '../db/seed';
import { createApp } from '../app';

let app: any;
beforeEach(() => {
  const db = openDb(':memory:');
  initSchema(db);
  seed(db);
  app = createApp(db);
});

describe('projects routes', () => {
  it('lists seeded projects with array fields decoded', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body[0].members)).toBe(true);
    expect(Array.isArray(res.body[0].tags)).toBe(true);
  });

  it('preserves nested fields the old SQL schema dropped', async () => {
    const res = await request(app).get('/api/projects');
    expect(Array.isArray(res.body[0].sections)).toBe(true);
  });

  it('creates a project with name and ownerId', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'New Initiative', ownerId: 'user-1' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.members).toEqual(['user-1']);
    expect(res.body.status).toBe('active');
  });

  it('rejects a project owned by a non-existent user', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Orphan', ownerId: 'ghost' });
    expect(res.status).toBe(400);
  });

  it('patches a project name', async () => {
    const { body } = await request(app).post('/api/projects').send({ name: 'X', ownerId: 'user-1' });
    const res = await request(app).patch(`/api/projects/${body.id}`).send({ name: 'Renamed' });
    expect(res.body.name).toBe('Renamed');
  });

  it('deletes a project', async () => {
    const { body } = await request(app).post('/api/projects').send({ name: 'X', ownerId: 'user-1' });
    expect((await request(app).delete(`/api/projects/${body.id}`)).status).toBe(204);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/projects.test.ts`
Expected: FAIL — `/api/projects` is 404.

- [ ] **Step 3: Write the router**

Create `server/routes/projects.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { rowToEntity, entityToRow, PROJECT_SPEC } from '../db/mappers';
import type { Project } from '../../types';

export function projectsRouter(db: Database.Database) {
  const r = Router();
  const one = (id: string) =>
    db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;

  r.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM projects').all() as Record<string, unknown>[];
    res.json(rows.map((row) => rowToEntity<Project>(row, PROJECT_SPEC)));
  });

  r.post('/', (req, res) => {
    const now = new Date().toISOString();
    const entity = {
      id: randomUUID(),
      members: [req.body.ownerId],
      createdAt: now,
      updatedAt: now,
      color: 'bg-slate-500',
      isTemplate: false,
      isFavorite: false,
      status: 'active',
      sections: [],
      statusUpdates: [],
      visibility: 'team',
      customFields: [],
      tags: [],
      ...req.body,
    };
    const row = entityToRow(entity, PROJECT_SPEC);
    const cols = Object.keys(row);
    try {
      db.prepare(
        `INSERT INTO projects (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
      ).run(...Object.values(row));
    } catch (err) {
      // FK violation: ownerId does not exist
      return res.status(400).json({ error: (err as Error).message });
    }
    res.status(201).json(rowToEntity<Project>(one(entity.id)!, PROJECT_SPEC));
  });

  r.patch('/:id', (req, res) => {
    if (!one(req.params.id)) return res.status(404).json({ error: 'project not found' });
    const row = entityToRow({ ...req.body, updatedAt: new Date().toISOString() }, PROJECT_SPEC);
    delete row.id;
    const cols = Object.keys(row);
    db.prepare(`UPDATE projects SET ${cols.map((c) => `${c} = ?`).join(',')} WHERE id = ?`)
      .run(...Object.values(row), req.params.id);
    res.json(rowToEntity<Project>(one(req.params.id)!, PROJECT_SPEC));
  });

  r.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.status(info.changes ? 204 : 404).end();
  });

  return r;
}
```

- [ ] **Step 4: Mount it**

In `server/app.ts` add:

```ts
import { projectsRouter } from './routes/projects';
// ...
app.use('/api/projects', projectsRouter(db));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/__tests__/projects.test.ts`
Expected: PASS — all six tests.

- [ ] **Step 6: Commit**

```bash
git add server/routes/projects.ts server/app.ts server/__tests__/projects.test.ts
git commit -m "feat: add projects API routes"
```

---

### Task 7: Tasks routes

**Files:**
- Create: `server/routes/tasks.ts`
- Modify: `server/app.ts`, `server/routes/projects.ts`, `server/routes/users.ts`
- Test: `server/__tests__/tasks.test.ts`

**Interfaces:**
- Consumes: `TASK_SPEC`, `rowToEntity`, `entityToRow`
- Produces: `tasksRouter(db: Database): express.Router`, plus nested reads mounted as `GET /api/projects/:id/tasks` and `GET /api/users/:uid/tasks`.

The `"order"` column must be quoted in every statement.

- [ ] **Step 1: Write the failing test**

Create `server/__tests__/tasks.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb, initSchema } from '../db/connection';
import { seed } from '../db/seed';
import { createApp } from '../app';

let app: any;
let projectId: string;

beforeEach(async () => {
  const db = openDb(':memory:');
  initSchema(db);
  seed(db);
  app = createApp(db);
  projectId = (await request(app).get('/api/projects')).body[0].id;
});

describe('tasks routes', () => {
  it('lists tasks for a project', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/tasks`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates a task with defaults and a quoted order column', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Ship it', projectId, createdBy: 'user-1', order: 5 });
    expect(res.status).toBe(201);
    expect(res.body.order).toBe(5);
    expect(res.body.timeTracked).toBe(0);
    expect(res.body.dependencies).toEqual([]);
  });

  it('round-trips nested fields the old schema dropped', async () => {
    const res = await request(app).post('/api/tasks').send({
      title: 'Nested', projectId, createdBy: 'user-1',
      subtaskItems: [{ id: 's1', title: 'step', done: false }],
      blockedBy: ['t-9'],
    });
    expect(res.body.subtaskItems[0].title).toBe('step');
    expect(res.body.blockedBy).toEqual(['t-9']);
  });

  it('lists tasks assigned to a user', async () => {
    await request(app).post('/api/tasks')
      .send({ title: 'Mine', projectId, createdBy: 'user-1', assigneeId: 'user-2' });
    const res = await request(app).get('/api/users/user-2/tasks');
    expect(res.body.some((t: any) => t.title === 'Mine')).toBe(true);
  });

  it('patches a task status', async () => {
    const { body } = await request(app).post('/api/tasks')
      .send({ title: 'T', projectId, createdBy: 'user-1' });
    const res = await request(app).patch(`/api/tasks/${body.id}`).send({ status: 'done' });
    expect(res.body.status).toBe('done');
  });

  it('cascades task deletion when its project is deleted', async () => {
    const { body: p } = await request(app).post('/api/projects').send({ name: 'Temp', ownerId: 'user-1' });
    await request(app).post('/api/tasks').send({ title: 'Doomed', projectId: p.id, createdBy: 'user-1' });
    await request(app).delete(`/api/projects/${p.id}`);
    expect((await request(app).get(`/api/projects/${p.id}/tasks`)).body).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run server/__tests__/tasks.test.ts`
Expected: FAIL — `/api/tasks` is 404.

- [ ] **Step 3: Write the router**

Create `server/routes/tasks.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { rowToEntity, entityToRow, TASK_SPEC } from '../db/mappers';
import type { Task } from '../../types';

const quote = (c: string) => (c === 'order' ? '"order"' : c);

export function tasksRouter(db: Database.Database) {
  const r = Router();
  const one = (id: string) =>
    db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;

  r.post('/', (req, res) => {
    const now = new Date().toISOString();
    const entity = {
      id: randomUUID(),
      description: '',
      status: 'To Do',
      projectIds: [],
      collaboratorIds: [],
      order: 0,
      createdAt: now,
      updatedAt: now,
      dependencies: [],
      blockedBy: [],
      blocking: [],
      subtasks: [],
      timeTracked: 0,
      customFields: {},
      tags: [],
      attachments: [],
      isMilestone: false,
      subtaskItems: [],
      activities: [],
      ...req.body,
    };
    const row = entityToRow(entity, TASK_SPEC);
    const cols = Object.keys(row);
    try {
      db.prepare(
        `INSERT INTO tasks (${cols.map(quote).join(',')}) VALUES (${cols.map(() => '?').join(',')})`
      ).run(...Object.values(row));
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message });
    }
    res.status(201).json(rowToEntity<Task>(one(entity.id)!, TASK_SPEC));
  });

  r.patch('/:id', (req, res) => {
    if (!one(req.params.id)) return res.status(404).json({ error: 'task not found' });
    const row = entityToRow({ ...req.body, updatedAt: new Date().toISOString() }, TASK_SPEC);
    delete row.id;
    const cols = Object.keys(row);
    db.prepare(`UPDATE tasks SET ${cols.map((c) => `${quote(c)} = ?`).join(',')} WHERE id = ?`)
      .run(...Object.values(row), req.params.id);
    res.json(rowToEntity<Task>(one(req.params.id)!, TASK_SPEC));
  });

  r.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.status(info.changes ? 204 : 404).end();
  });

  return r;
}

export function listTasksBy(db: Database.Database, column: 'project_id' | 'assignee_id', value: string) {
  const rows = db
    .prepare(`SELECT * FROM tasks WHERE ${column} = ? ORDER BY "order" ASC`)
    .all(value) as Record<string, unknown>[];
  return rows.map((row) => rowToEntity<Task>(row, TASK_SPEC));
}
```

- [ ] **Step 4: Add the nested reads**

In `server/routes/projects.ts` add to `projectsRouter`:

```ts
import { listTasksBy } from './tasks';
// ...
r.get('/:id/tasks', (req, res) => res.json(listTasksBy(db, 'project_id', req.params.id)));
```

In `server/routes/users.ts` add to `usersRouter`, **before** the `/:uid` handler:

```ts
import { listTasksBy } from './tasks';
// ...
r.get('/:uid/tasks', (req, res) => res.json(listTasksBy(db, 'assignee_id', req.params.uid)));
```

In `server/app.ts` add:

```ts
import { tasksRouter } from './routes/tasks';
// ...
app.use('/api/tasks', tasksRouter(db));
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run server/__tests__/tasks.test.ts`
Expected: PASS — all six tests.

- [ ] **Step 6: Run the whole suite and check coverage**

Run: `npx vitest run --coverage`
Expected: all suites pass, `server/` line coverage at or above 80%.

- [ ] **Step 7: Commit**

```bash
git add server/routes server/app.ts server/__tests__/tasks.test.ts
git commit -m "feat: add tasks API routes with project and assignee listings"
```

---

### Task 8: Browser API client

**Files:**
- Create: `services/apiClient.ts`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: the routes from Tasks 5-7
- Produces: `apiClient` with exactly the 12 method names `supabaseService` exposed, so Task 9 is a mechanical rename:
  `getUsers`, `getUserById`, `createUser`, `updateUser`, `deleteUser`, `getCurrentUser`, `getProjects`, `createProject`, `getTasksForProject`, `getTasksForUser`, `createTask`, `updateTask`.

- [ ] **Step 1: Add the dev proxy**

In `vite.config.ts`, inside `server`, add:

```ts
proxy: { '/api': { target: 'http://127.0.0.1:4000', changeOrigin: true } },
```

Leave `host: '0.0.0.0'` as-is — the UI stays LAN-reachable, but the API itself never binds beyond loopback.

- [ ] **Step 2: Write the client**

Create `services/apiClient.ts`:

```ts
import type { User, Project, Task } from '../types';

const BASE = '/api';

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`API ${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

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

export const apiClient = {
  getUsers: async () => (await http<any[]>('/users')).map(reviveUser),
  getUserById: async (uid: string) => reviveUser(await http<any>(`/users/${uid}`)),
  getCurrentUser: async () => reviveUser(await http<any>('/users/me')),
  createUser: async (data: Partial<User>) =>
    reviveUser(await http<any>('/users', { method: 'POST', body: JSON.stringify(data) })),
  updateUser: async (uid: string, updates: Partial<User>) =>
    reviveUser(await http<any>(`/users/${uid}`, { method: 'PATCH', body: JSON.stringify(updates) })),
  deleteUser: async (uid: string) => {
    await http<void>(`/users/${uid}`, { method: 'DELETE' });
    return true;
  },

  getProjects: async () =>
    (await http<any[]>('/projects')).map((p) => reviveDates<Project>(p, PROJECT_DATES)),
  createProject: async (name: string, ownerId: string) =>
    reviveDates<Project>(
      await http<any>('/projects', { method: 'POST', body: JSON.stringify({ name, ownerId }) }),
      PROJECT_DATES
    ),

  getTasksForProject: async (projectId: string) =>
    (await http<any[]>(`/projects/${projectId}/tasks`)).map((t) => reviveDates<Task>(t, TASK_DATES)),
  getTasksForUser: async (userId: string) =>
    (await http<any[]>(`/users/${userId}/tasks`)).map((t) => reviveDates<Task>(t, TASK_DATES)),
  createTask: async (data: Partial<Task>) =>
    reviveDates<Task>(await http<any>('/tasks', { method: 'POST', body: JSON.stringify(data) }), TASK_DATES),
  updateTask: async (taskId: string, updates: Partial<Task>) =>
    reviveDates<Task>(
      await http<any>(`/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
      TASK_DATES
    ),
};
```

- [ ] **Step 3: Verify it typechecks**

Run: `npm run lint`
Expected: no errors from `services/apiClient.ts`.

- [ ] **Step 4: Commit**

```bash
git add services/apiClient.ts vite.config.ts
git commit -m "feat: add browser API client and Vite dev proxy"
```

---

### Task 9: Swap the facade's Supabase branches

**Files:**
- Modify: `services/enhancedApi.ts` (17 call sites)

**Interfaces:**
- Consumes: `apiClient` (Task 8)
- Produces: `enhancedApi` with identical exported signatures — no consumer changes.

- [ ] **Step 1: Confirm the call sites before touching anything**

Run: `grep -n "supabaseService\.\|isSupabaseAvailable" services/enhancedApi.ts`
Expected: 17 `supabaseService.*` references plus the `isSupabaseAvailable` flag.

- [ ] **Step 2: Replace the import**

At `services/enhancedApi.ts:19`, change:

```ts
import { supabaseService } from './supabaseService';
```

to:

```ts
import { apiClient } from './apiClient';
```

- [ ] **Step 3: Replace the availability probe**

`services/enhancedApi.ts:542-562` defines `initializeDatabase()` and calls it
fire-and-forget at module load. That races: `isSupabaseAvailable` is still `false`
during the first renders. Under Supabase that only meant briefly stale reads; with
a local API it means early **writes** land in the in-memory arrays and are lost —
the exact failure this migration exists to fix.

Delete `initializeDatabase()` and its bare call. Replace with a memoized promise
that every call site awaits, so there is no window where the flag is wrong:

```ts
let apiReady: Promise<boolean> | null = null;

// Memoised: probes once, every caller awaits the same result.
function ensureApi(): Promise<boolean> {
  apiReady ??= apiClient
    .getUsers()
    .then(() => true)
    .catch((err) => {
      console.warn('Local API unavailable, using in-memory store:', err);
      return false;
    });
  return apiReady;
}
```

- [ ] **Step 4: Rewrite each call site**

Every branch has the same shape. Rename the flag and the service — the method names were chosen in Task 8 to match exactly:

```ts
// before
if (isSupabaseAvailable) {
  return await supabaseService.getUsers();
}
// after
if (await ensureApi()) {
  return await apiClient.getUsers();
}
```

Every call site must use `await ensureApi()` — not a bare boolean. All 17 are
already inside `async` functions, so `await` is legal at each one.

Apply to all 17 sites. `getCurrentUser`, `getUsers` (x2), `getUserById`, `createUser`, `updateUser`, `deleteUser`, `getProjects` (x2), `createProject`, `getTasksForProject` (x4), `getTasksForUser`, `createTask`, `updateTask`.

- [ ] **Step 5: Confirm the mockApi shim still binds correctly**

`services/mockApi.ts` re-exports `enhancedApi` methods by reference
(`getCurrentUser: enhancedApi.getCurrentUser`) and is imported by `App.tsx`.
It needs no edit — but the references detach from their receiver, so
`enhancedApi` must remain an object of arrow functions. Do not convert it to a
class using `this` while making these edits.

Run: `grep -n "enhancedApi\." services/mockApi.ts | wc -l`
Expected: `20` — unchanged.

- [ ] **Step 6: Verify nothing references Supabase in this file**

Run: `grep -c "supabase\|Supabase" services/enhancedApi.ts`
Expected: `0`

Run: `grep -c "isSupabaseAvailable\|initializeDatabase" services/enhancedApi.ts`
Expected: `0` — the old flag and fire-and-forget probe are fully removed.

- [ ] **Step 7: Run the app end to end**

In one terminal: `npm run server`
In another: `npm run dev`
Open `http://localhost:3000`, then:
- Confirm the "AOP 2025-26 Enterprise Plan" project renders.
- Create a task.
- **Reload the page and confirm the task is still there.** This is the whole point of the migration; if it vanishes, the write path is still hitting the in-memory arrays.

- [ ] **Step 8: Commit**

```bash
git add services/enhancedApi.ts
git commit -m "feat: route enhancedApi through local API instead of Supabase"
```

---

### Task 10: Remove the authentication gate

**Files:**
- Modify: `services/authService.ts`, `App.tsx:383-384`
- Delete: `components/AuthPage.tsx`

- [ ] **Step 1: Simplify authService**

Replace the Supabase-and-fallback logic in `services/authService.ts` with a single-user session. Delete `login`, `register`, `hashPassword` and `verifyPassword` entirely:

```ts
import { apiClient } from './apiClient';
import type { User } from '../types';

export class AuthService {
  private static currentUser: User | null = null;

  // No authentication: the API always returns the seeded single user.
  static async getCurrentUser(): Promise<User> {
    if (!this.currentUser) {
      this.currentUser = await apiClient.getCurrentUser();
    }
    return this.currentUser;
  }

  static async logout(): Promise<void> {
    this.currentUser = null;
  }
}
```

- [ ] **Step 2: Remove the gate in App.tsx**

Delete the `AuthPage` import at `App.tsx:9` and replace the null-user branch at `App.tsx:383-384` so the app loads the seeded user instead of rendering a login screen. In the effect that sets `currentUser`, call `AuthService.getCurrentUser()`.

- [ ] **Step 3: Delete the login screen**

```bash
git rm components/AuthPage.tsx
```

Dead code that reads like working authentication is a trap for the next reader; it remains recoverable from git history.

- [ ] **Step 4: Verify**

Run: `npm run lint`
Expected: no unresolved references to `AuthPage`, `login`, or `register`.

Then reload the app: it should go straight to the board with no login screen.

- [ ] **Step 5: Commit**

```bash
git add -A App.tsx services/authService.ts components/
git commit -m "feat: remove login gate and auto-load single seeded user"
```

---

### Task 11: Delete Supabase

**Files:**
- Delete: `services/supabaseService.ts`, `supabase-schema.sql`
- Modify: `package.json`, `.env.example`, `README.md`

- [ ] **Step 1: Confirm nothing imports it**

Run: `grep -rn "supabaseService\|@supabase" --include="*.ts" --include="*.tsx" .`
Expected: no matches outside `services/supabaseService.ts` itself.

- [ ] **Step 2: Delete the files and the dependency**

```bash
git rm services/supabaseService.ts supabase-schema.sql
npm uninstall @supabase/supabase-js
```

`supabase-schema.sql` is superseded by `server/db/schema.sql`, which is the accurate model.

- [ ] **Step 3: Replace the environment template**

Overwrite `.env.example`:

```
# Local API server (see npm run server)
VITE_API_URL=/api
DB_PATH=data/taskflow.db
```

- [ ] **Step 4: Update the README**

Replace any Supabase setup instructions with:

```markdown
## Running locally

    npm install
    npm run server   # API on http://127.0.0.1:4000
    npm run dev      # UI on http://localhost:3000

Data is stored in `data/taskflow.db` (SQLite). To reset, delete that file —
it is re-seeded with demo data on next start. There is no authentication;
the app runs as a single user.
```

- [ ] **Step 5: Verify the full suite and a clean boot**

```bash
npx vitest run --coverage
rm -rf data && npm run server
```

Expected: tests pass at 80%+ on `server/`; the server recreates and re-seeds `data/taskflow.db`; the app loads with demo data.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove Supabase dependency and schema"
```

---

## Follow-on plans (not in scope here)

- **Phase 2** — persist comments, time_entries, milestones, portfolios and goals. These are in-memory arrays today and have never survived a refresh. Net-new capability.
- **Phase 3** — move `calendar_events` from localStorage into SQLite. Notifications, reminders and theme stay in localStorage as per-device UI state.
