# Execution System — Phase 0 & 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the legacy migration (Phase 0), then lay the foundation the execution system is built on (Phase 1): a new `src/` shell with real URLs, a second SQLite database with a migration runner and the nine tables, the `/api/exec` layer with its response envelope, a Tailwind v4 build, the phone-reach bind option, strict TypeScript for new code, and the test harness (vitest projects + Playwright).

**Architecture:** The legacy Asana-style UI keeps its own stack (`enhancedApi` → `apiSync` → `apiClient` → `/api/*`) untouched and is lazy-loaded at `/legacy/*`. The new app under `src/` talks to `/api/exec/*` through a small fetch client and TanStack Query. `/api/exec/*` is an Express router mounted by the same `createApp`, backed by `data/execution.db`, which is created and evolved only by numbered SQL migrations. At the end of Phase 1 the app boots to an empty Today screen that says "Plan your first week"; every product behavior arrives in Phases 2–6.

**Tech Stack:** Node 22 · React 19.2 · Vite 6.4 (installed; do not upgrade) · Vitest 4.1 · TypeScript 5.8 · Express 5 · better-sqlite3 13 · react-router-dom 7 · @tanstack/react-query 5 · Tailwind CSS 4 via `@tailwindcss/vite` · zod 4 · Testing Library 16 + jsdom 30 · Playwright 1.63

**Spec:** `docs/superpowers/specs/2026-09-22-execution-system-design.md` (sections A, B "Conventions", "Tables", "Migrations", D "Testing", "Build sequence" Phases 0–1). Requirements: `docs/superpowers/specs/2026-09-22-execution-system-handoff.md`.

## Global Constraints

Copied from the spec; every task's requirements include these.

- The API always binds `127.0.0.1`; the port comes from `TASKFLOW_API_PORT` (default `4100`). Only the Vite dev server may bind elsewhere, and only through `TASKFLOW_BIND`.
- The execution database is `data/execution.db`, overridable with `EXEC_DB_PATH`. All its tables are `STRICT`; every connection sets `foreign_keys = ON`, `journal_mode = WAL`, `busy_timeout = 5000`.
- Schema changes to `execution.db` happen only through `server/exec/migrations/NNN_name.sql`, applied by `PRAGMA user_version`. No demo data is ever seeded.
- `/api/exec/*` responses are `{ success: true, data }` or `{ success: false, error, code }` with `code` one of `VALIDATION`, `NOT_FOUND`, `WEEK_FULL`, `DAY_TAKEN`, `SLOT_LIMIT`, `SHUTDOWN_NOT_READY`, `DELETE_NOT_ALLOWED`, `CONSTRAINT`, `INTERNAL`. Error responses never carry a stack trace or a file path.
- `id` columns are server-generated UUIDs (`crypto.randomUUID()`); `created_at`/`updated_at` are ISO-8601 UTC strings set by the server; calendar dates are `YYYY-MM-DD`; times of day are `HH:MM`.
- New code (`src/`, `server/`, root config files) compiles under `strict: true`. Legacy code (`components/`, `services/`, `utils/`, `App.tsx`) is not modified beyond what Phase 0 prescribes and is not type-checked under strict.
- Files stay under 400 lines and functions under 50 lines. No `console.log` in application code (the server's startup banner and `console.error` in error handlers are the standing exceptions). Create new objects rather than mutating.
- TDD: the failing test lands before the code that passes it. Coverage threshold stays 80% lines and now covers `server/exec/**` and `src/**`.
- Commit messages follow `<type>: <description>` (feat, fix, refactor, docs, test, chore). Attribution trailers are disabled in this repo's settings; do not add them. Never push unless asked.
- Legacy tests (181 today) keep passing unchanged throughout.

---

## File Structure

Created or modified in this plan. One responsibility per file.

**Phase 0 (legacy repo, per the existing plan)**
- Modify: `services/authService.ts`, `App.tsx`, `package.json`, `.env.example`, `README.md`, `vite.config.ts`
- Delete: `components/AuthPage.tsx`, `services/supabaseService.ts`, `supabase-schema.sql`

**Server — execution database and API**
- `server/exec/db/open.ts` — `openExecDb(path)`: better-sqlite3 connection with the required pragmas.
- `server/exec/db/migrate.ts` — `listMigrations`, `currentVersion`, `migrate`: the `user_version` runner.
- `server/exec/db/prepare.ts` — `prepareExecDb(path)`: open + migrate, the one entry point the app and tests use.
- `server/exec/migrations/001_init.sql` — the nine tables, indexes and the settings row.
- `server/exec/http.ts` — `ApiError`, `ok`, `fail`, `execErrorHandler`: the envelope.
- `server/exec/router.ts` — `createExecRouter(db)`: mounts resources (only `/health` in this phase) and the error handler.
- `server/config.ts` — add `bindHost`, `allowedHosts`, `isLoopback`, `execDbPath`.
- `server/app.ts` — open the execution database and mount `/api/exec`.
- Tests: `server/exec/__tests__/migrate.test.ts`, `schema.test.ts`, `http.test.ts`, `health.test.ts`; additions to `server/__tests__/config.test.ts`.

**Shared**
- `src/shared/exec/api.ts` — envelope types and the `ErrorCode` union, imported by both server and client.

**Client**
- `src/api/client.ts` — `api.get/post/patch/put/delete`, `ApiError`.
- `src/api/queryClient.ts` — `createQueryClient`.
- `src/api/health.ts` — `useHealth()`.
- `src/app/AppProviders.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`, `src/app/Shell.tsx`, `src/app/FullScreen.tsx`, `src/app/Legacy.tsx`
- `src/components/ScreenShell.tsx`, `src/components/ApiStatus.tsx`
- `src/screens/Today.tsx`, `Week.tsx`, `Inbox.tsx`, `Projects.tsx`, `Review.tsx`, `Focus.tsx`, `Shutdown.tsx`, `Plan.tsx`, `Capture.tsx` — shells replaced in Phases 2–6.
- `src/styles/app.css` — Tailwind v4 entry, dark variant, tokens.
- `src/legacy-app.d.ts`, `src/vite-env.d.ts` — ambient declarations.
- `src/test/setup.ts`, `src/test/render.tsx` — jsdom project setup and render helpers.
- Tests: `src/api/client.test.ts`, `src/api/health.test.tsx`, `src/components/ApiStatus.test.tsx`, `src/app/App.test.tsx`, `src/test/setup.test.tsx`.

**Root**
- `index.html`, `index.tsx` — mount the new app.
- `vite.config.ts`, `vitest.config.ts`, `tsconfig.app.json`, `package.json`, `.env.example`, `.gitignore`, `README.md`
- `e2e/playwright.config.ts`, `e2e/smoke.spec.ts`, `e2e/phone.spec.ts`

---

### Task 0: Phase 0 — finish the legacy clean-up and branch

**Files:**
- Everything listed under Tasks 10 and 11 of `docs/superpowers/plans/2026-09-01-local-sqlite-db.md` (lines 1486–1640)
- Modify: `vite.config.ts:18-21`

**Interfaces:**
- Consumes: the existing plan's Task 10 (`AuthService.getCurrentUser()`, gate removal) and Task 11 (Supabase deletion).
- Produces: a legacy app that opens with no login screen, `data/taskflow.db` on disk, branch `feat/execution-system`.

- [ ] **Step 1: Execute Task 10 of the existing plan, steps 1–5**

Open `docs/superpowers/plans/2026-09-01-local-sqlite-db.md` at line 1486 ("Task 10: Remove the authentication gate") and follow its five steps exactly: simplify `services/authService.ts` to `getCurrentUser`/`logout`, remove the `AuthPage` import and the null-user branch in `App.tsx`, `git rm components/AuthPage.tsx`, verify, and commit with the message it gives (`feat: remove login gate and auto-load single seeded user`).

Its Step 4 is the first end-to-end run of the legacy app against SQLite. Do it: `npm run server` in one terminal, `npm run dev` in another, open `http://127.0.0.1:3000`, create a task, delete another, drag one to a new column, add a section, reload, confirm all four survived, then stop the server and confirm the app still opens on demo data.

- [ ] **Step 2: Execute Task 11 of the existing plan, steps 1–6**

From line 1552 ("Task 11: Delete Supabase"): confirm nothing imports it, `git rm services/supabaseService.ts supabase-schema.sql`, `npm uninstall @supabase/supabase-js`, overwrite `.env.example` and update `README.md` as it specifies, verify, and commit (`chore: remove Supabase dependency and schema`).

- [ ] **Step 3: Drop the unused Gemini define**

In `vite.config.ts`, delete these lines (18–21):

```ts
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
```

and, since `env` is now unused, change the function signature and drop the `loadEnv` import:

```ts
import path from 'path';
import { defineConfig } from 'vite';
import { API_HOST, apiPort } from './server/config';

export default defineConfig(() => {
    return {
```

- [ ] **Step 4: Verify**

Run: `npm run lint && npx vitest run --coverage`
Expected: type check clean; all tests pass; coverage ≥ 80% on `server/`.

Run: `grep -rn "GEMINI\|supabase\|AuthPage" --include="*.ts" --include="*.tsx" --include="*.json" . | grep -v node_modules | grep -v docs/`
Expected: no output.

Run: `ls -la data/taskflow.db`
Expected: the file exists (created by Step 1's end-to-end run).

- [ ] **Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "chore: drop unused Gemini env define"
```

- [ ] **Step 6: Merge Phase 0 to main and open the Phase 1 branch**

```bash
git checkout main
git merge --ff-only feat/local-sqlite-db
git checkout -b feat/execution-system
git log --oneline -1
```

Expected: `main` now points at the Phase 0 commits; you are on `feat/execution-system`. Do not push.

---

### Task 1: Dependencies, strict config and the two-project test harness

**Files:**
- Modify: `package.json`, `vitest.config.ts`
- Create: `tsconfig.app.json`, `src/vite-env.d.ts`, `src/test/setup.ts`, `src/test/setup.test.tsx`

**Interfaces:**
- Produces: `npm run lint` (root + strict configs), `npx vitest run` running projects `node` and `jsdom`, jest-dom matchers in every jsdom test.

- [ ] **Step 1: Install the runtime dependencies**

```bash
npm install react-router-dom@^7.18.4 @tanstack/react-query@^5.103.2 tailwindcss@^4.3.3 @tailwindcss/vite@^4.3.3 zod@^4.6.5
```

- [ ] **Step 2: Install the development dependencies**

```bash
npm install -D @testing-library/react@^16.3.3 @testing-library/dom@^10.4.0 @testing-library/jest-dom@^7.0.1 @testing-library/user-event@^14.6.7 jsdom@^30.1.1 @playwright/test@^1.63.0 @types/react@^19.2.0 @types/react-dom@^19.2.0
```

`@types/react` is new to this repo: nothing was typed against React before, and the strict config below would fail without it.

- [ ] **Step 3: Write the failing jsdom smoke test**

Create `src/test/setup.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('jsdom project', () => {
  it('renders React into a DOM and has the jest-dom matchers', () => {
    render(<p>foundation</p>);
    expect(screen.getByText('foundation')).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `npx vitest run --project jsdom`
Expected: FAIL — vitest reports no project named `jsdom` (or that no test files matched).

- [ ] **Step 5: Split vitest into two projects**

Overwrite `vitest.config.ts`:

```ts
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The legacy workspace is imported as 'legacy-app' so the strict TypeScript
    // program never follows the import into the untyped legacy tree.
    alias: { 'legacy-app': path.resolve(__dirname, 'App.tsx') },
  },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['server/**/*.test.ts', 'services/**/*.test.ts', 'src/shared/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/shared/**', 'node_modules/**'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
    coverage: {
      include: ['server/**/*.ts', 'services/apiClient.ts', 'services/apiSync.ts', 'src/**/*.{ts,tsx}'],
      exclude: [
        'server/index.ts',
        'src/**/*.test.*',
        'src/test/**',
        'src/app/Legacy.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: { lines: 80 },
    },
  },
});
```

Create `src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 6: Run the jsdom project to verify it passes**

Run: `npx vitest run --project jsdom`
Expected: PASS, 1 test.

Run: `npx vitest run`
Expected: both projects run; 182 tests pass (181 legacy + 1).

- [ ] **Step 7: Add the strict TypeScript config**

Create `tsconfig.app.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "server", "e2e", "index.tsx", "vite.config.ts", "vitest.config.ts"]
}
```

Create `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

In `package.json`, change the `lint` script:

```json
"lint": "tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.app.json",
```

- [ ] **Step 8: Run the lint to verify both programs compile**

Run: `npm run lint`
Expected: clean. (`server/` was verified to pass `strict` before this plan was written; `src/` holds only the setup files so far.)

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.app.json src/vite-env.d.ts src/test/setup.ts src/test/setup.test.tsx
git commit -m "chore: add execution system dependencies, strict tsconfig and jsdom test project"
```

---

### Task 2: Execution database connection and migration runner

**Files:**
- Create: `server/exec/db/open.ts`, `server/exec/db/migrate.ts`, `server/exec/db/prepare.ts`
- Test: `server/exec/__tests__/migrate.test.ts`

**Interfaces:**
- Produces:
  - `openExecDb(path: string): Database.Database`
  - `listMigrations(dir: string): Migration[]` where `Migration = { version: number; name: string; sql: string }`
  - `currentVersion(db): number`
  - `migrate(db, dir?: string): Migration[]` (returns what it applied)
  - `MIGRATIONS_DIR: string` (absolute path of `server/exec/migrations`)
  - `prepareExecDb(path: string): Database.Database` (open + migrate against `MIGRATIONS_DIR`)

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/migrate.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { openExecDb } from '../db/open';
import { listMigrations, currentVersion, migrate } from '../db/migrate';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'exec-migrations-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const write = (name: string, sql: string) => writeFileSync(join(dir, name), sql);

const tables = (db: Database.Database) =>
  db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all();

describe('openExecDb', () => {
  it('enables foreign keys and a busy timeout on every connection', () => {
    const db = openExecDb(':memory:');
    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(db.pragma('busy_timeout', { simple: true })).toBe(5000);
  });
});

describe('listMigrations', () => {
  it('returns NNN_name.sql files in version order and ignores everything else', () => {
    write('002_second.sql', 'CREATE TABLE b (x INTEGER);');
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    write('notes.txt', 'ignored');
    write('003_draft.sql.bak', 'ignored');
    expect(listMigrations(dir).map((m) => [m.version, m.name])).toEqual([
      [1, 'first'],
      [2, 'second'],
    ]);
  });

  it('rejects two files that claim the same version', () => {
    write('001_a.sql', 'SELECT 1;');
    write('001_b.sql', 'SELECT 1;');
    expect(() => listMigrations(dir)).toThrow(/duplicate migration version 1/);
  });
});

describe('migrate', () => {
  it('applies every pending migration in order and records the version', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    write('002_second.sql', 'CREATE TABLE b (x INTEGER);');
    const db = openExecDb(':memory:');
    const applied = migrate(db, dir);
    expect(applied.map((m) => m.version)).toEqual([1, 2]);
    expect(currentVersion(db)).toBe(2);
    expect(tables(db)).toEqual(['a', 'b']);
  });

  it('is idempotent: a second run applies nothing', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    expect(migrate(db, dir)).toEqual([]);
    expect(currentVersion(db)).toBe(1);
  });

  it('applies only the migrations above the current version', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    write('002_second.sql', 'CREATE TABLE b (x INTEGER);');
    expect(migrate(db, dir).map((m) => m.version)).toEqual([2]);
    expect(tables(db)).toEqual(['a', 'b']);
  });

  it('rolls back a failing migration and leaves the version where it was', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    write('002_broken.sql', 'CREATE TABLE b (x INTEGER); INSERT INTO nope VALUES (1);');
    const db = openExecDb(':memory:');
    expect(() => migrate(db, dir)).toThrow(/no such table: nope/);
    expect(currentVersion(db)).toBe(1);
    expect(tables(db)).toEqual(['a']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/migrate.test.ts`
Expected: FAIL — cannot resolve `../db/open` / `../db/migrate`.

- [ ] **Step 3: Write the connection module**

Create `server/exec/db/open.ts`:

```ts
import Database from 'better-sqlite3';

/**
 * Opens the execution database. Every pragma here is per-connection, so this is
 * the only place a connection may be created.
 */
export function openExecDb(path: string): Database.Database {
  const db = new Database(path);
  db.pragma('foreign_keys = ON'); // SQLite ignores FK constraints unless enabled per connection
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000'); // wait instead of throwing SQLITE_BUSY when another process holds the file
  return db;
}
```

- [ ] **Step 4: Write the migration runner**

Create `server/exec/db/migrate.ts`:

```ts
import type Database from 'better-sqlite3';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path of the real migrations; tests pass their own directory. */
export const MIGRATIONS_DIR = join(here, '..', 'migrations');

export type Migration = { version: number; name: string; sql: string };

const FILE_PATTERN = /^(\d{3})_([a-z0-9_]+)\.sql$/;

/** Reads NNN_name.sql files in version order. Anything else in the directory is ignored. */
export function listMigrations(dir: string): Migration[] {
  const migrations = readdirSync(dir)
    .map((file) => ({ file, match: FILE_PATTERN.exec(file) }))
    .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ file, match }) => ({
      version: Number(match[1]),
      name: match[2],
      sql: readFileSync(join(dir, file), 'utf8'),
    }))
    .sort((a, b) => a.version - b.version);

  migrations.forEach((migration, index) => {
    const previous = migrations[index - 1];
    if (previous && previous.version === migration.version) {
      throw new Error(`duplicate migration version ${migration.version}`);
    }
  });
  return migrations;
}

/** The schema version SQLite stores in the file header. 0 on a brand-new database. */
export function currentVersion(db: Database.Database): number {
  return db.pragma('user_version', { simple: true }) as number;
}

/**
 * Applies every migration above the database's user_version, each in its own
 * transaction, so a failing file leaves the database exactly as it was.
 * Migration files must not contain BEGIN/COMMIT of their own.
 */
export function migrate(db: Database.Database, dir: string = MIGRATIONS_DIR): Migration[] {
  const pending = listMigrations(dir).filter((m) => m.version > currentVersion(db));
  for (const migration of pending) {
    db.transaction(() => {
      db.exec(migration.sql);
      db.pragma(`user_version = ${migration.version}`);
    })();
  }
  return pending;
}
```

Create `server/exec/db/prepare.ts`:

```ts
import type Database from 'better-sqlite3';
import { openExecDb } from './open';
import { migrate } from './migrate';

/** The one way the app and tests get a ready execution database. */
export function prepareExecDb(path: string): Database.Database {
  const db = openExecDb(path);
  migrate(db);
  return db;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/migrate.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add server/exec/db/open.ts server/exec/db/migrate.ts server/exec/db/prepare.ts server/exec/__tests__/migrate.test.ts
git commit -m "feat: add execution database connection and user_version migration runner"
```

---

### Task 3: The initial schema and its constraint tests

**Files:**
- Create: `server/exec/migrations/001_init.sql`
- Test: `server/exec/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: `prepareExecDb`, `currentVersion` from Task 2.
- Produces: tables `settings`, `projects`, `weeks`, `outcomes`, `must_ships`, `tasks`, `days`, `day_slots`, `deep_work_blocks` exactly as the spec's "Tables" section defines them; `user_version = 1`.

- [ ] **Step 1: Write the failing constraint tests**

Create `server/exec/__tests__/schema.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { currentVersion } from '../db/migrate';

const NOW = '2026-09-22T03:00:00.000Z';
let db: Database.Database;

const insertWeek = (id = 'w1', startDate = '2026-09-20') =>
  db.prepare('INSERT INTO weeks (id, start_date, created_at, updated_at) VALUES (?, ?, ?, ?)').run(id, startDate, NOW, NOW);

const insertOutcome = (id: string, slot: number | null, status = 'active') =>
  db
    .prepare(
      `INSERT INTO outcomes (id, week_id, slot, title, category, status, created_at, updated_at)
       VALUES (?, 'w1', ?, 'Outcome', 'office', ?, ?, ?)`
    )
    .run(id, slot, status, NOW, NOW);

const insertMustShip = (id: string, date: string | null, context: string) =>
  db
    .prepare(
      `INSERT INTO must_ships (id, title, context, date, created_at, updated_at) VALUES (?, 'Ship it', ?, ?, ?, ?)`
    )
    .run(id, context, date, NOW, NOW);

const insertTask = (id: string) =>
  db
    .prepare(`INSERT INTO tasks (id, title, context, captured_at, created_at, updated_at) VALUES (?, 'Task', 'work', ?, ?, ?)`)
    .run(id, NOW, NOW, NOW);

const insertDay = (date: string) =>
  db.prepare('INSERT INTO days (date, created_at, updated_at) VALUES (?, ?, ?)').run(date, NOW, NOW);

const insertSlot = (date: string, slot: number, taskId: string) =>
  db.prepare('INSERT INTO day_slots (date, slot, task_id, created_at) VALUES (?, ?, ?, ?)').run(date, slot, taskId, NOW);

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('001_init', () => {
  it('reaches schema version 1 with the nine tables', () => {
    expect(currentVersion(db)).toBe(1);
    const names = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").pluck().all();
    expect(names).toEqual([
      'day_slots',
      'days',
      'deep_work_blocks',
      'must_ships',
      'outcomes',
      'projects',
      'settings',
      'tasks',
      'weeks',
    ]);
  });

  it('seeds exactly one settings row with the default schedule and no other data', () => {
    const settings = db.prepare('SELECT * FROM settings').all() as Record<string, unknown>[];
    expect(settings).toHaveLength(1);
    expect(settings[0]).toMatchObject({
      id: 1,
      timezone: 'Asia/Karachi',
      week_start_day: 0,
      work_days: '[1,2,3,4,5]',
      deep_work_start: '08:35',
      deep_work_minutes: 90,
      shutdown_time: '17:00',
      office_start: '08:15',
      office_end: '18:00',
    });
    expect(JSON.parse(settings[0].build_blocks as string)).toEqual([
      { weekday: 2, start: '06:30', minutes: 50 },
      { weekday: 4, start: '06:30', minutes: 50 },
      { weekday: 6, start: '09:00', minutes: 180 },
    ]);
    for (const table of ['projects', 'weeks', 'outcomes', 'must_ships', 'tasks', 'days', 'deep_work_blocks']) {
      expect(db.prepare(`SELECT COUNT(*) FROM ${table}`).pluck().get()).toBe(0);
    }
  });

  it('refuses a second settings row', () => {
    expect(() =>
      db.prepare('INSERT INTO settings (id, created_at, updated_at) VALUES (2, ?, ?)').run(NOW, NOW)
    ).toThrow(/CHECK constraint failed/);
  });
});

describe('outcomes: at most three per week', () => {
  beforeEach(() => insertWeek());

  it('accepts slots 1 to 3 and rejects slot 4', () => {
    insertOutcome('o1', 1);
    insertOutcome('o2', 2);
    insertOutcome('o3', 3);
    expect(() => insertOutcome('o4', 4)).toThrow(/CHECK constraint failed/);
  });

  it('rejects two outcomes in the same slot of one week', () => {
    insertOutcome('o1', 1);
    expect(() => insertOutcome('o2', 1)).toThrow(/UNIQUE constraint failed: outcomes.week_id, outcomes.slot/);
  });

  it('allows a second week to reuse the slot numbers', () => {
    insertWeek('w2', '2026-09-27');
    insertOutcome('o1', 1);
    expect(() =>
      db
        .prepare(
          `INSERT INTO outcomes (id, week_id, slot, title, category, created_at, updated_at)
           VALUES ('o2', 'w2', 1, 'Outcome', 'office', ?, ?)`
        )
        .run(NOW, NOW)
    ).not.toThrow();
  });

  it('requires a killed outcome to give up its slot, and an active one to hold one', () => {
    expect(() => insertOutcome('killed-with-slot', 1, 'killed')).toThrow(/CHECK constraint failed/);
    expect(() => insertOutcome('active-without-slot', null, 'active')).toThrow(/CHECK constraint failed/);
    expect(() => insertOutcome('killed', null, 'killed')).not.toThrow();
  });

  it('lets a replacement take the slot a killed outcome released', () => {
    insertOutcome('o1', 1);
    insertOutcome('o2', 2);
    insertOutcome('o3', 3);
    db.prepare("UPDATE outcomes SET status = 'killed', slot = NULL WHERE id = 'o2'").run();
    expect(() => insertOutcome('o4', 2)).not.toThrow();
  });

  it('enforces the week foreign key', () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO outcomes (id, week_id, slot, title, category, created_at, updated_at)
           VALUES ('o1', 'missing', 1, 'Outcome', 'office', ?, ?)`
        )
        .run(NOW, NOW)
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('keeps progress between 0 and 100 and the review fields to their code lists', () => {
    insertOutcome('o1', 1);
    expect(() => db.prepare("UPDATE outcomes SET progress = 101 WHERE id = 'o1'").run()).toThrow(/CHECK/);
    expect(() => db.prepare("UPDATE outcomes SET review_reason = 'tired' WHERE id = 'o1'").run()).toThrow(/CHECK/);
    expect(() => db.prepare("UPDATE outcomes SET review_reason = 'too_many_meetings' WHERE id = 'o1'").run()).not.toThrow();
  });
});

describe('must_ships: at most one per day per context', () => {
  it('allows a work and a build Must Ship on the same date, but not two of one context', () => {
    insertMustShip('m1', '2026-09-22', 'work');
    insertMustShip('m2', '2026-09-22', 'build');
    expect(() => insertMustShip('m3', '2026-09-22', 'work')).toThrow(/UNIQUE constraint failed: must_ships.date, must_ships.context/);
  });

  it('allows any number of undated candidates', () => {
    insertMustShip('c1', null, 'work');
    insertMustShip('c2', null, 'work');
    expect(db.prepare('SELECT COUNT(*) FROM must_ships WHERE date IS NULL').pluck().get()).toBe(2);
  });

  it('starts planned with a zero roll count', () => {
    insertMustShip('m1', '2026-09-22', 'work');
    expect(db.prepare("SELECT status, roll_count FROM must_ships WHERE id = 'm1'").get()).toEqual({
      status: 'planned',
      roll_count: 0,
    });
  });
});

describe('day_slots: at most two secondaries per day', () => {
  beforeEach(() => {
    insertDay('2026-09-22');
    insertTask('t1');
    insertTask('t2');
    insertTask('t3');
  });

  it('accepts slots 1 and 2 and rejects slot 3', () => {
    insertSlot('2026-09-22', 1, 't1');
    insertSlot('2026-09-22', 2, 't2');
    expect(() => insertSlot('2026-09-22', 3, 't3')).toThrow(/CHECK constraint failed/);
  });

  it('rejects a second task in an occupied slot', () => {
    insertSlot('2026-09-22', 1, 't1');
    expect(() => insertSlot('2026-09-22', 1, 't2')).toThrow(/UNIQUE constraint failed: day_slots.date, day_slots.slot/);
  });

  it('rejects the same task in both slots', () => {
    insertSlot('2026-09-22', 1, 't1');
    expect(() => insertSlot('2026-09-22', 2, 't1')).toThrow(/UNIQUE constraint failed: day_slots.date, day_slots.task_id/);
  });

  it('removes the slots when the day is deleted', () => {
    insertSlot('2026-09-22', 1, 't1');
    db.prepare("DELETE FROM days WHERE date = '2026-09-22'").run();
    expect(db.prepare('SELECT COUNT(*) FROM day_slots').pluck().get()).toBe(0);
  });
});

describe('tasks', () => {
  it('starts in the inbox', () => {
    insertTask('t1');
    expect(db.prepare("SELECT status, roll_count FROM tasks WHERE id = 't1'").get()).toEqual({
      status: 'inbox',
      roll_count: 0,
    });
  });

  it('only accepts the seven statuses', () => {
    insertTask('t1');
    expect(() => db.prepare("UPDATE tasks SET status = 'someday' WHERE id = 't1'").run()).toThrow(/CHECK constraint failed/);
  });
});

describe('deep_work_blocks', () => {
  const insertBlock = (id: string, startedAt: string | null, endedAt: string | null) =>
    db
      .prepare(
        `INSERT INTO deep_work_blocks (id, date, context, planned_start, planned_minutes, started_at, ended_at, created_at, updated_at)
         VALUES (?, '2026-09-22', 'work', '08:35', 90, ?, ?, ?, ?)`
      )
      .run(id, startedAt, endedAt, NOW, NOW);

  it('cannot end before it has started', () => {
    expect(() => insertBlock('b1', null, NOW)).toThrow(/CHECK constraint failed/);
    expect(() => insertBlock('b2', NOW, NOW)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/schema.test.ts`
Expected: FAIL — `readdirSync` cannot find `server/exec/migrations` (ENOENT).

- [ ] **Step 3: Write the initial migration**

Create `server/exec/migrations/001_init.sql`:

```sql
-- Execution system, schema version 1. Derived from
-- docs/superpowers/specs/2026-09-22-execution-system-design.md, section B.
-- Never edit this file after it has shipped; add 002_*.sql instead.

CREATE TABLE settings (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  timezone          TEXT    NOT NULL DEFAULT 'Asia/Karachi',
  week_start_day    INTEGER NOT NULL DEFAULT 0 CHECK (week_start_day BETWEEN 0 AND 6),
  work_days         TEXT    NOT NULL DEFAULT '[1,2,3,4,5]',
  deep_work_start   TEXT    NOT NULL DEFAULT '08:35',
  deep_work_minutes INTEGER NOT NULL DEFAULT 90 CHECK (deep_work_minutes > 0),
  shutdown_time     TEXT    NOT NULL DEFAULT '17:00',
  office_start      TEXT    NOT NULL DEFAULT '08:15',
  office_end        TEXT    NOT NULL DEFAULT '18:00',
  build_blocks      TEXT    NOT NULL DEFAULT '[{"weekday":2,"start":"06:30","minutes":50},{"weekday":4,"start":"06:30","minutes":50},{"weekday":6,"start":"09:00","minutes":180}]',
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL
) STRICT;

INSERT INTO settings (id, created_at, updated_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE projects (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  context    TEXT NOT NULL CHECK (context IN ('work', 'build')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE weeks (
  id           TEXT PRIMARY KEY,
  start_date   TEXT NOT NULL UNIQUE,
  reviewed_at  TEXT,
  review_notes TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
) STRICT;

CREATE TABLE outcomes (
  id                 TEXT PRIMARY KEY,
  week_id            TEXT    NOT NULL REFERENCES weeks(id),
  slot               INTEGER CHECK (slot IN (1, 2, 3)),
  title              TEXT    NOT NULL,
  description        TEXT    NOT NULL DEFAULT '',
  category           TEXT    NOT NULL CHECK (category IN ('office', 'business', 'career', 'personal')),
  definition_of_done TEXT    NOT NULL DEFAULT '',
  target_date        TEXT,
  project_id         TEXT    REFERENCES projects(id),
  progress           INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status             TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'killed')),
  review_grade       TEXT    CHECK (review_grade IN ('done', 'partial', 'missed')),
  review_reason      TEXT    CHECK (review_reason IN (
                       'insufficient_time', 'unexpected_urgent_work', 'dependency_blocker', 'poor_estimation',
                       'too_many_meetings', 'priority_changed', 'procrastination', 'unclear_outcome',
                       'delegated_dependency', 'no_longer_important', 'other')),
  review_disposition TEXT    CHECK (review_disposition IN ('roll_forward', 'reschedule', 'delegate', 'kill')),
  rolled_from_id     TEXT    REFERENCES outcomes(id),
  notes              TEXT    NOT NULL DEFAULT '',
  closed_at          TEXT,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  UNIQUE (week_id, slot),
  -- A killed outcome frees its slot; every other outcome holds one.
  CHECK ((status = 'killed') = (slot IS NULL))
) STRICT;

CREATE INDEX idx_outcomes_week ON outcomes(week_id);

CREATE TABLE must_ships (
  id                  TEXT PRIMARY KEY,
  title               TEXT    NOT NULL,
  definition_of_done  TEXT    NOT NULL DEFAULT '',
  context             TEXT    NOT NULL CHECK (context IN ('work', 'build')),
  date                TEXT,
  outcome_id          TEXT    REFERENCES outcomes(id),
  project_id          TEXT    REFERENCES projects(id),
  status              TEXT    NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'shipped', 'partial', 'missed', 'blocked', 'killed')),
  blocker_what        TEXT,
  blocker_owner       TEXT,
  blocker_next_action TEXT,
  notes               TEXT    NOT NULL DEFAULT '',
  rolled_from_id      TEXT    REFERENCES must_ships(id),
  roll_count          INTEGER NOT NULL DEFAULT 0,
  closed_at           TEXT,
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL,
  -- NULL dates are distinct to UNIQUE, so undated candidates are unlimited.
  UNIQUE (date, context)
) STRICT;

CREATE INDEX idx_must_ships_date ON must_ships(date);

CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT    NOT NULL,
  notes           TEXT    NOT NULL DEFAULT '',
  context         TEXT    NOT NULL CHECK (context IN ('work', 'build')),
  status          TEXT    NOT NULL DEFAULT 'inbox'
                    CHECK (status IN ('inbox', 'this_week', 'later', 'delegated', 'waiting', 'done', 'killed')),
  project_id      TEXT    REFERENCES projects(id),
  outcome_id      TEXT    REFERENCES outcomes(id),
  must_ship_id    TEXT    REFERENCES must_ships(id),
  scheduled_date  TEXT,
  due_date        TEXT,
  owner_name      TEXT,
  expected_output TEXT,
  follow_up_date  TEXT,
  roll_count      INTEGER NOT NULL DEFAULT 0,
  rolled_at       TEXT,
  captured_at     TEXT    NOT NULL,
  processed_at    TEXT,
  delegated_at    TEXT,
  closed_at       TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
) STRICT;

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_scheduled_date ON tasks(scheduled_date);
CREATE INDEX idx_tasks_follow_up_date ON tasks(follow_up_date);

CREATE TABLE days (
  date        TEXT PRIMARY KEY,
  shutdown_at TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
) STRICT;

CREATE TABLE day_slots (
  date       TEXT    NOT NULL REFERENCES days(date) ON DELETE CASCADE,
  slot       INTEGER NOT NULL CHECK (slot IN (1, 2)),
  task_id    TEXT    NOT NULL REFERENCES tasks(id),
  created_at TEXT    NOT NULL,
  PRIMARY KEY (date, slot),
  UNIQUE (date, task_id)
) STRICT;

CREATE TABLE deep_work_blocks (
  id               TEXT PRIMARY KEY,
  date             TEXT    NOT NULL,
  context          TEXT    NOT NULL CHECK (context IN ('work', 'build')),
  planned_start    TEXT    NOT NULL,
  planned_minutes  INTEGER NOT NULL CHECK (planned_minutes > 0),
  outcome_id       TEXT    REFERENCES outcomes(id),
  must_ship_id     TEXT    REFERENCES must_ships(id),
  started_at       TEXT,
  ended_at         TEXT,
  paused_seconds   INTEGER NOT NULL DEFAULT 0,
  pause_started_at TEXT,
  result           TEXT    CHECK (result IN ('completed', 'progress', 'blocked', 'abandoned')),
  notes            TEXT    NOT NULL DEFAULT '',
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  CHECK (ended_at IS NULL OR started_at IS NOT NULL)
) STRICT;

CREATE INDEX idx_deep_work_blocks_date ON deep_work_blocks(date);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/schema.test.ts`
Expected: PASS, 20 tests.

- [ ] **Step 5: Commit**

```bash
git add server/exec/migrations/001_init.sql server/exec/__tests__/schema.test.ts
git commit -m "feat: add execution schema with the outcome, must ship and slot limits as constraints"
```

---

### Task 4: The `/api/exec` envelope, error handler and health route

**Files:**
- Create: `src/shared/exec/api.ts`, `server/exec/http.ts`, `server/exec/router.ts`
- Modify: `server/config.ts`, `server/app.ts`
- Test: `server/exec/__tests__/http.test.ts`, `server/exec/__tests__/health.test.ts`

**Interfaces:**
- Consumes: `prepareExecDb`, `currentVersion` (Task 2).
- Produces:
  - `src/shared/exec/api.ts`: `ERROR_CODES`, `type ErrorCode`, `type ApiSuccess<T> = { success: true; data: T }`, `type ApiFailure = { success: false; error: string; code: ErrorCode; details?: unknown }`, `type ApiResponse<T>`, `type Health = { status: 'ok'; schemaVersion: number }`
  - `server/exec/http.ts`: `class ApiError extends Error { status; code; details? }`, `ok(res, data, status = 200)`, `fail(res, status, code, error, details?)`, `execErrorHandler: ErrorRequestHandler`
  - `server/exec/router.ts`: `createExecRouter(db: Database.Database): Router` with `GET /health`
  - `server/config.ts`: `execDbPath(env): string`
  - `server/app.ts`: `createApp(injected?: Database.Database, execInjected?: Database.Database)` mounting `/api/exec`

- [ ] **Step 1: Write the shared envelope types**

Create `src/shared/exec/api.ts`:

```ts
/** The response envelope of every /api/exec route, shared by server and client. */

export const ERROR_CODES = [
  'VALIDATION',
  'NOT_FOUND',
  'WEEK_FULL',
  'DAY_TAKEN',
  'SLOT_LIMIT',
  'SHUTDOWN_NOT_READY',
  'DELETE_NOT_ALLOWED',
  'CONSTRAINT',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: string; code: ErrorCode; details?: unknown };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type Health = { status: 'ok'; schemaVersion: number };
```

- [ ] **Step 2: Write the failing error-handler tests**

Create `server/exec/__tests__/http.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError, execErrorHandler } from '../http';

function fakeResponse() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

const run = (err: unknown) => {
  const res = fakeResponse();
  execErrorHandler(err, {} as Request, res as unknown as Response, () => {});
  return res;
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('execErrorHandler', () => {
  it('sends an ApiError as its status, code, message and details', () => {
    const res = run(new ApiError(409, 'WEEK_FULL', 'the week already has three outcomes', { outcomes: [] }));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: 'the week already has three outcomes',
      code: 'WEEK_FULL',
      details: { outcomes: [] },
    });
  });

  it('omits details when an ApiError has none', () => {
    const res = run(new ApiError(404, 'NOT_FOUND', 'no such task'));
    expect(res.body).toEqual({ success: false, error: 'no such task', code: 'NOT_FOUND' });
  });

  it('turns a zod failure into 400 VALIDATION with the failing paths, never the input', () => {
    const result = z.object({ title: z.string(), context: z.enum(['work', 'build']) }).safeParse({ context: 'home' });
    const res = run(result.error);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'VALIDATION', error: 'invalid request body' });
    const details = (res.body as { details: { path: string }[] }).details;
    expect(details.map((d) => d.path).sort()).toEqual(['context', 'title']);
    expect(JSON.stringify(res.body)).not.toContain('home');
  });

  it('maps body-parser rejections to their 4xx status', () => {
    const tooLarge = run(Object.assign(new Error('request entity too large'), { status: 413 }));
    expect(tooLarge.statusCode).toBe(413);
    expect(tooLarge.body).toEqual({ success: false, error: 'request body too large', code: 'VALIDATION' });

    const malformed = run(Object.assign(new Error('Unexpected token'), { status: 400 }));
    expect(malformed.body).toEqual({ success: false, error: 'invalid request body', code: 'VALIDATION' });
  });

  it('maps SQLite constraint failures to 400 CONSTRAINT without the driver message', () => {
    const res = run(Object.assign(new Error('UNIQUE constraint failed: must_ships.date'), { code: 'SQLITE_CONSTRAINT_UNIQUE' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'constraint violation', code: 'CONSTRAINT' });
  });

  it('hides everything else behind 500 INTERNAL', () => {
    const res = run(new Error('boom at /mnt/secret/path.ts:12'));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'internal server error', code: 'INTERNAL' });
    expect(JSON.stringify(res.body)).not.toContain('/mnt/');
  });
});
```

- [ ] **Step 3: Write the failing health tests**

Create `server/exec/__tests__/health.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import request from 'supertest';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';

function legacyDb() {
  const db = openDb(':memory:');
  initSchema(db);
  return db;
}

describe('GET /api/exec/health', () => {
  it('answers in the envelope with the schema version', async () => {
    const app = createApp(legacyDb(), prepareExecDb(':memory:'));
    const res = await request(app).get('/api/exec/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok', schemaVersion: 1 } });
  });

  it('opens an in-memory execution database, never a file, when none is injected under the test runner', async () => {
    const app = createApp(legacyDb());
    const res = await request(app).get('/api/exec/health');
    expect(res.status).toBe(200);
    expect(existsSync('data/execution.db')).toBe(false);
  });

  it('leaves the legacy health route untouched', async () => {
    const res = await request(createApp(legacyDb(), prepareExecDb(':memory:'))).get('/api/health');
    expect(res.body).toEqual({ status: 'ok' });
  });
});
```

- [ ] **Step 4: Run both test files to verify they fail**

Run: `npx vitest run server/exec/__tests__/http.test.ts server/exec/__tests__/health.test.ts`
Expected: FAIL — cannot resolve `../http`; `/api/exec/health` returns 404.

- [ ] **Step 5: Write the envelope and error handler**

Create `server/exec/http.ts`:

```ts
import type { ErrorRequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import type { ErrorCode } from '../../src/shared/exec/api';

/** An error a route raises on purpose; the handler sends it as-is. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function fail(res: Response, status: number, code: ErrorCode, error: string, details?: unknown): void {
  const body = details === undefined ? { success: false, error, code } : { success: false, error, code, details };
  res.status(status).json(body);
}

const httpStatus = (err: unknown): number | undefined => {
  const status = (err as { status?: unknown } | null | undefined)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
};

const sqliteCode = (err: unknown): string | undefined => {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT') ? code : undefined;
};

/**
 * Never a stack trace, never a path, never a driver message: only a short,
 * safe description and a code the client can branch on.
 */
export const execErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    fail(res, err.status, err.code, err.message, err.details);
    return;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    fail(res, 400, 'VALIDATION', 'invalid request body', details);
    return;
  }
  const status = httpStatus(err);
  if (status !== undefined) {
    fail(res, status, 'VALIDATION', status === 413 ? 'request body too large' : 'invalid request body');
    return;
  }
  if (sqliteCode(err) !== undefined) {
    console.error('Constraint violation:', err);
    fail(res, 400, 'CONSTRAINT', 'constraint violation');
    return;
  }
  console.error('Unhandled error:', err);
  fail(res, 500, 'INTERNAL', 'internal server error');
};
```

- [ ] **Step 6: Write the router and mount it**

Create `server/exec/router.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { currentVersion } from './db/migrate';
import { ok, execErrorHandler } from './http';

/** Every /api/exec resource mounts here. Later phases add one file per resource. */
export function createExecRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/health', (_req, res) => ok(res, { status: 'ok', schemaVersion: currentVersion(db) }));
  // Error-handling middleware must be registered last, after every route.
  router.use(execErrorHandler);
  return router;
}
```

Append to `server/config.ts`:

```ts
/** Where the execution system keeps its data. Tests and e2e runs point this at a temp file. */
export function execDbPath(env: Record<string, string | undefined>): string {
  return env.EXEC_DB_PATH || 'data/execution.db';
}
```

In `server/app.ts`, add the imports:

```ts
import { prepareExecDb } from './exec/db/prepare';
import { createExecRouter } from './exec/router';
import { execDbPath } from './config';
```

and change `createApp` to:

```ts
const underTestRunner = () => Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');

export function createApp(injected?: Database.Database, execInjected?: Database.Database) {
  let db = injected;
  if (!db) {
    // A future test that forgets to inject a database must fail loudly
    // here, not silently create and seed a real data/taskflow.db file.
    if (underTestRunner()) {
      throw new Error(
        "createApp() was called without an injected database while running under the test runner " +
        "(VITEST or NODE_ENV=test is set). Inject one explicitly, e.g. createApp(openDb(':memory:'))."
      );
    }
    db = openDb(process.env.DB_PATH ?? 'data/taskflow.db');
    initSchema(db);
    seed(db);
  }
  // The execution database is created by migrations, so an in-memory one is
  // always safe under the test runner; only a real run touches the file.
  const execDb = execInjected ?? prepareExecDb(underTestRunner() ? ':memory:' : execDbPath(process.env));

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/exec', createExecRouter(execDb));
  app.use('/api/users', usersRouter(db));
  app.use('/api/projects', projectsRouter(db));
  app.use('/api/tasks', tasksRouter(db));
  // Error-handling middleware must be registered last, after all routes.
  app.use(errorHandler);
  return app;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/http.test.ts server/exec/__tests__/health.test.ts`
Expected: PASS, 9 tests.

Run: `npx vitest run && npm run lint`
Expected: every project green; both TypeScript programs clean.

- [ ] **Step 8: Commit**

```bash
git add src/shared/exec/api.ts server/exec/http.ts server/exec/router.ts server/config.ts server/app.ts server/exec/__tests__/http.test.ts server/exec/__tests__/health.test.ts
git commit -m "feat: mount /api/exec with its response envelope, error handler and health route"
```

---

### Task 5: Bind option, Vite config, Tailwind v4 and the page skeleton

**Files:**
- Modify: `server/config.ts`, `server/__tests__/config.test.ts`, `vite.config.ts`, `index.html`, `index.tsx`, `.env.example`
- Create: `src/styles/app.css`

**Interfaces:**
- Produces: `bindHost(env): string`, `allowedHosts(env): string[] | undefined`, `isLoopback(host): boolean` in `server/config.ts`; the Vite alias `legacy-app` → `App.tsx`; Tailwind v4 classes available to legacy and new code; the `.dark` class as the dark-mode variant.

- [ ] **Step 1: Write the failing config tests**

Append to `server/__tests__/config.test.ts` (after the existing `describe('API_HOST', …)` block) and extend its import line to `import { API_HOST, apiPort, bindHost, allowedHosts, isLoopback, execDbPath } from '../config';`:

```ts
describe('bindHost', () => {
  it('defaults to loopback', () => {
    expect(bindHost({})).toBe('127.0.0.1');
  });

  it('treats an empty value as unset', () => {
    expect(bindHost({ TASKFLOW_BIND: '' })).toBe('127.0.0.1');
  });

  it('passes a tailnet address or hostname through', () => {
    expect(bindHost({ TASKFLOW_BIND: '100.64.0.7' })).toBe('100.64.0.7');
    expect(bindHost({ TASKFLOW_BIND: 'office-pc.tailnet.ts.net' })).toBe('office-pc.tailnet.ts.net');
  });

  it.each([' 100.64.0.7', 'a b', 'http://host', 'host/path'])('rejects %j', (value) => {
    expect(() => bindHost({ TASKFLOW_BIND: value })).toThrow(/TASKFLOW_BIND/);
  });
});

describe('isLoopback', () => {
  it.each(['127.0.0.1', 'localhost', '::1'])('%s is loopback', (host) => {
    expect(isLoopback(host)).toBe(true);
  });

  it('a tailnet address is not', () => {
    expect(isLoopback('100.64.0.7')).toBe(false);
  });
});

describe('allowedHosts', () => {
  it('is undefined by default so Vite keeps its own Host check', () => {
    expect(allowedHosts({})).toBeUndefined();
  });

  it('lists the configured host', () => {
    expect(allowedHosts({ TASKFLOW_ALLOWED_HOST: 'office-pc.tailnet.ts.net' })).toEqual(['office-pc.tailnet.ts.net']);
  });
});

describe('execDbPath', () => {
  it('defaults to data/execution.db', () => {
    expect(execDbPath({})).toBe('data/execution.db');
  });

  it('reads EXEC_DB_PATH', () => {
    expect(execDbPath({ EXEC_DB_PATH: '/tmp/e2e/execution.db' })).toBe('/tmp/e2e/execution.db');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/__tests__/config.test.ts`
Expected: FAIL — `bindHost`, `allowedHosts`, `isLoopback` are not exported.

- [ ] **Step 3: Add the bind helpers**

Append to `server/config.ts`:

```ts
const LOOPBACK = '127.0.0.1';
const HOST_PATTERN = /^[A-Za-z0-9.\-:[\]]+$/;

/**
 * Where the Vite dev server listens. Loopback unless TASKFLOW_BIND names a
 * tailnet address or hostname; the API never follows it (API_HOST is fixed).
 */
export function bindHost(env: Record<string, string | undefined>): string {
  const raw = env.TASKFLOW_BIND;
  if (raw === undefined || raw === '') return LOOPBACK;
  if (!HOST_PATTERN.test(raw)) {
    throw new Error(`TASKFLOW_BIND must be an IP address or hostname, got "${raw}"`);
  }
  return raw;
}

export function isLoopback(host: string): boolean {
  return host === LOOPBACK || host === 'localhost' || host === '::1';
}

/** Undefined keeps Vite's default Host check, which blocks DNS rebinding. */
export function allowedHosts(env: Record<string, string | undefined>): string[] | undefined {
  const host = env.TASKFLOW_ALLOWED_HOST;
  return host ? [host] : undefined;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run server/__tests__/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Rewrite the Vite config**

Overwrite `vite.config.ts`:

```ts
import path from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { API_HOST, apiPort, bindHost, allowedHosts, isLoopback } from './server/config';

export default defineConfig(() => {
  const host = bindHost(process.env);
  if (!isLoopback(host)) {
    // Operator-facing: /api proxies to an unauthenticated API, so anything that can reach
    // this server can read and change all data. Only bind beyond loopback on a private tailnet.
    console.warn(`[taskflow] Vite is bound to ${host}; the /api proxy is reachable from that network.`);
  }
  return {
    plugins: [tailwindcss()],
    server: {
      host,
      port: 3000,
      allowedHosts: allowedHosts(process.env),
      // process.env, not a .env file: server/index.ts reads only the shell environment,
      // so this keeps the proxy and the API on the same port.
      proxy: { '/api': { target: `http://${API_HOST}:${apiPort(process.env)}`, changeOrigin: true } },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // The legacy workspace is imported as 'legacy-app' so the strict TypeScript
        // program never follows the import into the untyped legacy tree.
        'legacy-app': path.resolve(__dirname, 'App.tsx'),
      },
    },
  };
});
```

- [ ] **Step 6: Write the Tailwind entry**

Create `src/styles/app.css`:

```css
@import "tailwindcss";

/* Dark mode follows the .dark class that utils/ThemeContext.tsx toggles on <html>. */
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* Legacy palette from the old inline Tailwind config; keeps /legacy rendering. */
  --color-sidebar: #202123;
  --color-main-bg: #f7f9fa;
  --color-main-bg-darker: #e0f2f1;
  --color-card: #ffffff;
  --color-accent: #fb7185;
  --color-accent-hover: #f43f5e;
  --color-primary: #6366f1;
  --color-primary-hover: #4f46e5;
  --color-dark-text: #1f2937;
  --color-light-text: #d1d5db;
  --color-subtle-text: #9ca3af;
  --color-border-color: #e5e7eb;
  --color-accent-green: #10b981;
  --color-accent-pink: #ec4899;

  /* Execution system tokens: one accent, calm neutrals. Refined in the design pass. */
  --color-ink: #16181d;
  --color-ink-muted: #6b7280;
  --color-paper: #fafaf9;
  --color-paper-raised: #ffffff;
  --color-line: #e7e5e4;
  --color-focus: #2563eb;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}

@layer base {
  html {
    color-scheme: light dark;
  }
  body {
    @apply bg-paper text-ink antialiased dark:bg-ink dark:text-paper;
  }
}
```

- [ ] **Step 7: Strip the CDN, its config and the import map from the page**

Overwrite `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Execution</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.tsx"></script>
  </body>
</html>
```

In `index.tsx`, add the two stylesheet imports right after the React imports (the legacy `index.css` moves into the legacy chunk in Task 7):

```ts
import './src/styles/app.css';
import './index.css';
```

- [ ] **Step 8: Document the environment**

Overwrite `.env.example`:

```
# Every value is read from the shell environment (export it, or prefix the command).

# Local API (npm run server). It always binds 127.0.0.1.
TASKFLOW_API_PORT=4100
DB_PATH=data/taskflow.db
EXEC_DB_PATH=data/execution.db

# Dev server (npm run dev). Leave TASKFLOW_BIND unset unless the phone capture page
# must be reachable over your tailnet; the API stays on loopback either way.
# TASKFLOW_BIND=100.64.0.7
# TASKFLOW_ALLOWED_HOST=office-pc.tailnet.ts.net
```

- [ ] **Step 9: Verify the build and the legacy styling**

Run: `npm run lint && npm run build`
Expected: clean; the build succeeds and prints a CSS asset.

Run: `grep -c "shadow-xs" dist/assets/*.css`
Expected: at least 1 — Tailwind v4 now generates the class names the legacy code always used.

Run: `grep -c "cdn.tailwindcss.com\|esm.sh" dist/index.html`
Expected: 0.

Then `npm run server` in one terminal and `npm run dev` in another, open `http://127.0.0.1:3000`: the legacy sidebar is dark slate, buttons are rounded, and the sun/moon toggle in the header switches dark mode. Stop both.

Run: `TASKFLOW_BIND=0.0.0.0 npm run dev`
Expected: the console shows `[taskflow] Vite is bound to 0.0.0.0; …` and Vite reports a network address. Stop it.

- [ ] **Step 10: Commit**

```bash
git add server/config.ts server/__tests__/config.test.ts vite.config.ts index.html index.tsx src/styles/app.css .env.example
git commit -m "feat: build Tailwind v4 in Vite, add TASKFLOW_BIND for phone reach, drop the CDN and import map"
```

---

### Task 6: The typed client and query client

**Files:**
- Create: `src/api/client.ts`, `src/api/queryClient.ts`
- Test: `src/api/client.test.ts`

**Interfaces:**
- Consumes: `ErrorCode`, `ApiResponse` from `src/shared/exec/api.ts`.
- Produces:
  - `EXEC_API_BASE = '/api/exec'`
  - `class ApiError extends Error { status: number; code: ErrorCode | 'NETWORK'; details?: unknown }`
  - `api.get<T>(path)`, `api.post<T>(path, body)`, `api.patch<T>(path, body)`, `api.put<T>(path, body)`, `api.delete<T>(path)` — each resolves to `T` or rejects with `ApiError`
  - `createQueryClient(overrides?: { retry?: number | boolean }): QueryClient`

- [ ] **Step 1: Write the failing client tests**

Create `src/api/client.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { api, ApiError, EXEC_API_BASE } from './client';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api', () => {
  it('prefixes the exec base path and unwraps a successful envelope', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: { status: 'ok', schemaVersion: 1 } }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/health')).resolves.toEqual({ status: 'ok', schemaVersion: 1 });
    expect(fetchMock).toHaveBeenCalledWith(`${EXEC_API_BASE}/health`, expect.objectContaining({ method: 'GET' }));
  });

  it('sends JSON bodies with the JSON content type', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: { id: 't1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/tasks', { title: 'Call the supplier', context: 'work' })).resolves.toEqual({ id: 't1' });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ title: 'Call the supplier', context: 'work' }));
    expect(new Headers(init.headers).get('content-type')).toBe('application/json');
  });

  it('turns a failure envelope into an ApiError carrying status, code and details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ success: false, error: 'the week already has three outcomes', code: 'WEEK_FULL', details: { outcomes: [] } }, 409)
      )
    );

    const error = await api.post('/weeks/w1/outcomes', { title: 'A fourth' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'WEEK_FULL', message: 'the week already has three outcomes', details: { outcomes: [] } });
  });

  it('reports an unreachable API as a NETWORK error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));

    const error = await api.get('/health').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'NETWORK' });
  });

  it('reports a response that is not the envelope as INTERNAL', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>proxy error</html>', { status: 502 })));

    const error = await api.get('/health').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 502, code: 'INTERNAL' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/api/client.test.ts`
Expected: FAIL — cannot resolve `./client`.

- [ ] **Step 3: Write the client**

Create `src/api/client.ts`:

```ts
import type { ApiResponse, ErrorCode } from '../shared/exec/api';

export const EXEC_API_BASE = '/api/exec';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** What every failed call rejects with, so screens can branch on `code`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readEnvelope<T>(res: Response): Promise<ApiResponse<T> | null> {
  try {
    const body = (await res.json()) as ApiResponse<T>;
    return typeof body === 'object' && body !== null && 'success' in body ? body : null;
  } catch {
    return null;
  }
}

async function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${EXEC_API_BASE}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError(0, 'NETWORK', 'The local API is not reachable', cause);
  }
  const envelope = await readEnvelope<T>(res);
  if (envelope === null) throw new ApiError(res.status, 'INTERNAL', 'The API returned an unreadable response');
  if (!envelope.success) throw new ApiError(res.status, envelope.code, envelope.error, envelope.details);
  return envelope.data;
}

export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body: unknown) => call<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => call<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => call<T>('PUT', path, body),
  delete: <T>(path: string) => call<T>('DELETE', path),
};
```

Create `src/api/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';

/**
 * refetchOnWindowFocus is the point: a capture made on the phone shows up on the
 * desktop the moment its tab regains focus. Tests pass retry: false.
 */
export function createQueryClient(overrides: { retry?: number | boolean } = {}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { refetchOnWindowFocus: true, staleTime: 0, retry: overrides.retry ?? 1 },
    },
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/api/client.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/api/client.ts src/api/queryClient.ts src/api/client.test.ts
git commit -m "feat: add the typed /api/exec client and query client"
```

---

### Task 7: App shell, routes, screen shells and the legacy route

**Files:**
- Create: `src/legacy-app.d.ts`, `src/api/health.ts`, `src/app/AppProviders.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`, `src/app/Shell.tsx`, `src/app/FullScreen.tsx`, `src/app/Legacy.tsx`, `src/components/ScreenShell.tsx`, `src/components/ApiStatus.tsx`, `src/screens/Today.tsx`, `src/screens/Week.tsx`, `src/screens/Inbox.tsx`, `src/screens/Projects.tsx`, `src/screens/Review.tsx`, `src/screens/Focus.tsx`, `src/screens/Shutdown.tsx`, `src/screens/Plan.tsx`, `src/screens/Capture.tsx`, `src/test/render.tsx`
- Modify: `index.tsx`
- Test: `src/api/health.test.tsx`, `src/components/ApiStatus.test.tsx`, `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `api`, `createQueryClient` (Task 6); `Health` (Task 4); `ThemeProvider` from `utils/ThemeContext.tsx`; the `legacy-app` alias (Task 5).
- Produces:
  - `useHealth(): UseQueryResult<Health, ApiError>`; `healthQueryKey`
  - `routes: RouteObject[]` (used by the browser router and by tests with a memory router)
  - `AppProviders({ children })`, `App()`
  - `ScreenShell({ title, phase?, children? })`
  - `renderWithProviders(ui)`, `renderRoute(path)` for tests

- [ ] **Step 1: Declare the legacy module**

Create `src/legacy-app.d.ts`:

```ts
// The old workspace is loaded only at /legacy and is not type-checked under the
// strict config. Vite and Vitest resolve 'legacy-app' to ./App.tsx (see their configs).
declare module 'legacy-app' {
  import type { ComponentType } from 'react';
  const LegacyApp: ComponentType;
  export default LegacyApp;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/test/render.tsx`:

```tsx
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { ThemeProvider } from '../../utils/ThemeContext';
import { createQueryClient } from '../api/queryClient';
import { routes } from '../app/routes';

/** Renders inside the app's providers with retries off, so failures surface at once. */
export function renderWithProviders(ui: ReactElement) {
  const client = createQueryClient({ retry: false });
  return render(
    <ThemeProvider>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </ThemeProvider>
  );
}

/** Renders the real route table at a path, without a browser history. */
export function renderRoute(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return renderWithProviders(<RouterProvider router={router} />);
}

export const healthOk = () =>
  new Response(JSON.stringify({ success: true, data: { status: 'ok', schemaVersion: 1 } }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
```

Create `src/api/health.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useHealth } from './health';
import { healthOk } from '../test/render';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('useHealth', () => {
  it('loads the health envelope through the client', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => healthOk()));
    const { result } = renderHook(() => useHealth(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ status: 'ok', schemaVersion: 1 });
  });

  it('exposes an ApiError when the API is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const { result } = renderHook(() => useHealth(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ code: 'NETWORK' });
  });
});
```

Create `src/components/ApiStatus.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ApiStatus } from './ApiStatus';
import { renderWithProviders, healthOk } from '../test/render';

afterEach(() => vi.unstubAllGlobals());

describe('ApiStatus', () => {
  it('says nothing while the API answers', async () => {
    const fetchMock = vi.fn(async () => healthOk());
    vi.stubGlobal('fetch', fetchMock);
    renderWithProviders(<ApiStatus />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('tells you how to start the API when it is not reachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    renderWithProviders(<ApiStatus />);
    expect(await screen.findByRole('status')).toHaveTextContent('Local API not reachable. Start it with npm run server.');
  });
});
```

Create `src/app/App.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRoute, healthOk } from '../test/render';

beforeEach(() => vi.stubGlobal('fetch', vi.fn(async () => healthOk())));
afterEach(() => vi.unstubAllGlobals());

describe('the app shell', () => {
  it('opens on Today with the first-week banner', async () => {
    renderRoute('/');
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /plan your first week/i })).toHaveAttribute('href', '/plan');
  });

  it('offers exactly the five primary destinations, in order', async () => {
    renderRoute('/');
    const nav = await screen.findByRole('navigation', { name: 'Primary' });
    expect(within(nav).getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Today',
      'Week',
      'Inbox',
      'Projects',
      'Review',
    ]);
  });

  it.each([
    ['/week', 'Week'],
    ['/inbox', 'Inbox'],
    ['/projects', 'Projects'],
    ['/review', 'Review'],
  ])('shows %s inside the shell', async (path, title) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it.each([
    ['/focus', 'Focus'],
    ['/shutdown', 'Shutdown'],
    ['/plan', 'Plan the week'],
    ['/capture', 'Capture'],
  ])('shows %s full screen, without the primary navigation', async (path, title) => {
    renderRoute(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project jsdom`
Expected: FAIL — `../app/routes`, `./health`, `./ApiStatus` cannot be resolved.

- [ ] **Step 4: Write the health hook and the status line**

Create `src/api/health.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { Health } from '../shared/exec/api';
import { api, ApiError } from './client';

export const healthQueryKey = ['exec', 'health'] as const;

export function useHealth() {
  return useQuery<Health, ApiError>({ queryKey: healthQueryKey, queryFn: () => api.get<Health>('/health') });
}
```

Create `src/components/ApiStatus.tsx`:

```tsx
import { useHealth } from '../api/health';

/** One line, only when the local API cannot be reached; silent otherwise. */
export function ApiStatus() {
  const health = useHealth();
  if (!health.isError) return null;
  return (
    <p role="status" className="rounded-md border border-line bg-paper-raised px-3 py-2 text-sm text-ink-muted dark:border-ink-muted dark:bg-ink">
      Local API not reachable. Start it with <code className="font-mono">npm run server</code>.
    </p>
  );
}
```

- [ ] **Step 5: Write the layout pieces**

Create `src/components/ScreenShell.tsx`:

```tsx
import type { ReactNode } from 'react';

type Props = { title: string; phase?: number; children?: ReactNode };

/** The heading every screen starts with; a shell says which phase fills it. */
export function ScreenShell({ title, phase, children }: Props) {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      {children ?? <p className="text-ink-muted">Arrives in Phase {phase}.</p>}
    </section>
  );
}
```

Create `src/app/Shell.tsx`:

```tsx
import { NavLink, Outlet } from 'react-router-dom';
import { ApiStatus } from '../components/ApiStatus';

const NAV = [
  { to: '/', label: 'Today', end: true },
  { to: '/week', label: 'Week', end: false },
  { to: '/inbox', label: 'Inbox', end: false },
  { to: '/projects', label: 'Projects', end: false },
  { to: '/review', label: 'Review', end: false },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-ink text-paper dark:bg-paper dark:text-ink' : 'text-ink-muted hover:text-ink dark:hover:text-paper'}`;

/** The five-entry navigation: a left rail on desktop, a bottom bar on phones. */
export function Shell() {
  return (
    <div className="min-h-screen md:flex">
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-line bg-paper-raised p-2 md:static md:w-44 md:flex-col md:justify-start md:gap-1 md:border-r md:border-t-0 md:p-4 dark:border-ink-muted dark:bg-ink"
      >
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 space-y-4 px-4 pb-24 pt-6 md:px-10 md:pb-10">
        <ApiStatus />
        <Outlet />
      </main>
    </div>
  );
}
```

Create `src/app/FullScreen.tsx`:

```tsx
import { Outlet } from 'react-router-dom';

/** Flows that must show nothing but themselves: focus, shutdown, planning, capture. */
export function FullScreen() {
  return (
    <div className="min-h-screen px-4 py-6 md:px-10">
      <Outlet />
    </div>
  );
}
```

Create `src/app/Legacy.tsx`:

```tsx
import '../../index.css';
import LegacyApp from 'legacy-app';

/** The old workspace, kept reachable at /legacy until the MVP has proven itself. */
export default function Legacy() {
  return <LegacyApp />;
}
```

- [ ] **Step 6: Write the screen shells**

Create `src/screens/Today.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';

/** Phase 1: an empty day. Phase 3 replaces the unconditional banner with the real check. */
export default function Today() {
  return (
    <ScreenShell title="Today">
      <Link
        to="/plan"
        className="block rounded-lg border border-line bg-paper-raised px-4 py-3 text-lg font-medium hover:border-ink dark:border-ink-muted dark:bg-ink"
      >
        Plan your first week
      </Link>
      <p className="text-ink-muted">Nothing is planned yet. The week's outcomes come first.</p>
    </ScreenShell>
  );
}
```

Create the eight other shells with exactly this shape, changing only the title and phase:

```tsx
import { ScreenShell } from '../components/ScreenShell';

export default function Week() {
  return <ScreenShell title="Week" phase={3} />;
}
```

| File | Title | Phase |
|---|---|---|
| `src/screens/Week.tsx` | `Week` | 3 |
| `src/screens/Inbox.tsx` | `Inbox` | 2 |
| `src/screens/Projects.tsx` | `Projects` | 3 |
| `src/screens/Review.tsx` | `Review` | 6 |
| `src/screens/Focus.tsx` | `Focus` | 5 |
| `src/screens/Shutdown.tsx` | `Shutdown` | 6 |
| `src/screens/Plan.tsx` | `Plan the week` | 3 |
| `src/screens/Capture.tsx` | `Capture` | 2 |

- [ ] **Step 7: Write the route table, providers and entry**

Create `src/app/routes.tsx`:

```tsx
import { lazy, Suspense } from 'react';
import type { RouteObject } from 'react-router-dom';
import { Shell } from './Shell';
import { FullScreen } from './FullScreen';
import Today from '../screens/Today';
import Week from '../screens/Week';
import Inbox from '../screens/Inbox';
import Projects from '../screens/Projects';
import Review from '../screens/Review';
import Focus from '../screens/Focus';
import Shutdown from '../screens/Shutdown';
import Plan from '../screens/Plan';
import Capture from '../screens/Capture';

// Loaded only when someone types /legacy, so its bundle never rides along with the new app.
const Legacy = lazy(() => import('./Legacy'));

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <Shell />,
    children: [
      { index: true, element: <Today /> },
      { path: 'week', element: <Week /> },
      { path: 'inbox', element: <Inbox /> },
      { path: 'projects', element: <Projects /> },
      { path: 'review', element: <Review /> },
    ],
  },
  {
    element: <FullScreen />,
    children: [
      { path: '/focus', element: <Focus /> },
      { path: '/shutdown', element: <Shutdown /> },
      { path: '/plan', element: <Plan /> },
      { path: '/capture', element: <Capture /> },
    ],
  },
  {
    path: '/legacy/*',
    element: (
      <Suspense fallback={<p className="p-6 text-ink-muted">Loading the old workspace…</p>}>
        <Legacy />
      </Suspense>
    ),
  },
];
```

Create `src/app/AppProviders.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../utils/ThemeContext';
import { createQueryClient } from '../api/queryClient';

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </ThemeProvider>
  );
}
```

Create `src/app/App.tsx`:

```tsx
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppProviders } from './AppProviders';
import { routes } from './routes';

const router = createBrowserRouter(routes);

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
```

Overwrite `index.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/styles/app.css';
import { App } from './src/app/App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

(The `./index.css` import added in Task 5 is gone from here; `src/app/Legacy.tsx` now owns it.)

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run --project jsdom`
Expected: PASS — 1 (setup) + 5 (client) + 2 (health) + 2 (ApiStatus) + 10 (App) tests.

If `npm run lint` reports `utils/ThemeContext.tsx` under strict for the unused `e` in its `catch (e)`, change that one line to `} catch {` — the only permitted edit to a legacy file in this plan.

Run: `npm run lint && npx vitest run`
Expected: both programs clean; every project green.

- [ ] **Step 9: Run the app and look**

`npm run server` in one terminal, `npm run dev` in another, then:

- `http://127.0.0.1:3000/` — heading "Today", the "Plan your first week" link, a five-entry rail on the left; no API warning.
- Stop `npm run server`, reload: the "Local API not reachable" line appears above Today. Start it again, click the tab away and back: the line disappears without a reload (refetch on focus).
- `http://127.0.0.1:3000/capture` — heading "Capture", no rail. Narrow the window below 768px on `/`: the rail becomes a bottom bar.
- `http://127.0.0.1:3000/legacy` — the old workspace loads with its styling and no login screen; the browser's network panel shows its chunk was requested only now.
- The sun/moon toggle inside `/legacy` also flips the new screens' colours (shared `.dark` class).

- [ ] **Step 10: Commit**

```bash
git add index.tsx src/legacy-app.d.ts src/api/health.ts src/api/health.test.tsx src/app src/components src/screens src/test/render.tsx
git commit -m "feat: add the execution app shell with five screens, full-screen flows and the legacy route"
```

---

### Task 8: Playwright journeys, scripts and README

**Files:**
- Create: `e2e/playwright.config.ts`, `e2e/smoke.spec.ts`, `e2e/phone.spec.ts`
- Modify: `package.json`, `.gitignore`, `README.md`

**Interfaces:**
- Produces: `npm run test:e2e` running against a fresh temporary database each time; the `desktop` and `phone` Playwright projects later phases add journeys to.

- [ ] **Step 1: Install the browser**

```bash
npx playwright install chromium
```

- [ ] **Step 2: Write the Playwright config**

Create `e2e/playwright.config.ts`:

```ts
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4150;
const WEB_PORT = 3100;
// A fresh database per run: the journeys start from "Plan your first week" every time.
const dataDir = mkdtempSync(join(tmpdir(), 'taskflow-e2e-'));

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  outputDir: '../test-results',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone\.spec\.ts/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'npx tsx server/index.ts',
      url: `http://127.0.0.1:${API_PORT}/api/exec/health`,
      reuseExistingServer: false,
      env: {
        TASKFLOW_API_PORT: String(API_PORT),
        DB_PATH: join(dataDir, 'taskflow.db'),
        EXEC_DB_PATH: join(dataDir, 'execution.db'),
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { TASKFLOW_API_PORT: String(API_PORT) },
    },
  ],
});
```

- [ ] **Step 3: Write the journeys**

Create `e2e/smoke.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('Today opens with the first-week banner and a working API', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Plan your first week' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' }).getByRole('link')).toHaveText([
    'Today',
    'Week',
    'Inbox',
    'Projects',
    'Review',
  ]);
  await expect(page.getByRole('status')).toHaveCount(0);
});

test('the primary navigation reaches every screen', async ({ page }) => {
  await page.goto('/');
  for (const name of ['Week', 'Inbox', 'Projects', 'Review']) {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  }
});

test('the old workspace still renders at /legacy with no login screen', async ({ page }) => {
  await page.goto('/legacy');
  await expect(page.getByText('Home Dashboard')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole('button', { name: /sign in|log in/i })).toHaveCount(0);
});
```

Create `e2e/phone.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('the capture page stands alone at phone width', async ({ page }) => {
  await page.goto('/capture');
  await expect(page.getByRole('heading', { level: 1, name: 'Capture' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
});

test('Today shows its navigation as a bottom bar on a phone', async ({ page }) => {
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav).toBeVisible();
  const box = await nav.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.y + box!.height).toBeGreaterThan(viewport!.height - 2);
});
```

- [ ] **Step 4: Wire the scripts and ignore the artifacts**

In `package.json` `scripts`, add:

```json
"test:e2e": "playwright test -c e2e/playwright.config.ts",
```

Append to `.gitignore`:

```
# Playwright
test-results/
playwright-report/
```

- [ ] **Step 5: Run the journeys**

Run: `npm run test:e2e`
Expected: 5 passed (3 desktop, 2 phone). Both servers start on their own and stop afterwards.

- [ ] **Step 6: Rewrite the README**

Overwrite `README.md`:

```markdown
# Execution

A personal execution system: three outcomes a week, one Must Ship a workday,
two secondaries, a protected deep-work block, a capture inbox that never
commits, a daily shutdown and a Friday review. Design:
`docs/superpowers/specs/2026-09-22-execution-system-design.md`.

The old Asana-style workspace it grew out of is still reachable at `/legacy`
until the new system has proven itself in daily use.

## Running locally

    npm install
    npm run server   # API on http://127.0.0.1:4100 (TASKFLOW_API_PORT to change)
    npm run dev      # UI on http://127.0.0.1:3000

Data lives in `data/execution.db` (this system) and `data/taskflow.db` (the
legacy workspace), both SQLite. The execution database is created and
upgraded by `server/exec/migrations/*.sql`; delete the file to start over.
There is no authentication: the app runs as a single user on this machine.

To reach the phone capture page over a tailnet, set `TASKFLOW_BIND` and
`TASKFLOW_ALLOWED_HOST` (see `.env.example`). The API stays on loopback
regardless; the phone talks to Vite, which proxies `/api`.

## Checks

    npm run lint            # TypeScript, root and strict configs
    npm run test:coverage   # vitest, node + jsdom projects, 80% floor
    npm run test:e2e        # Playwright journeys on a temporary database
```

- [ ] **Step 7: Commit**

```bash
git add e2e package.json .gitignore README.md
git commit -m "test: add Playwright journeys for the shell, the phone capture page and the legacy route"
```

---

### Task 9: Phase 1 verification and report

**Files:** none created; this is the after-every-phase ritual from the spec (section D).

- [ ] **Step 1: Static checks**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 2: Unit and integration coverage**

Run: `npm run test:coverage`
Expected: every project green; the coverage table shows `server/exec/**` and `src/**` and the 80% line threshold passes. Note the exact totals for the report.

- [ ] **Step 3: Journeys**

Run: `npm run test:e2e`
Expected: 5 passed.

- [ ] **Step 4: Manual run against the phase's bar**

Delete `data/execution.db` if it exists, start `npm run server` and `npm run dev`, and confirm each line of the spec's Phase 1 "Done when": the app boots to an empty Today saying "Plan your first week"; `data/execution.db` is created with `PRAGMA user_version = 1` (`sqlite3 data/execution.db 'PRAGMA user_version'` or `node -e "const D=require('better-sqlite3');console.log(new D('data/execution.db').pragma('user_version',{simple:true}))"`); `/legacy` still renders. Then set `TASKFLOW_BIND` to this machine's tailnet address and `TASKFLOW_ALLOWED_HOST` to its tailnet hostname, restart `npm run dev`, and open `/capture` from the phone.

- [ ] **Step 5: Report**

Write the phase report where the executing skill keeps it (the task report or the progress ledger), covering: what changed (the commit list), the coverage totals, the e2e result, what was verified by hand including the phone check, and anything that did not pass or was deviated from — the spec's Phase 1 row is the reference.

---

## Self-review

**Spec coverage (Phases 0–1 only):** A.1 `src/` tree and `/legacy/*` — Task 7. A.2 URLs — Task 7. A.3 client + Query — Tasks 6–7. A.4 second database, migrations, `busy_timeout`, `/api/exec/*` — Tasks 2–4. A.5 Tailwind v4, `.dark` variant, tokens, CDN and import map removed — Task 5. A.6 `TASKFLOW_BIND`, `TASKFLOW_ALLOWED_HOST`, loopback API, warning — Task 5. A.7 strict config — Task 1. A.8 Phase 0 — Task 0. B "Conventions", "Tables", "Migrations" — Tasks 2–3 (the `user_version` runner, all nine tables, indexes, settings row, no demo data). B "Routes" and D "Testing" for this phase — Task 4 (envelope, codes, error handler), Task 1 (vitest projects, coverage), Task 8 (Playwright, temp database, phone project). D "Build sequence" Phase 1 "Done when" — Task 9. Phases 2–6 content (resources, screens, pure core) is deliberately absent; each gets its own plan.

**Placeholder scan:** no TBD/TODO; every code step has its code; the eight screen shells are given by exact template plus a table of the two values that vary.

**Type consistency:** `ErrorCode` is defined once in `src/shared/exec/api.ts` and imported by `server/exec/http.ts` and `src/api/client.ts`. `createApp(injected?, execInjected?)` matches its use in `health.test.ts` and `liveApi.ts` (which still calls `createApp(db)` and gets an in-memory execution database). `prepareExecDb` is the only constructor used by tests and `app.ts`. `createQueryClient({ retry })` matches `src/test/render.tsx` and `health.test.tsx`. `healthOk` is exported from `src/test/render.tsx` and used by three test files. Screen titles in `App.test.tsx` and `e2e/*.spec.ts` match the shells' titles exactly, including `Plan the week`.
