# Execution System — Phase 2 (Capture and Inbox) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make capture real: a `tasks` resource with the spec's routes and timestamp rules, a phone-first `/capture` page, a keyboard-first Inbox with the six processing keys and a Later tab, capture from Today (pinned bar and the `c` key), and the Playwright journey "capture on the phone, process on the desktop". Also land the hardening the Phase 1 final review carried over.

**Architecture:** Phase 1's layers stay as they are. Server: one data module per resource (`server/exec/tasks/store.ts`, pure functions over the database) and one Express router per resource (`server/exec/routes/*.ts`) that only parses, calls the store and answers in the envelope. Validation is zod schemas in `src/shared/exec/schemas.ts`, imported by both the routes and the client; `assertValidColumns` stays as the belt behind zod's braces. Client: one hook module per resource in `src/api/`, TanStack Query for caching and invalidation, refetch-on-focus doing the phone→desktop hand-off. Screens compose small components under `src/components/`.

**Tech Stack:** unchanged from Phase 1 — Node 22 · React 19.2 · Vite 6.4 · Vitest 4.1 · TypeScript 5.8 strict · Express 5 · better-sqlite3 13 (SQLite 3.53) · react-router-dom 7 · @tanstack/react-query 5 · Tailwind 4 · zod 4.6 · Testing Library 16 + jsdom 30 · Playwright 1.63

**Spec:** `docs/superpowers/specs/2026-09-22-execution-system-design.md` — B "Tables" (`tasks`, `settings`), B "Routes" (the `/tasks`, `/settings`, `/projects` rows), B "Validation", C "Today" item 5, C "Inbox", C "Capture", D "Testing", D "Build sequence" Phase 2 row. Requirements: `docs/superpowers/specs/2026-09-22-execution-system-handoff.md` §10 (Capture Inbox), §11 (Delegation), §19 (Today).

## Global Constraints

Copied from the spec and the Phase 1 plan; every task's requirements include these.

- `/api/exec/*` responses are `{ success: true, data }` or `{ success: false, error, code }` with `code` one of `VALIDATION`, `NOT_FOUND`, `WEEK_FULL`, `DAY_TAKEN`, `SLOT_LIMIT`, `SHUTDOWN_NOT_READY`, `DELETE_NOT_ALLOWED`, `CONSTRAINT`, `INTERNAL`. Error responses never carry a stack trace, a file path, a driver message or the client's input.
- Every route body is parsed by a zod schema from `src/shared/exec/schemas.ts` before anything else; every row write passes `assertValidColumns` against `getTableColumns` before SQL text is built; statements are always parameterised.
- Timestamps (`captured_at`, `processed_at`, `delegated_at`, `closed_at`, `rolled_at`, `created_at`, `updated_at`) are ISO-8601 UTC set by the server; calendar dates (`scheduled_date`, `due_date`, `follow_up_date`) are `YYYY-MM-DD`; `id` is a server-generated UUID. Rows are returned camelCase.
- Capture is not commitment: `POST /tasks` always creates status `inbox`. Only a later PATCH moves it.
- `owner_name` is required when a task becomes `delegated` or `waiting`. `DELETE /tasks/:id` succeeds only while the task is `inbox`; everything else is killed, never deleted.
- The API always binds `127.0.0.1`; only Vite may bind elsewhere through `TASKFLOW_BIND`. No new environment variables.
- New code (`src/`, `server/`, `e2e/`) compiles under `strict: true` with `noUnusedLocals`/`noUnusedParameters`; `npm run lint` is `tsc --noEmit -p tsconfig.app.json`. Legacy code (`App.tsx`, `components/`, `services/`, `utils/`, `server/routes/*`, `server/db/*`) is not modified; `utils/ThemeContext.tsx` may be imported.
- Files stay under 400 lines and functions under 50 lines. No `console.log` in application code. New objects rather than mutation.
- TDD: the failing test lands before the code that passes it. Coverage threshold stays 80% lines over `server/**`, `src/**`. Legacy tests keep passing; Phase 1's 264 tests keep passing.
- Commit messages follow `<type>: <description>` and contain nothing else: no `Co-Authored-By`, no `Claude-Session`, no trailer of any kind. Never push.
- Port 3000 on the development machine is held by another project; `npm run dev` prints another port (3001). The e2e config uses 3100/4150.

## Decisions carried into this plan

- **Toasts are a new 40-line `src/components/Toast.tsx`, not the legacy `utils/ux.tsx`.** The spec listed `ux.tsx` as reusable, but Phase 1 established that any `src/` import of a legacy file pulls it into the strict program, and `ux.tsx` (394 lines) has not been checked under strict. A tiny own toast is cheaper than the risk.
- **`GET /settings` and `GET /projects` land now, read-only.** The capture page defaults its Work/Build toggle by time of day, which needs the settings row, and the Inbox's `P` key needs the project list (empty until Phase 3 creates any). `PUT /settings` and project writes stay in Phases 4 and 3.
- **`S` (schedule) sets `scheduledDate` and picks the status by the week:** `this_week` when the date falls inside the current planning week, `later` otherwise. **`P` (project) assigns `projectId` and sets `later`**, since a project alone is not a commitment to this week.
- **`POST /tasks/:id/roll` lands with the resource** even though only Shutdown (Phase 6) calls it; it is ten lines and keeps the tasks resource complete against the spec's route table.
- **Hardening from the Phase 1 final review** is Tasks 1 and 2: a `schema_migrations` ledger with checksums, the version re-read inside an immediate transaction, `mkdir` for a custom `EXEC_DB_PATH`, database close on shutdown, exact-text constraint assertions plus tests for every enum CHECK and the three Ruling-4 bounds. Deferred to Phase 3: the client `patch`/`put`/`delete` tests land in Task 6 here; the 3-digit-crossing migration-order test lands with `002_*.sql`.

---

## File Structure

**Server hardening**
- Modify: `server/exec/db/migrate.ts` — `schema_migrations` ledger, checksums, immediate transaction; `server/index.ts` — mkdir for the exec path, graceful shutdown; `server/app.ts` — `app.locals.closeDatabases`.
- Test: `server/exec/__tests__/migrate.test.ts` (extend), `server/exec/__tests__/schema.test.ts` (tighten and extend), `server/exec/__tests__/app-close.test.ts`.

**Shared (imported by server and client)**
- `src/shared/exec/schemas.ts` — zod schemas and inferred types: `Context`, `TaskStatus`, `Task`, `TaskCreate`, `TaskPatch`, `TaskRoll`, `TaskListQuery`, `Settings`, `Project`.
- `src/shared/exec/dates.ts` — `isCalendarDate`, `addDays`, `compareDates`.
- `src/shared/exec/time.ts` — `localClock`, `isWorkDay`, `isOfficeHours`, `defaultContext`, `weekStartOf`, `weekEndOf`.
- Tests beside them (node project).

**Server tasks resource**
- `server/exec/clock.ts` — `nowIso()`.
- `server/exec/tasks/store.ts` — `listTasks`, `getTask`, `createTask`, `patchTask`, `rollTask`, `deleteTask`.
- `server/exec/tasks/transitions.ts` — the timestamp rules for a status change.
- `server/exec/routes/tasks.ts`, `server/exec/routes/settings.ts`, `server/exec/routes/projects.ts` — routers; `server/exec/router.ts` mounts them.
- Tests: `server/exec/__tests__/tasks-store.test.ts`, `server/exec/__tests__/tasks-routes.test.ts`, `server/exec/__tests__/settings-routes.test.ts`.

**Client**
- `src/api/tasks.ts`, `src/api/settings.ts`, `src/api/projects.ts` — hooks; `src/api/query.ts` — query-string helper.
- `src/lib/relativeTime.ts` — "2 h ago".
- `src/components/Toast.tsx`, `src/components/CaptureBar.tsx`, `src/components/ContextToggle.tsx`, `src/components/CaptureDialog.tsx`, `src/components/inbox/InboxRow.tsx`, `src/components/inbox/InboxList.tsx`, `src/components/inbox/DelegatePanel.tsx`, `src/components/inbox/SchedulePanel.tsx`, `src/components/inbox/ProjectPicker.tsx`, `src/components/inbox/useInboxKeys.ts`.
- `src/screens/Today.tsx` (pinned capture), `src/screens/Capture.tsx`, `src/screens/Inbox.tsx`, `src/screens/NotFound.tsx`; `src/app/Shell.tsx` (global `c`), `src/app/FullScreen.tsx` (ApiStatus), `src/app/AppProviders.tsx` (ToastProvider), `src/app/routes.tsx` (catch-all); `src/styles/app.css`; `index.html` + `public/manifest.webmanifest` + `public/icon.svg`.
- Tests beside each (jsdom project); `src/test/render.tsx` gains fetch-stub helpers.

**End to end**
- `e2e/capture.spec.ts`, `e2e/teardown.ts`; modify `e2e/playwright.config.ts`, `README.md`.

---

### Task 1: Migration ledger, immediate transactions, path and shutdown hardening

**Files:**
- Modify: `server/exec/db/migrate.ts`, `server/index.ts`, `server/app.ts`
- Test: `server/exec/__tests__/migrate.test.ts` (append), `server/exec/__tests__/app-close.test.ts` (create)

**Interfaces:**
- Consumes: `openExecDb`, `listMigrations`, `currentVersion`, `migrate` (Phase 1); `createApp`, `execDbPath`.
- Produces: `Migration` gains `checksum: string`; `migrate(db, dir?)` now also maintains `schema_migrations(version, name, checksum, applied_at)`, backfills it for a database migrated before the ledger existed, refuses to run when an applied migration's file changed or vanished, and applies each pending file inside `BEGIN IMMEDIATE` after re-reading the version; `createApp(...)` returns an app whose `app.locals.closeDatabases()` closes both connections; `server/index.ts` creates the directory of `EXEC_DB_PATH` and closes on `SIGINT`/`SIGTERM`.

- [ ] **Step 1: Write the failing ledger tests**

Append to `server/exec/__tests__/migrate.test.ts` (inside the file, after the existing `describe('migrate', …)` block; the helpers `dir`, `write`, `tables` already exist at the top):

```ts
describe('schema_migrations ledger', () => {
  const ledger = (db: Database.Database) =>
    db.prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version').all() as {
      version: number;
      name: string;
      checksum: string;
    }[];

  it('records every applied migration with a sha256 checksum of its text', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    const [applied] = migrate(db, dir);
    expect(applied.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(ledger(db)).toEqual([{ version: 1, name: 'first', checksum: applied.checksum }]);
    expect(tables(db)).toContain('schema_migrations');
  });

  it('refuses to run when an applied migration file has changed since', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    write('001_first.sql', 'CREATE TABLE a (x INTEGER, y INTEGER);');
    expect(() => migrate(db, dir)).toThrow(/001_first\.sql has changed since it was applied/);
    expect(currentVersion(db)).toBe(1);
  });

  it('refuses to run when an applied migration file is gone', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    rmSync(join(dir, '001_first.sql'));
    expect(() => migrate(db, dir)).toThrow(/migration 1 \(first\) was applied to this database but its file no longer exists/);
  });

  it('backfills the ledger for a database migrated before the ledger existed', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    const db = openExecDb(':memory:');
    db.exec('CREATE TABLE a (x INTEGER);');
    db.pragma('user_version = 1');
    expect(migrate(db, dir)).toEqual([]);
    expect(ledger(db).map((row) => [row.version, row.name])).toEqual([[1, 'first']]);
  });

  it('skips a version that was applied by someone else between listing and running', () => {
    write('001_first.sql', 'CREATE TABLE a (x INTEGER);');
    write('002_second.sql', 'CREATE TABLE b (x INTEGER);');
    const db = openExecDb(':memory:');
    migrate(db, dir);
    // Simulate a second process having applied 002 already: the ledger and version say so.
    db.exec('CREATE TABLE b (x INTEGER);');
    db.prepare('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (2, ?, ?, ?)').run(
      'second',
      listMigrations(dir)[1].checksum,
      '2026-09-24T00:00:00.000Z'
    );
    db.pragma('user_version = 2');
    expect(migrate(db, dir)).toEqual([]);
    expect(tables(db)).toEqual(['a', 'b', 'schema_migrations']);
  });
});
```

Add `rmSync`'s sibling import if missing: the file already imports `mkdtempSync, writeFileSync, rmSync` from `node:fs` and `join` from `node:path`. Also change the existing `tables` helper's expectations: the three existing tests that assert `tables(db)` equal `['a', 'b']` or `['a']` now see `schema_migrations` too — update them to `['a', 'b', 'schema_migrations']` and `['a', 'schema_migrations']` respectively (the test "applies every pending migration in order", "applies only the migrations above the current version", and "rolls back a failing migration").

- [ ] **Step 2: Write the failing shutdown test**

Create `server/exec/__tests__/app-close.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';

describe('createApp().locals.closeDatabases', () => {
  it('closes both database connections', () => {
    const legacy = openDb(':memory:');
    initSchema(legacy);
    const exec = prepareExecDb(':memory:');
    const app = createApp(legacy, exec);
    expect(typeof app.locals.closeDatabases).toBe('function');
    app.locals.closeDatabases();
    expect(legacy.open).toBe(false);
    expect(exec.open).toBe(false);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/migrate.test.ts server/exec/__tests__/app-close.test.ts`
Expected: FAIL — `schema_migrations` does not exist; `checksum` is undefined; `closeDatabases` is not a function.

- [ ] **Step 4: Rewrite the migration runner**

Overwrite `server/exec/db/migrate.ts`:

```ts
import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path of the real migrations; tests pass their own directory. */
export const MIGRATIONS_DIR = join(here, '..', 'migrations');

export type Migration = { version: number; name: string; sql: string; checksum: string };

type LedgerRow = { version: number; name: string; checksum: string };

const FILE_PATTERN = /^(\d{3})_([a-z0-9_]+)\.sql$/;

const checksumOf = (sql: string) => createHash('sha256').update(sql).digest('hex');

/** Reads NNN_name.sql files in version order. Anything else in the directory is ignored. */
export function listMigrations(dir: string): Migration[] {
  const migrations = readdirSync(dir)
    .map((file) => ({ file, match: FILE_PATTERN.exec(file) }))
    .filter((entry): entry is { file: string; match: RegExpExecArray } => entry.match !== null)
    .map(({ file, match }) => {
      const sql = readFileSync(join(dir, file), 'utf8');
      return { version: Number(match[1]), name: match[2], sql, checksum: checksumOf(sql) };
    })
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

/** The ledger is created by the runner itself, never by a migration, so it exists before 001 runs. */
function ensureLedger(db: Database.Database): void {
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    INTEGER PRIMARY KEY,
       name       TEXT NOT NULL,
       checksum   TEXT NOT NULL,
       applied_at TEXT NOT NULL
     ) STRICT`
  );
}

const ledgerRows = (db: Database.Database): LedgerRow[] =>
  db.prepare('SELECT version, name, checksum FROM schema_migrations ORDER BY version').all() as LedgerRow[];

const insertLedger = (db: Database.Database, migration: Migration) =>
  db
    .prepare('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)')
    .run(migration.version, migration.name, migration.checksum, new Date().toISOString());

/** A database migrated before the ledger existed: trust user_version once and record what it implies. */
function backfillLedger(db: Database.Database, migrations: Migration[]): void {
  if (ledgerRows(db).length > 0) return;
  const version = currentVersion(db);
  db.transaction(() => {
    migrations.filter((m) => m.version <= version).forEach((m) => insertLedger(db, m));
  })();
}

/** Every applied migration must still exist on disk with the text it had when it ran. */
function verifyApplied(db: Database.Database, migrations: Migration[]): void {
  for (const row of ledgerRows(db)) {
    const file = migrations.find((m) => m.version === row.version);
    if (!file) {
      throw new Error(`migration ${row.version} (${row.name}) was applied to this database but its file no longer exists`);
    }
    if (file.checksum !== row.checksum) {
      throw new Error(`migration ${String(file.version).padStart(3, '0')}_${file.name}.sql has changed since it was applied`);
    }
  }
}

/**
 * Applies every migration above the database's user_version, each inside its own
 * BEGIN IMMEDIATE transaction that re-reads the version first, so two processes
 * racing on a fresh file cannot both apply the same migration. A failing file
 * leaves the database exactly as it was. Migration files must not contain
 * BEGIN/COMMIT of their own.
 */
export function migrate(db: Database.Database, dir: string = MIGRATIONS_DIR): Migration[] {
  ensureLedger(db);
  const migrations = listMigrations(dir);
  backfillLedger(db, migrations);
  verifyApplied(db, migrations);

  const applyIfPending = db.transaction((migration: Migration): boolean => {
    if (migration.version <= currentVersion(db)) return false;
    db.exec(migration.sql);
    insertLedger(db, migration);
    db.pragma(`user_version = ${migration.version}`);
    return true;
  });

  return migrations.filter((migration) => applyIfPending.immediate(migration));
}
```

- [ ] **Step 5: Expose the close hook and harden the entry point**

In `server/app.ts`, immediately before `return app;` at the end of `createApp`, add:

```ts
  // The entry point calls this on SIGINT/SIGTERM so WAL files are checkpointed on exit.
  app.locals.closeDatabases = () => {
    execDb.close();
    db.close();
  };
```

Overwrite `server/index.ts`:

```ts
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app';
import { API_HOST, apiPort, execDbPath } from './config';

const PORT = apiPort(process.env); // validate config before touching the filesystem

mkdirSync('data', { recursive: true });
// EXEC_DB_PATH may point outside data/; better-sqlite3 does not create parent directories.
mkdirSync(dirname(execDbPath(process.env)), { recursive: true });

const app = createApp();
const server = app.listen(PORT, API_HOST, () => {
  console.log(`TaskFlow API listening on http://${API_HOST}:${PORT}`);
});

const shutdown = () => {
  server.close(() => {
    app.locals.closeDatabases();
    process.exit(0);
  });
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/migrate.test.ts server/exec/__tests__/app-close.test.ts`
Expected: PASS — 12 in migrate (7 existing, with three expectations updated, + 5 new), 1 in app-close.

Run: `npx vitest run && npm run lint`
Expected: 270 tests green; lint clean.

- [ ] **Step 7: Prove the existing real database adopts the ledger**

Run: `npm run server` (background), wait for the banner, then in another shell: `node -e "const D=require('better-sqlite3');const db=new D('data/execution.db');console.log(db.prepare('SELECT version,name FROM schema_migrations').all(), db.pragma('user_version',{simple:true}))"`
Expected: `[ { version: 1, name: 'init' } ] 1` — the pre-ledger database from Phase 1 was backfilled, not re-migrated. Stop the server with Ctrl-C (or `kill -INT`): it exits within a second and `ls data/` shows no `execution.db-wal`, or an empty one.

- [ ] **Step 8: Commit**

```bash
git add server/exec/db/migrate.ts server/app.ts server/index.ts server/exec/__tests__/migrate.test.ts server/exec/__tests__/app-close.test.ts
git commit -m "feat: record applied migrations with checksums and close databases on shutdown"
```

---

### Task 2: Exact constraint assertions and the untested CHECKs

**Files:**
- Modify: `server/exec/__tests__/schema.test.ts`

**Interfaces:**
- Consumes: the Phase 1 schema (`server/exec/migrations/001_init.sql`), unchanged. SQLite 3.53 reports an unnamed CHECK as `CHECK constraint failed: <expression as written>`.
- Produces: no code; tests only.

- [ ] **Step 1: Tighten the generic assertions**

In `server/exec/__tests__/schema.test.ts`, make these exact replacements:

| Test | Replace | With |
|---|---|---|
| `refuses a second settings row` | `.toThrow(/CHECK constraint failed/)` | `.toThrow(/CHECK constraint failed: id = 1/)` |
| `accepts slots 1 to 3 and rejects slot 4` | `.toThrow(/CHECK constraint failed/)` | `.toThrow(/CHECK constraint failed: slot IN \(1, 2, 3\)/)` |
| `requires a killed outcome to give up its slot…` | both `.toThrow(/CHECK constraint failed/)` | `.toThrow(/CHECK constraint failed: \(status = 'killed'\) = \(slot IS NULL\)/)` |
| `keeps progress between 0 and 100…` | `.toThrow(/CHECK/)` (progress) | `.toThrow(/CHECK constraint failed: progress BETWEEN 0 AND 100/)` |
| same test | `.toThrow(/CHECK/)` (review_reason) | `.toThrow(/CHECK constraint failed: review_reason IN \(/)` |
| `accepts slots 1 and 2 and rejects slot 3` | `.toThrow(/CHECK constraint failed/)` | `.toThrow(/CHECK constraint failed: slot IN \(1, 2\)/)` |
| `only accepts the seven statuses` | `.toThrow(/CHECK constraint failed/)` | `.toThrow(/CHECK constraint failed: status IN \('inbox'/)` |
| `cannot end before it has started` | `.toThrow(/CHECK constraint failed/)` | `.toThrow(/CHECK constraint failed: ended_at IS NULL OR started_at IS NOT NULL/)` |

- [ ] **Step 2: Run the file to verify the tightened assertions hold**

Run: `npx vitest run server/exec/__tests__/schema.test.ts`
Expected: PASS, 20 tests — each regex matches the echoed expression. If one does not, the DDL text differs from the regex: fix the regex to the echoed text, never the DDL.

- [ ] **Step 3: Add the untested constraints**

Append inside the file, after the `deep_work_blocks` describe:

```ts
describe('the constraints no product limit covers', () => {
  const insertProject = (id: string, context: string, status = 'active') =>
    db
      .prepare('INSERT INTO projects (id, name, context, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, 'Project', context, status, NOW, NOW);

  it('keeps a week start date unique', () => {
    insertWeek('w1', '2026-09-20');
    expect(() => insertWeek('w2', '2026-09-20')).toThrow(/UNIQUE constraint failed: weeks.start_date/);
  });

  it('limits a project to the two contexts and three statuses', () => {
    expect(() => insertProject('p1', 'home')).toThrow(/CHECK constraint failed: context IN \('work', 'build'\)/);
    expect(() => insertProject('p2', 'work', 'paused')).toThrow(/CHECK constraint failed: status IN \('active', 'done', 'archived'\)/);
    expect(() => insertProject('p3', 'build')).not.toThrow();
  });

  it('limits an outcome to the four categories and the review code lists', () => {
    insertWeek();
    expect(() =>
      db
        .prepare(`INSERT INTO outcomes (id, week_id, slot, title, category, created_at, updated_at) VALUES ('o1', 'w1', 1, 'O', 'hobby', ?, ?)`)
        .run(NOW, NOW)
    ).toThrow(/CHECK constraint failed: category IN \(/);
    insertOutcome('o2', 2);
    expect(() => db.prepare("UPDATE outcomes SET review_grade = 'great' WHERE id = 'o2'").run()).toThrow(/CHECK constraint failed: review_grade IN \(/);
    expect(() => db.prepare("UPDATE outcomes SET review_disposition = 'ignore' WHERE id = 'o2'").run()).toThrow(/CHECK constraint failed: review_disposition IN \(/);
    expect(() => db.prepare("UPDATE outcomes SET review_grade = 'partial', review_disposition = 'reschedule' WHERE id = 'o2'").run()).not.toThrow();
  });

  it('limits a must ship to the six statuses', () => {
    insertMustShip('m1', '2026-09-22', 'work');
    expect(() => db.prepare("UPDATE must_ships SET status = 'almost' WHERE id = 'm1'").run()).toThrow(/CHECK constraint failed: status IN \('planned'/);
  });

  it('limits a deep work block to the two contexts and four results', () => {
    const insert = (id: string, context: string, result: string | null) =>
      db
        .prepare(
          `INSERT INTO deep_work_blocks (id, date, context, planned_start, planned_minutes, result, created_at, updated_at)
           VALUES (?, '2026-09-22', ?, '08:35', 90, ?, ?, ?)`
        )
        .run(id, context, result, NOW, NOW);
    expect(() => insert('b1', 'home', null)).toThrow(/CHECK constraint failed: context IN \('work', 'build'\)/);
    expect(() => insert('b2', 'work', 'meh')).toThrow(/CHECK constraint failed: result IN \(/);
    expect(() => insert('b3', 'work', 'progress')).not.toThrow();
  });

  it('bounds the settings weekday and minutes and a block\'s planned minutes', () => {
    expect(() => db.prepare('UPDATE settings SET week_start_day = 7 WHERE id = 1').run()).toThrow(/CHECK constraint failed: week_start_day BETWEEN 0 AND 6/);
    expect(() => db.prepare('UPDATE settings SET deep_work_minutes = 0 WHERE id = 1').run()).toThrow(/CHECK constraint failed: deep_work_minutes > 0/);
    expect(() =>
      db
        .prepare(
          `INSERT INTO deep_work_blocks (id, date, context, planned_start, planned_minutes, created_at, updated_at)
           VALUES ('b0', '2026-09-22', 'work', '08:35', 0, ?, ?)`
        )
        .run(NOW, NOW)
    ).toThrow(/CHECK constraint failed: planned_minutes > 0/);
  });
});
```

- [ ] **Step 4: Run the file to verify it passes**

Run: `npx vitest run server/exec/__tests__/schema.test.ts`
Expected: PASS, 26 tests.

Run: `npx vitest run && npm run lint`
Expected: 276 tests green; lint clean.

- [ ] **Step 5: Commit**

```bash
git add server/exec/__tests__/schema.test.ts
git commit -m "test: assert exact constraint text and cover every enum CHECK and bound"
```

---

### Task 3: Shared schemas, calendar dates and the local clock

**Files:**
- Create: `src/shared/exec/dates.ts`, `src/shared/exec/time.ts`, `src/shared/exec/schemas.ts`
- Test: `src/shared/exec/dates.test.ts`, `src/shared/exec/time.test.ts`, `src/shared/exec/schemas.test.ts` (node project)

**Interfaces:**
- Produces (all exported):
  - `dates.ts`: `isCalendarDate(value: string): boolean`, `addDays(date: string, days: number): string`, `toCalendarDate(utc: Date): string`, `compareDates(a: string, b: string): number`
  - `time.ts`: `type LocalClock = { date: string; weekday: number; minutes: number }`, `localClock(now: Date, timeZone: string): LocalClock`, `hhmmToMinutes(hhmm: string): number`, `isWorkDay(clock, settings): boolean`, `isOfficeHours(clock, settings): boolean`, `defaultContext(now: Date, settings: Settings): Context`, `weekStartOf(date: string, weekStartDay: number): string`, `weekEndOf(date, weekStartDay): string`
  - `schemas.ts`: `CONTEXTS`, `contextSchema`, `type Context`; `TASK_STATUSES`, `taskStatusSchema`, `type TaskStatus`, `OPEN_STATUSES`, `WAITING_STATUSES`; `calendarDateSchema`; `taskSchema`/`type Task`; `taskCreateSchema`/`type TaskCreate`; `taskPatchSchema`/`type TaskPatch`; `taskRollSchema`/`type TaskRoll`; `taskListQuerySchema`/`type TaskListQuery` (output type: `status?: TaskStatus[]`); `settingsSchema`/`type Settings`; `projectSchema`/`type Project`

- [ ] **Step 1: Write the failing date tests**

Create `src/shared/exec/dates.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isCalendarDate, addDays, compareDates, toCalendarDate } from './dates';

describe('isCalendarDate', () => {
  it.each(['2026-09-22', '2024-02-29', '2026-12-31'])('accepts %s', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each(['2026-02-29', '2026-13-01', '2026-09-31', '2026-9-1', '22-09-2026', '2026-09-22T00:00:00Z', ''])(
    'rejects %j',
    (value) => {
      expect(isCalendarDate(value)).toBe(false);
    }
  );
});

describe('addDays', () => {
  it('crosses month and year ends in calendar space', () => {
    expect(addDays('2026-09-28', 6)).toBe('2026-10-04');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-09-22', 0)).toBe('2026-09-22');
  });
});

describe('compareDates and toCalendarDate', () => {
  it('orders calendar dates and formats a UTC instant', () => {
    expect(compareDates('2026-09-21', '2026-09-22')).toBeLessThan(0);
    expect(compareDates('2026-09-22', '2026-09-22')).toBe(0);
    expect(compareDates('2026-10-01', '2026-09-30')).toBeGreaterThan(0);
    expect(toCalendarDate(new Date('2026-09-22T23:59:59Z'))).toBe('2026-09-22');
  });
});
```

- [ ] **Step 2: Write the failing clock tests**

Create `src/shared/exec/time.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Settings } from './schemas';
import { localClock, hhmmToMinutes, isWorkDay, isOfficeHours, defaultContext, weekStartOf, weekEndOf } from './time';

const SETTINGS: Settings = {
  timezone: 'Asia/Karachi',
  weekStartDay: 0,
  workDays: [1, 2, 3, 4, 5],
  deepWorkStart: '08:35',
  deepWorkMinutes: 90,
  shutdownTime: '17:00',
  officeStart: '08:15',
  officeEnd: '18:00',
  buildBlocks: [],
};

describe('localClock', () => {
  it('reads the wall clock in the settings time zone', () => {
    // 04:00 UTC on Tuesday 22 Sep 2026 is 09:00 in Karachi (UTC+5).
    expect(localClock(new Date('2026-09-22T04:00:00Z'), 'Asia/Karachi')).toEqual({ date: '2026-09-22', weekday: 2, minutes: 540 });
  });

  it('rolls the calendar date with the zone, not with UTC', () => {
    // 20:30 UTC on 21 Sep is 01:30 on 22 Sep in Karachi.
    expect(localClock(new Date('2026-09-21T20:30:00Z'), 'Asia/Karachi')).toEqual({ date: '2026-09-22', weekday: 2, minutes: 90 });
  });

  it('reports midnight as minute 0, not 24 hours', () => {
    expect(localClock(new Date('2026-09-21T19:00:00Z'), 'Asia/Karachi').minutes).toBe(0);
  });
});

describe('office hours', () => {
  const at = (iso: string) => localClock(new Date(iso), SETTINGS.timezone);

  it('is a work day inside the office window, start inclusive and end exclusive', () => {
    expect(isOfficeHours(at('2026-09-22T03:15:00Z'), SETTINGS)).toBe(true); // 08:15
    expect(isOfficeHours(at('2026-09-22T12:59:00Z'), SETTINGS)).toBe(true); // 17:59
    expect(isOfficeHours(at('2026-09-22T13:00:00Z'), SETTINGS)).toBe(false); // 18:00
    expect(isOfficeHours(at('2026-09-22T03:14:00Z'), SETTINGS)).toBe(false); // 08:14
  });

  it('is never office hours on a non-work day', () => {
    const saturday = at('2026-09-26T05:00:00Z'); // 10:00 Saturday
    expect(isWorkDay(saturday, SETTINGS)).toBe(false);
    expect(isOfficeHours(saturday, SETTINGS)).toBe(false);
  });

  it('defaults capture to work in office hours and to build otherwise', () => {
    expect(defaultContext(new Date('2026-09-22T04:00:00Z'), SETTINGS)).toBe('work');
    expect(defaultContext(new Date('2026-09-22T14:00:00Z'), SETTINGS)).toBe('build');
    expect(defaultContext(new Date('2026-09-26T05:00:00Z'), SETTINGS)).toBe('build');
  });

  it('converts HH:MM to minutes', () => {
    expect(hhmmToMinutes('08:35')).toBe(515);
    expect(hhmmToMinutes('00:00')).toBe(0);
  });
});

describe('planning week', () => {
  it('starts on the configured weekday on or before the date', () => {
    expect(weekStartOf('2026-09-22', 0)).toBe('2026-09-20'); // Tuesday -> Sunday
    expect(weekStartOf('2026-09-20', 0)).toBe('2026-09-20'); // Sunday stays
    expect(weekStartOf('2026-09-20', 1)).toBe('2026-09-14'); // Sunday -> previous Monday
    expect(weekStartOf('2026-09-22', 1)).toBe('2026-09-21');
  });

  it('ends six days after it starts', () => {
    expect(weekEndOf('2026-09-22', 0)).toBe('2026-09-26');
    expect(weekEndOf('2026-12-30', 1)).toBe('2027-01-03');
  });
});
```

- [ ] **Step 3: Write the failing schema tests**

Create `src/shared/exec/schemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { taskCreateSchema, taskPatchSchema, taskRollSchema, taskListQuerySchema, settingsSchema, taskSchema } from './schemas';

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.path.join('.'));

describe('taskCreateSchema', () => {
  it('trims the title, defaults notes and keeps the context', () => {
    expect(taskCreateSchema.parse({ title: '  Call the supplier ', context: 'work' })).toEqual({
      title: 'Call the supplier',
      context: 'work',
      notes: '',
    });
  });

  it('rejects an empty or oversized title, an unknown context and unknown keys', () => {
    expect(issuePaths(taskCreateSchema.safeParse({ title: '   ', context: 'work' }))).toEqual(['title']);
    expect(issuePaths(taskCreateSchema.safeParse({ title: 'x'.repeat(201), context: 'work' }))).toEqual(['title']);
    expect(issuePaths(taskCreateSchema.safeParse({ title: 'ok', context: 'home' }))).toEqual(['context']);
    expect(issuePaths(taskCreateSchema.safeParse({ title: 'ok', context: 'work', status: 'done' }))).toEqual(['']);
  });
});

describe('taskPatchSchema', () => {
  it('accepts a partial patch with null dates and rejects an empty one', () => {
    expect(taskPatchSchema.parse({ status: 'later', scheduledDate: null })).toEqual({ status: 'later', scheduledDate: null });
    expect(taskPatchSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an impossible calendar date, a blank owner and a non-uuid project', () => {
    expect(issuePaths(taskPatchSchema.safeParse({ scheduledDate: '2026-02-30' }))).toEqual(['scheduledDate']);
    expect(issuePaths(taskPatchSchema.safeParse({ ownerName: '   ' }))).toEqual(['ownerName']);
    expect(issuePaths(taskPatchSchema.safeParse({ projectId: 'proj-1' }))).toEqual(['projectId']);
  });
});

describe('taskRollSchema and taskListQuerySchema', () => {
  it('parses a roll date and a comma-separated status list', () => {
    expect(taskRollSchema.parse({ date: '2026-09-23' })).toEqual({ date: '2026-09-23' });
    expect(taskListQuerySchema.parse({ status: 'inbox, later', context: 'work' })).toEqual({
      status: ['inbox', 'later'],
      context: 'work',
    });
    expect(taskListQuerySchema.parse({})).toEqual({});
  });

  it('rejects an unknown status, a bad week date and an unknown query key', () => {
    expect(taskListQuerySchema.safeParse({ status: 'inbox,someday' }).success).toBe(false);
    expect(taskListQuerySchema.safeParse({ week: '2026-9-20' }).success).toBe(false);
    expect(taskListQuerySchema.safeParse({ page: '2' }).success).toBe(false);
  });
});

describe('settingsSchema and taskSchema', () => {
  it('accepts the seeded defaults once the JSON columns are decoded', () => {
    expect(
      settingsSchema.safeParse({
        timezone: 'Asia/Karachi',
        weekStartDay: 0,
        workDays: [1, 2, 3, 4, 5],
        deepWorkStart: '08:35',
        deepWorkMinutes: 90,
        shutdownTime: '17:00',
        officeStart: '08:15',
        officeEnd: '18:00',
        buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }],
      }).success
    ).toBe(true);
  });

  it('rejects a task row with a malformed timestamp', () => {
    const row = {
      id: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f',
      title: 'x',
      notes: '',
      context: 'work',
      status: 'inbox',
      projectId: null,
      outcomeId: null,
      mustShipId: null,
      scheduledDate: null,
      dueDate: null,
      ownerName: null,
      expectedOutput: null,
      followUpDate: null,
      rollCount: 0,
      rolledAt: null,
      capturedAt: 'yesterday',
      processedAt: null,
      delegatedAt: null,
      closedAt: null,
      createdAt: '2026-09-22T03:00:00.000Z',
      updatedAt: '2026-09-22T03:00:00.000Z',
    };
    expect(issuePaths(taskSchema.safeParse(row))).toEqual(['capturedAt']);
    expect(taskSchema.safeParse({ ...row, capturedAt: row.createdAt }).success).toBe(true);
  });
});
```

- [ ] **Step 4: Run the three files to verify they fail**

Run: `npx vitest run src/shared/exec`
Expected: FAIL — the three modules cannot be resolved.

- [ ] **Step 5: Write the date helpers**

Create `src/shared/exec/dates.ts`:

```ts
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The date part of a UTC instant, as YYYY-MM-DD. */
export function toCalendarDate(utc: Date): string {
  return utc.toISOString().slice(0, 10);
}

/** True for a real calendar date written YYYY-MM-DD (so 2026-02-30 is false). */
export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  return toCalendarDate(new Date(Date.UTC(year, month - 1, day))) === value;
}

/** Adds whole days to a calendar date, staying in calendar space: no time zones, no DST. */
export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return toCalendarDate(new Date(Date.UTC(year, month - 1, day + days)));
}

/** Negative when a is earlier, zero when equal, positive when later. Calendar dates sort as text. */
export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
```

- [ ] **Step 6: Write the schemas**

Create `src/shared/exec/schemas.ts`:

```ts
import { z } from 'zod';
import { isCalendarDate } from './dates';

/** Every body and query of /api/exec is parsed by one of these before anything else runs. */

export const CONTEXTS = ['work', 'build'] as const;
export const contextSchema = z.enum(CONTEXTS);
export type Context = z.infer<typeof contextSchema>;

export const TASK_STATUSES = ['inbox', 'this_week', 'later', 'delegated', 'waiting', 'done', 'killed'] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export const OPEN_STATUSES: readonly TaskStatus[] = ['inbox', 'this_week', 'later', 'delegated', 'waiting'];
export const WAITING_STATUSES: readonly TaskStatus[] = ['delegated', 'waiting'];

export const calendarDateSchema = z.string().refine(isCalendarDate, 'expected a calendar date YYYY-MM-DD');
const timestamp = z.iso.datetime();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');
const uuid = z.uuid();
const title = z.string().trim().min(1, 'title is required').max(200, 'title is too long');
const notes = z.string().max(4000, 'notes are too long');

export const taskSchema = z.object({
  id: uuid,
  title,
  notes,
  context: contextSchema,
  status: taskStatusSchema,
  projectId: uuid.nullable(),
  outcomeId: uuid.nullable(),
  mustShipId: uuid.nullable(),
  scheduledDate: calendarDateSchema.nullable(),
  dueDate: calendarDateSchema.nullable(),
  ownerName: z.string().nullable(),
  expectedOutput: z.string().nullable(),
  followUpDate: calendarDateSchema.nullable(),
  rollCount: z.number().int().nonnegative(),
  rolledAt: timestamp.nullable(),
  capturedAt: timestamp,
  processedAt: timestamp.nullable(),
  delegatedAt: timestamp.nullable(),
  closedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Task = z.infer<typeof taskSchema>;

/** Capture: a title and a context, nothing else. Status is always inbox. */
export const taskCreateSchema = z.strictObject({
  title,
  context: contextSchema,
  notes: notes.default(''),
});
export type TaskCreate = z.infer<typeof taskCreateSchema>;

/** Processing and disposition. Timestamps are never client-writable. */
export const taskPatchSchema = z
  .strictObject({
    title: title.optional(),
    notes: notes.optional(),
    context: contextSchema.optional(),
    status: taskStatusSchema.optional(),
    projectId: uuid.nullable().optional(),
    outcomeId: uuid.nullable().optional(),
    mustShipId: uuid.nullable().optional(),
    scheduledDate: calendarDateSchema.nullable().optional(),
    dueDate: calendarDateSchema.nullable().optional(),
    ownerName: z.string().trim().min(1, 'owner is required').max(120).nullable().optional(),
    expectedOutput: z.string().max(2000).nullable().optional(),
    followUpDate: calendarDateSchema.nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export const taskRollSchema = z.strictObject({ date: calendarDateSchema });
export type TaskRoll = z.infer<typeof taskRollSchema>;

const statusList = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()).filter(Boolean))
  .pipe(z.array(taskStatusSchema).min(1));

export const taskListQuerySchema = z.strictObject({
  status: statusList.optional(),
  context: contextSchema.optional(),
  week: calendarDateSchema.optional(),
  followUpBy: calendarDateSchema.optional(),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

const weekday = z.number().int().min(0).max(6);

export const settingsSchema = z.object({
  timezone: z.string().min(1),
  weekStartDay: weekday,
  workDays: z.array(weekday),
  deepWorkStart: hhmm,
  deepWorkMinutes: z.number().int().positive(),
  shutdownTime: hhmm,
  officeStart: hhmm,
  officeEnd: hhmm,
  buildBlocks: z.array(z.object({ weekday, start: hhmm, minutes: z.number().int().positive() })),
});
export type Settings = z.infer<typeof settingsSchema>;

export const projectSchema = z.object({
  id: uuid,
  name: z.string(),
  context: contextSchema,
  status: z.enum(['active', 'done', 'archived']),
  notes: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Project = z.infer<typeof projectSchema>;
```

- [ ] **Step 7: Write the clock**

Create `src/shared/exec/time.ts`:

```ts
import { addDays } from './dates';
import type { Context, Settings } from './schemas';

export type LocalClock = { date: string; weekday: number; minutes: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** The wall clock in a zone: calendar date, weekday (0 = Sunday) and minutes since midnight. */
export function localClock(now: Date, timeZone: string): LocalClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return {
    date: `${part('year')}-${part('month')}-${part('day')}`,
    weekday: WEEKDAYS.indexOf(part('weekday')),
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
  };
}

export function hhmmToMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
}

export const isWorkDay = (clock: LocalClock, settings: Settings): boolean => settings.workDays.includes(clock.weekday);

/** Office hours run from officeStart (inclusive) to officeEnd (exclusive) on work days. */
export const isOfficeHours = (clock: LocalClock, settings: Settings): boolean =>
  isWorkDay(clock, settings) &&
  clock.minutes >= hhmmToMinutes(settings.officeStart) &&
  clock.minutes < hhmmToMinutes(settings.officeEnd);

/** Capture defaults to work in office hours and to build everywhere else (§16). */
export const defaultContext = (now: Date, settings: Settings): Context =>
  isOfficeHours(localClock(now, settings.timezone), settings) ? 'work' : 'build';

/** The first day of the planning week that contains `date`. */
export function weekStartOf(date: string, weekStartDay: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return addDays(date, -((weekday - weekStartDay + 7) % 7));
}

export const weekEndOf = (date: string, weekStartDay: number): string => addDays(weekStartOf(date, weekStartDay), 6);
```

- [ ] **Step 8: Run the three files to verify they pass**

Run: `npx vitest run src/shared/exec`
Expected: PASS — 3 date tests (+7 parametrised cases = 10 items), 9 time tests, 8 schema tests.

Run: `npx vitest run && npm run lint`
Expected: everything green (the total grows by the new tests); lint clean.

- [ ] **Step 9: Commit**

```bash
git add src/shared/exec/dates.ts src/shared/exec/time.ts src/shared/exec/schemas.ts src/shared/exec/dates.test.ts src/shared/exec/time.test.ts src/shared/exec/schemas.test.ts
git commit -m "feat: add the shared task schemas, calendar dates and local clock"
```

---

### Task 4: The tasks data module

**Files:**
- Create: `server/exec/clock.ts`, `server/exec/tasks/transitions.ts`, `server/exec/tasks/store.ts`
- Test: `server/exec/__tests__/tasks-store.test.ts`

**Interfaces:**
- Consumes: `rowToEntity`, `entityToRow`, `FieldSpec` (`server/db/mappers.ts`); `assertValidColumns`, `getTableColumns` (`server/db/sql.ts`); `ApiError` (`server/exec/http.ts`); `addDays`; the Task 3 schemas.
- Produces:
  - `clock.ts`: `nowIso(): string`
  - `transitions.ts`: `transitionStamps(from: TaskStatus, to: TaskStatus, processedAt: string | null, now: string): { processedAt?: string; delegatedAt?: string; closedAt?: string | null }`, `requiresOwner(to: TaskStatus): boolean`
  - `store.ts`: `listTasks(db, query: TaskListQuery): Task[]`, `getTask(db, id): Task | null`, `createTask(db, input: TaskCreate, now): Task`, `patchTask(db, id, patch: TaskPatch, now): Task | null` (throws `ApiError(400, 'VALIDATION', …)` when an owner is required and absent), `rollTask(db, id, date, now): Task | null`, `deleteTask(db, id): 'deleted' | 'missing' | 'not_allowed'`

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/tasks-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { createTask, getTask, listTasks, patchTask, rollTask, deleteTask } from '../tasks/store';
import { transitionStamps } from '../tasks/transitions';
import { ApiError } from '../http';

const T0 = '2026-09-22T03:00:00.000Z';
const T1 = '2026-09-22T03:05:00.000Z';
const T2 = '2026-09-22T03:10:00.000Z';
let db: Database.Database;

const capture = (title: string, context: 'work' | 'build' = 'work', now = T0) =>
  createTask(db, { title, context, notes: '' }, now);

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('createTask', () => {
  it('captures into the inbox with a server id and timestamps', () => {
    const task = capture('Call the supplier');
    expect(task).toMatchObject({
      title: 'Call the supplier',
      context: 'work',
      status: 'inbox',
      notes: '',
      rollCount: 0,
      capturedAt: T0,
      createdAt: T0,
      updatedAt: T0,
      processedAt: null,
      delegatedAt: null,
      closedAt: null,
      scheduledDate: null,
      ownerName: null,
    });
    expect(task.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getTask(db, task.id)).toEqual(task);
  });
});

describe('listTasks', () => {
  it('returns newest capture first', () => {
    capture('first', 'work', T0);
    capture('second', 'work', T1);
    capture('third', 'build', T2);
    expect(listTasks(db, {}).map((t) => t.title)).toEqual(['third', 'second', 'first']);
  });

  it('filters by status list and by context', () => {
    const a = capture('a', 'work');
    capture('b', 'build');
    patchTask(db, a.id, { status: 'later' }, T1);
    expect(listTasks(db, { status: ['later'] }).map((t) => t.title)).toEqual(['a']);
    expect(listTasks(db, { status: ['inbox', 'later'], context: 'build' }).map((t) => t.title)).toEqual(['b']);
  });

  it('returns this-week tasks and open tasks scheduled inside the week, never closed ones', () => {
    const committed = capture('committed');
    const scheduledIn = capture('scheduled in');
    const scheduledOut = capture('scheduled out');
    const done = capture('done');
    patchTask(db, committed.id, { status: 'this_week' }, T1);
    patchTask(db, scheduledIn.id, { status: 'later', scheduledDate: '2026-09-25' }, T1);
    patchTask(db, scheduledOut.id, { status: 'later', scheduledDate: '2026-09-27' }, T1);
    patchTask(db, done.id, { status: 'done', scheduledDate: '2026-09-24' }, T1);
    expect(listTasks(db, { week: '2026-09-20' }).map((t) => t.title).sort()).toEqual(['committed', 'scheduled in']);
  });

  it('returns delegated and waiting tasks whose follow-up is due', () => {
    const due = capture('due');
    const notYet = capture('not yet');
    const mine = capture('mine');
    patchTask(db, due.id, { status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-22' }, T1);
    patchTask(db, notYet.id, { status: 'waiting', ownerName: 'Supplier', followUpDate: '2026-09-30' }, T1);
    patchTask(db, mine.id, { status: 'this_week', followUpDate: '2026-09-22' }, T1);
    expect(listTasks(db, { followUpBy: '2026-09-22' }).map((t) => t.title)).toEqual(['due']);
  });
});

describe('patchTask', () => {
  it('stamps processedAt once, on first leaving the inbox', () => {
    const task = capture('x');
    const later = patchTask(db, task.id, { status: 'later' }, T1);
    expect(later).toMatchObject({ status: 'later', processedAt: T1, updatedAt: T1 });
    const thisWeek = patchTask(db, task.id, { status: 'this_week' }, T2);
    expect(thisWeek?.processedAt).toBe(T1);
  });

  it('stamps delegatedAt when a task is handed off and requires an owner', () => {
    const task = capture('x');
    expect(() => patchTask(db, task.id, { status: 'delegated' }, T1)).toThrow(ApiError);
    expect(() => patchTask(db, task.id, { status: 'waiting' }, T1)).toThrow(/ownerName is required/);
    const delegated = patchTask(db, task.id, { status: 'delegated', ownerName: 'Bilal', expectedOutput: 'The tracker' }, T1);
    expect(delegated).toMatchObject({ status: 'delegated', ownerName: 'Bilal', delegatedAt: T1, processedAt: T1 });
  });

  it('accepts a hand-off when the owner was set earlier', () => {
    const task = capture('x');
    patchTask(db, task.id, { ownerName: 'Bilal' }, T1);
    expect(patchTask(db, task.id, { status: 'waiting' }, T2)?.status).toBe('waiting');
  });

  it('stamps closedAt on done or killed and clears it on reopen', () => {
    const task = capture('x');
    expect(patchTask(db, task.id, { status: 'killed' }, T1)?.closedAt).toBe(T1);
    expect(patchTask(db, task.id, { status: 'later' }, T2)).toMatchObject({ status: 'later', closedAt: null });
  });

  it('edits fields without touching status stamps and returns null for an unknown id', () => {
    const task = capture('x');
    const edited = patchTask(db, task.id, { title: 'y', notes: 'n', dueDate: '2026-09-30' }, T1);
    expect(edited).toMatchObject({ title: 'y', notes: 'n', dueDate: '2026-09-30', status: 'inbox', processedAt: null });
    expect(patchTask(db, 'missing', { title: 'z' }, T1)).toBeNull();
  });
});

describe('rollTask', () => {
  it('moves the scheduled date forward and counts the roll', () => {
    const task = capture('x');
    const rolled = rollTask(db, task.id, '2026-09-23', T1);
    expect(rolled).toMatchObject({ scheduledDate: '2026-09-23', rollCount: 1, rolledAt: T1, updatedAt: T1 });
    expect(rollTask(db, task.id, '2026-09-24', T2)?.rollCount).toBe(2);
    expect(rollTask(db, 'missing', '2026-09-24', T2)).toBeNull();
  });
});

describe('deleteTask', () => {
  it('deletes only inbox items', () => {
    const inbox = capture('inbox');
    const later = capture('later');
    patchTask(db, later.id, { status: 'later' }, T1);
    expect(deleteTask(db, inbox.id)).toBe('deleted');
    expect(getTask(db, inbox.id)).toBeNull();
    expect(deleteTask(db, later.id)).toBe('not_allowed');
    expect(deleteTask(db, 'missing')).toBe('missing');
  });
});

describe('transitionStamps', () => {
  it('is empty when the status does not change', () => {
    expect(transitionStamps('later', 'later', T0, T1)).toEqual({});
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/exec/__tests__/tasks-store.test.ts`
Expected: FAIL — `../tasks/store` cannot be resolved.

- [ ] **Step 3: Write the clock and the transition rules**

Create `server/exec/clock.ts`:

```ts
/** The server's only source of "now"; routes take it as a parameter so tests can fix it. */
export const nowIso = (): string => new Date().toISOString();
```

Create `server/exec/tasks/transitions.ts`:

```ts
import type { TaskStatus } from '../../../src/shared/exec/schemas';
import { WAITING_STATUSES } from '../../../src/shared/exec/schemas';

export type TransitionStamps = { processedAt?: string; delegatedAt?: string; closedAt?: string | null };

const isClosed = (status: TaskStatus) => status === 'done' || status === 'killed';

/**
 * The timestamp rules of a status change (spec B, tasks): processedAt is set the first
 * time a task leaves the inbox, delegatedAt whenever it is handed off, closedAt when it
 * is done or killed and cleared again if it is reopened.
 */
export function transitionStamps(from: TaskStatus, to: TaskStatus, processedAt: string | null, now: string): TransitionStamps {
  if (from === to) return {};
  return {
    ...(from === 'inbox' && processedAt === null ? { processedAt: now } : {}),
    ...(WAITING_STATUSES.includes(to) ? { delegatedAt: now } : {}),
    ...(isClosed(to) ? { closedAt: now } : isClosed(from) ? { closedAt: null } : {}),
  };
}

export const requiresOwner = (to: TaskStatus): boolean => WAITING_STATUSES.includes(to);
```

- [ ] **Step 4: Write the store**

Create `server/exec/tasks/store.ts`:

```ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { rowToEntity, entityToRow, type FieldSpec } from '../../db/mappers';
import { assertValidColumns, getTableColumns } from '../../db/sql';
import { ApiError } from '../http';
import { addDays } from '../../../src/shared/exec/dates';
import { OPEN_STATUSES } from '../../../src/shared/exec/schemas';
import type { Task, TaskCreate, TaskPatch, TaskListQuery } from '../../../src/shared/exec/schemas';
import { transitionStamps, requiresOwner } from './transitions';

// Exec rows keep dates and timestamps as text, so no codec applies; the spec only drives snake/camel.
const PLAIN: FieldSpec = { json: [], dates: [], bools: [] };
const toTask = (row: unknown): Task => rowToEntity<Task>(row as Record<string, unknown>, PLAIN);

type Bindable = string | number | null;
const placeholders = (count: number) => Array.from({ length: count }, () => '?').join(', ');

const columnsByDb = new WeakMap<Database.Database, Set<string>>();
const tasksColumns = (db: Database.Database): Set<string> => {
  const cached = columnsByDb.get(db) ?? getTableColumns(db, 'tasks');
  columnsByDb.set(db, cached);
  return cached;
};

export function getTask(db: Database.Database, id: string): Task | null {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  return row ? toTask(row) : null;
}

/** Newest capture first. Filters combine with AND; `week` is the week's first day. */
export function listTasks(db: Database.Database, query: TaskListQuery): Task[] {
  const clauses: string[] = [];
  const params: Bindable[] = [];
  if (query.status) {
    clauses.push(`status IN (${placeholders(query.status.length)})`);
    params.push(...query.status);
  }
  if (query.context) {
    clauses.push('context = ?');
    params.push(query.context);
  }
  if (query.week) {
    clauses.push(`(status = 'this_week' OR (status IN (${placeholders(OPEN_STATUSES.length)}) AND scheduled_date BETWEEN ? AND ?))`);
    params.push(...OPEN_STATUSES, query.week, addDays(query.week, 6));
  }
  if (query.followUpBy) {
    clauses.push("status IN ('delegated', 'waiting') AND follow_up_date IS NOT NULL AND follow_up_date <= ?");
    params.push(query.followUpBy);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return db.prepare(`SELECT * FROM tasks ${where} ORDER BY captured_at DESC, id`).all(...params).map(toTask);
}

/** Capture is not commitment: every new task starts in the inbox. */
export function createTask(db: Database.Database, input: TaskCreate, now: string): Task {
  const id = randomUUID();
  db.prepare(
    `INSERT INTO tasks (id, title, notes, context, status, captured_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'inbox', ?, ?, ?)`
  ).run(id, input.title, input.notes, input.context, now, now, now);
  return getTask(db, id) as Task;
}

function writeRow(db: Database.Database, id: string, fields: Record<string, unknown>): void {
  const row = entityToRow(fields, PLAIN);
  assertValidColumns(row, tasksColumns(db));
  const columns = Object.keys(row);
  const values = Object.values(row) as Bindable[];
  db.prepare(`UPDATE tasks SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`).run(...values, id);
}

/** Applies a patch plus the transition stamps; null when the task does not exist. */
export function patchTask(db: Database.Database, id: string, patch: TaskPatch, now: string): Task | null {
  const current = getTask(db, id);
  if (!current) return null;
  const to = patch.status ?? current.status;
  const owner = patch.ownerName === undefined ? current.ownerName : patch.ownerName;
  if (requiresOwner(to) && !owner) {
    throw new ApiError(400, 'VALIDATION', 'ownerName is required when a task is delegated or waiting');
  }
  const stamps = patch.status ? transitionStamps(current.status, patch.status, current.processedAt, now) : {};
  writeRow(db, id, { ...patch, ...stamps, updatedAt: now });
  return getTask(db, id);
}

/** Shutdown's "Tomorrow": move the scheduled date and count the roll. */
export function rollTask(db: Database.Database, id: string, date: string, now: string): Task | null {
  const current = getTask(db, id);
  if (!current) return null;
  writeRow(db, id, { scheduledDate: date, rollCount: current.rollCount + 1, rolledAt: now, updatedAt: now });
  return getTask(db, id);
}

export type DeleteResult = 'deleted' | 'missing' | 'not_allowed';

/** Only an accidental capture may vanish; anything processed is killed, never deleted. */
export function deleteTask(db: Database.Database, id: string): DeleteResult {
  const current = getTask(db, id);
  if (!current) return 'missing';
  if (current.status !== 'inbox') return 'not_allowed';
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return 'deleted';
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run server/exec/__tests__/tasks-store.test.ts`
Expected: PASS, 13 tests.

Run: `npx vitest run && npm run lint`
Expected: everything green; lint clean.

- [ ] **Step 6: Commit**

```bash
git add server/exec/clock.ts server/exec/tasks/transitions.ts server/exec/tasks/store.ts server/exec/__tests__/tasks-store.test.ts
git commit -m "feat: add the tasks data module with capture, processing, roll and delete rules"
```

---

### Task 5: The tasks, settings and projects routes

**Files:**
- Create: `server/exec/routes/tasks.ts`, `server/exec/routes/settings.ts`, `server/exec/routes/projects.ts`
- Modify: `server/exec/router.ts`
- Test: `server/exec/__tests__/tasks-routes.test.ts`, `server/exec/__tests__/settings-routes.test.ts`

**Interfaces:**
- Consumes: Task 4's store and clock; Task 3's schemas; `ok`, `ApiError` (`server/exec/http.ts`); `rowToEntity` (`server/db/mappers.ts`); `createExecRouter` with its `extend` hook (unchanged).
- Produces: `tasksRouter(db, clock = nowIso): Router` serving `GET /`, `POST /`, `PATCH /:id`, `POST /:id/roll`, `DELETE /:id`; `settingsRouter(db): Router` serving `GET /`; `projectsRouter(db): Router` serving `GET /`; all three mounted at `/api/exec/tasks`, `/api/exec/settings`, `/api/exec/projects` before the `extend` hook and the 404 catch-all.

- [ ] **Step 1: Write the failing route tests**

Create `server/exec/__tests__/tasks-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { taskSchema } from '../../../src/shared/exec/schemas';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
let app: Express;

const capture = async (title: string, context = 'work') => {
  const res = await request(app).post('/api/exec/tasks').send({ title, context });
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
};
const patch = (id: string, body: unknown) => request(app).patch(`/api/exec/tasks/${id}`).send(body);

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

describe('POST /api/exec/tasks', () => {
  it('captures into the inbox and answers 201 with a well-formed task', async () => {
    const res = await request(app).post('/api/exec/tasks').send({ title: '  Call the supplier ', context: 'work' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(taskSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toMatchObject({ title: 'Call the supplier', context: 'work', status: 'inbox', rollCount: 0 });
    expect(res.body.data.capturedAt).toMatch(ISO);
  });

  it('rejects a blank title, an unknown context and an unknown key with VALIDATION details', async () => {
    const blank = await request(app).post('/api/exec/tasks').send({ title: '  ', context: 'work' });
    expect(blank.status).toBe(400);
    expect(blank.body).toMatchObject({ success: false, code: 'VALIDATION', details: [{ path: 'title' }] });
    const context = await request(app).post('/api/exec/tasks').send({ title: 'x', context: 'home' });
    expect(context.body.details.map((d: { path: string }) => d.path)).toEqual(['context']);
    const extra = await request(app).post('/api/exec/tasks').send({ title: 'x', context: 'work', status: 'done' });
    expect(extra.status).toBe(400);
    expect(JSON.stringify(extra.body)).not.toContain('done');
  });
});

describe('GET /api/exec/tasks', () => {
  it('lists newest first and filters by status, context, week and follow-up', async () => {
    const a = await capture('a', 'work');
    const b = await capture('b', 'build');
    const c = await capture('c', 'work');
    await patch(a.id, { status: 'later', scheduledDate: '2026-09-25' });
    await patch(b.id, { status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-22' });

    const all = await request(app).get('/api/exec/tasks');
    expect(all.body.data.map((t: { title: string }) => t.title)).toEqual(['c', 'b', 'a']);

    const inbox = await request(app).get('/api/exec/tasks?status=inbox');
    expect(inbox.body.data.map((t: { title: string }) => t.title)).toEqual(['c']);

    const build = await request(app).get('/api/exec/tasks?status=inbox,later,delegated&context=build');
    expect(build.body.data.map((t: { title: string }) => t.title)).toEqual(['b']);

    const week = await request(app).get('/api/exec/tasks?week=2026-09-20');
    expect(week.body.data.map((t: { title: string }) => t.title)).toEqual(['a']);

    const followUp = await request(app).get('/api/exec/tasks?followUpBy=2026-09-22');
    expect(followUp.body.data.map((t: { title: string }) => t.title)).toEqual(['b']);
    expect(c.id).toBeTruthy();
  });

  it('rejects an unknown status and an unknown query key', async () => {
    const status = await request(app).get('/api/exec/tasks?status=someday');
    expect(status.status).toBe(400);
    expect(status.body.code).toBe('VALIDATION');
    const key = await request(app).get('/api/exec/tasks?page=2');
    expect(key.status).toBe(400);
  });
});

describe('PATCH /api/exec/tasks/:id', () => {
  it('processes a capture and stamps processedAt', async () => {
    const task = await capture('x');
    const res = await patch(task.id, { status: 'this_week' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'this_week' });
    expect(res.body.data.processedAt).toMatch(ISO);
  });

  it('answers 404 for an unknown task and 400 for an empty patch', async () => {
    expect((await patch('does-not-exist', { status: 'later' })).body).toEqual({ success: false, error: 'no such task', code: 'NOT_FOUND' });
    const empty = await patch((await capture('x')).id, {});
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('VALIDATION');
  });

  it('refuses a hand-off without an owner', async () => {
    const res = await patch((await capture('x')).id, { status: 'waiting' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'ownerName is required when a task is delegated or waiting', code: 'VALIDATION' });
  });

  it('answers 400 CONSTRAINT when a project does not exist', async () => {
    const res = await patch((await capture('x')).id, { projectId: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'constraint violation', code: 'CONSTRAINT' });
  });
});

describe('POST /api/exec/tasks/:id/roll', () => {
  it('moves the scheduled date and counts the roll', async () => {
    const task = await capture('x');
    const res = await request(app).post(`/api/exec/tasks/${task.id}/roll`).send({ date: '2026-09-23' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ scheduledDate: '2026-09-23', rollCount: 1 });
    expect(res.body.data.rolledAt).toMatch(ISO);
    expect((await request(app).post('/api/exec/tasks/missing/roll').send({ date: '2026-09-23' })).status).toBe(404);
    expect((await request(app).post(`/api/exec/tasks/${task.id}/roll`).send({ date: 'tomorrow' })).status).toBe(400);
  });
});

describe('DELETE /api/exec/tasks/:id', () => {
  it('deletes an inbox item, refuses a processed one and 404s an unknown one', async () => {
    const inbox = await capture('inbox');
    const later = await capture('later');
    await patch(later.id, { status: 'later' });
    const deleted = await request(app).delete(`/api/exec/tasks/${inbox.id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ success: true, data: { id: inbox.id } });
    const refused = await request(app).delete(`/api/exec/tasks/${later.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ success: false, error: 'only an inbox item can be deleted; kill it instead', code: 'DELETE_NOT_ALLOWED' });
    expect((await request(app).delete('/api/exec/tasks/missing')).status).toBe(404);
  });
});
```

Create `server/exec/__tests__/settings-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { settingsSchema } from '../../../src/shared/exec/schemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

describe('GET /api/exec/settings', () => {
  it('returns the seeded schedule with its JSON columns decoded', async () => {
    const res = await request(app).get('/api/exec/settings');
    expect(res.status).toBe(200);
    expect(settingsSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toMatchObject({
      timezone: 'Asia/Karachi',
      weekStartDay: 0,
      workDays: [1, 2, 3, 4, 5],
      officeStart: '08:15',
      officeEnd: '18:00',
      buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }, { weekday: 4, start: '06:30', minutes: 50 }, { weekday: 6, start: '09:00', minutes: 180 }],
    });
    expect(res.body.data).not.toHaveProperty('id');
  });
});

describe('GET /api/exec/projects', () => {
  it('is an empty list until Phase 3 creates projects', async () => {
    const res = await request(app).get('/api/exec/projects');
    expect(res.body).toEqual({ success: true, data: [] });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/tasks-routes.test.ts server/exec/__tests__/settings-routes.test.ts`
Expected: FAIL — every request answers 404 `NOT_FOUND` from the catch-all.

- [ ] **Step 3: Write the three routers**

Create `server/exec/routes/tasks.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { taskCreateSchema, taskPatchSchema, taskRollSchema, taskListQuerySchema } from '../../../src/shared/exec/schemas';
import { listTasks, createTask, patchTask, rollTask, deleteTask } from '../tasks/store';

/** Parses, calls the store, answers in the envelope. Every thrown error reaches execErrorHandler. */
export function tasksRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such task');

  router.get('/', (req, res) => {
    ok(res, listTasks(db, taskListQuerySchema.parse(req.query)));
  });

  router.post('/', (req, res) => {
    ok(res, createTask(db, taskCreateSchema.parse(req.body), clock()), 201);
  });

  router.patch('/:id', (req, res) => {
    const task = patchTask(db, req.params.id, taskPatchSchema.parse(req.body), clock());
    if (!task) throw notFound();
    ok(res, task);
  });

  router.post('/:id/roll', (req, res) => {
    const task = rollTask(db, req.params.id, taskRollSchema.parse(req.body).date, clock());
    if (!task) throw notFound();
    ok(res, task);
  });

  router.delete('/:id', (req, res) => {
    const result = deleteTask(db, req.params.id);
    if (result === 'missing') throw notFound();
    if (result === 'not_allowed') {
      throw new ApiError(409, 'DELETE_NOT_ALLOWED', 'only an inbox item can be deleted; kill it instead');
    }
    ok(res, { id: req.params.id });
  });

  return router;
}
```

Create `server/exec/routes/settings.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { settingsSchema } from '../../../src/shared/exec/schemas';

type SettingsRow = {
  timezone: string;
  week_start_day: number;
  work_days: string;
  deep_work_start: string;
  deep_work_minutes: number;
  shutdown_time: string;
  office_start: string;
  office_end: string;
  build_blocks: string;
};

/** Read-only in Phase 2; Phase 4 adds PUT. The row's two JSON columns are decoded here. */
export function settingsRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow | undefined;
    if (!row) throw new ApiError(500, 'INTERNAL', 'settings row is missing');
    const parsed = settingsSchema.safeParse({
      timezone: row.timezone,
      weekStartDay: row.week_start_day,
      workDays: JSON.parse(row.work_days),
      deepWorkStart: row.deep_work_start,
      deepWorkMinutes: row.deep_work_minutes,
      shutdownTime: row.shutdown_time,
      officeStart: row.office_start,
      officeEnd: row.office_end,
      buildBlocks: JSON.parse(row.build_blocks),
    });
    if (!parsed.success) throw new ApiError(500, 'INTERNAL', 'settings row is invalid');
    ok(res, parsed.data);
  });
  return router;
}
```

Create `server/exec/routes/projects.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok } from '../http';
import { rowToEntity, type FieldSpec } from '../../db/mappers';
import type { Project } from '../../../src/shared/exec/schemas';

const PLAIN: FieldSpec = { json: [], dates: [], bools: [] };

/** Read-only in Phase 2; Phase 3 adds creation and editing. */
export function projectsRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/', (_req, res) => {
    const rows = db.prepare('SELECT * FROM projects ORDER BY name').all() as Record<string, unknown>[];
    ok(res, rows.map((row) => rowToEntity<Project>(row, PLAIN)));
  });
  return router;
}
```

In `server/exec/router.ts`, add the imports:

```ts
import { tasksRouter } from './routes/tasks';
import { settingsRouter } from './routes/settings';
import { projectsRouter } from './routes/projects';
```

and mount them right after the `/health` route, before `options?.extend?.(router);`:

```ts
  router.use('/tasks', tasksRouter(db));
  router.use('/settings', settingsRouter(db));
  router.use('/projects', projectsRouter(db));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/tasks-routes.test.ts server/exec/__tests__/settings-routes.test.ts`
Expected: PASS — 9 tasks-routes tests, 2 settings/projects tests.

Run: `npx vitest run && npm run lint`
Expected: everything green (including Phase 1's `errors.test.ts`, whose unknown-path and body-parser cases still hold); lint clean.

- [ ] **Step 5: Commit**

```bash
git add server/exec/routes/tasks.ts server/exec/routes/settings.ts server/exec/routes/projects.ts server/exec/router.ts server/exec/__tests__/tasks-routes.test.ts server/exec/__tests__/settings-routes.test.ts
git commit -m "feat: serve the tasks resource plus read-only settings and projects under /api/exec"
```

---

### Task 6: Client hooks and test helpers

**Files:**
- Create: `src/api/query.ts`, `src/api/tasks.ts`, `src/api/settings.ts`, `src/api/projects.ts`, `src/test/fetch.ts`, `src/test/fixtures.ts`
- Modify: `src/api/client.test.ts` (append)
- Test: `src/api/query.test.ts`, `src/api/tasks.test.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError` (`src/api/client.ts`); `createQueryClient`; Task 3's schemas and types.
- Produces:
  - `query.ts`: `toQueryString(params: Record<string, string | readonly string[] | undefined>): string` (`''` when nothing is set, else `?k=v&…`, values URI-encoded, arrays joined by `,`)
  - `tasks.ts`: `tasksKey`, `type TaskFilters = { status?: TaskStatus[]; context?: Context; week?: string; followUpBy?: string }`, `taskListPath(filters)`, `useTasks(filters?)`, `type CaptureInput = { title: string; context: Context; notes?: string }`, `useCaptureTask()`, `useUpdateTask()` (variables `{ id, patch: TaskPatch }`), `useRollTask()` (variables `{ id, date }`), `useDeleteTask()` (variables `id`) — every mutation invalidates `tasksKey` on success
  - `settings.ts`: `settingsKey`, `useSettings()`; `projects.ts`: `projectsKey`, `useProjects()`
  - `src/test/fetch.ts`: `stubFetch(handler)` returning the recorded `FetchCall[]`, `json(data, status?)`, `failure(status, code, error)`
  - `src/test/fixtures.ts`: `SETTINGS`, `makeTask(overrides?)`

- [ ] **Step 1: Write the test helpers**

Create `src/test/fetch.ts`:

```ts
import { vi } from 'vitest';

export type FetchCall = { url: string; method: string; body?: unknown };

/** Stubs global fetch; `handler` answers each call and every call is recorded for assertions. */
export function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      return handler(url, init);
    })
  );
  return calls;
}

const headers = { 'content-type': 'application/json' };

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify({ success: true, data }), { status, headers });

export const failure = (status: number, code: string, error: string): Response =>
  new Response(JSON.stringify({ success: false, error, code }), { status, headers });
```

Create `src/test/fixtures.ts`:

```ts
import type { Settings, Task } from '../shared/exec/schemas';

export const SETTINGS: Settings = {
  timezone: 'Asia/Karachi',
  weekStartDay: 0,
  workDays: [1, 2, 3, 4, 5],
  deepWorkStart: '08:35',
  deepWorkMinutes: 90,
  shutdownTime: '17:00',
  officeStart: '08:15',
  officeEnd: '18:00',
  buildBlocks: [
    { weekday: 2, start: '06:30', minutes: 50 },
    { weekday: 4, start: '06:30', minutes: 50 },
    { weekday: 6, start: '09:00', minutes: 180 },
  ],
};

let counter = 0;

/** A captured task with every field set the way the server returns it. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1;
  const stamp = `2026-09-22T03:${String(counter).padStart(2, '0')}:00.000Z`;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    title: `Task ${counter}`,
    notes: '',
    context: 'work',
    status: 'inbox',
    projectId: null,
    outcomeId: null,
    mustShipId: null,
    scheduledDate: null,
    dueDate: null,
    ownerName: null,
    expectedOutput: null,
    followUpDate: null,
    rollCount: 0,
    rolledAt: null,
    capturedAt: stamp,
    processedAt: null,
    delegatedAt: null,
    closedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/api/query.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toQueryString } from './query';

describe('toQueryString', () => {
  it('is empty when nothing is set and skips undefined values', () => {
    expect(toQueryString({})).toBe('');
    expect(toQueryString({ status: undefined, context: undefined })).toBe('');
  });

  it('encodes values and joins arrays with commas', () => {
    expect(toQueryString({ status: ['inbox', 'later'], context: 'work' })).toBe('?status=inbox%2Clater&context=work');
    expect(toQueryString({ week: '2026-09-20' })).toBe('?week=2026-09-20');
    expect(toQueryString({ q: 'a b&c' })).toBe('?q=a%20b%26c');
  });
});
```

Create `src/api/tasks.test.tsx`:

```tsx
import { describe, it, expect, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useTasks, useCaptureTask, useUpdateTask, useDeleteTask, useRollTask, taskListPath } from './tasks';
import { useSettings } from './settings';
import { useProjects } from './projects';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeTask } from '../test/fixtures';
import { vi } from 'vitest';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('taskListPath', () => {
  it('builds the list path from filters', () => {
    expect(taskListPath({})).toBe('/tasks');
    expect(taskListPath({ status: ['inbox'], context: 'build' })).toBe('/tasks?status=inbox&context=build');
  });
});

describe('useTasks', () => {
  it('fetches the filtered list', async () => {
    const task = makeTask({ title: 'Call the supplier' });
    const calls = stubFetch(() => json([task]));
    const { result } = renderHook(() => useTasks({ status: ['inbox'] }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([task]);
    expect(calls[0]).toMatchObject({ url: '/api/exec/tasks?status=inbox', method: 'GET' });
  });
});

describe('mutations', () => {
  it('captures with a POST and refetches every tasks query', async () => {
    const calls = stubFetch((url, init) => (init?.method === 'POST' ? json(makeTask(), 201) : json([])));
    const { result } = renderHook(() => ({ list: useTasks({ status: ['inbox'] }), capture: useCaptureTask() }), { wrapper });
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(async () => {
      await result.current.capture.mutateAsync({ title: 'Call the supplier', context: 'work' });
    });
    await waitFor(() => expect(calls.filter((c) => c.method === 'GET')).toHaveLength(2));
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/tasks', body: { title: 'Call the supplier', context: 'work' } });
  });

  it('updates with PATCH, rolls with POST and deletes with DELETE', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'DELETE' ? json({ id: 't1' }) : json(makeTask())));
    const { result } = renderHook(() => ({ update: useUpdateTask(), roll: useRollTask(), remove: useDeleteTask() }), { wrapper });
    await act(async () => {
      await result.current.update.mutateAsync({ id: 't1', patch: { status: 'later' } });
      await result.current.roll.mutateAsync({ id: 't1', date: '2026-09-23' });
      await result.current.remove.mutateAsync('t1');
    });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['PATCH', '/api/exec/tasks/t1'],
      ['POST', '/api/exec/tasks/t1/roll'],
      ['DELETE', '/api/exec/tasks/t1'],
    ]);
    expect(calls[0].body).toEqual({ status: 'later' });
    expect(calls[1].body).toEqual({ date: '2026-09-23' });
  });
});

describe('useSettings and useProjects', () => {
  it('fetch their resources', async () => {
    const calls = stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : json([])));
    const { result } = renderHook(() => ({ settings: useSettings(), projects: useProjects() }), { wrapper });
    await waitFor(() => expect(result.current.settings.isSuccess && result.current.projects.isSuccess).toBe(true));
    expect(result.current.settings.data).toEqual(SETTINGS);
    expect(result.current.projects.data).toEqual([]);
    expect(calls.map((c) => c.url).sort()).toEqual(['/api/exec/projects', '/api/exec/settings']);
  });
});
```

Append to `src/api/client.test.ts`, inside the existing `describe('api', …)` block:

```ts
  it('sends PATCH and PUT with JSON bodies and DELETE without one', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ success: true, data: { id: 't1' } }));
    vi.stubGlobal('fetch', fetchMock);
    await api.patch('/tasks/t1', { status: 'later' });
    await api.put('/settings', { timezone: 'Asia/Karachi' });
    await api.delete('/tasks/t1');
    const calls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    expect(calls.map(([, init]) => init.method)).toEqual(['PATCH', 'PUT', 'DELETE']);
    expect(calls[0][1].body).toBe(JSON.stringify({ status: 'later' }));
    expect(calls[2][1].body).toBeUndefined();
    expect(new Headers(calls[2][1].headers).get('content-type')).toBeNull();
  });

  it('rejects a failure envelope even when the HTTP status is 200', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ success: false, error: 'no such task', code: 'NOT_FOUND' }, 200)));
    const error = await api.get('/tasks/t1').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 200, code: 'NOT_FOUND', message: 'no such task' });
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project jsdom`
Expected: FAIL — `./query`, `./tasks`, `./settings`, `./projects` cannot be resolved; the two new client tests pass already (they exercise existing code) — that is fine, they document the contract.

- [ ] **Step 4: Write the hooks**

Create `src/api/query.ts`:

```ts
/** `?k=v&…` from a flat record; undefined values are skipped and arrays join with commas. */
export function toQueryString(params: Record<string, string | readonly string[] | undefined>): string {
  const pairs = Object.entries(params)
    .filter((entry): entry is [string, string | readonly string[]] => entry[1] !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(Array.isArray(value) ? value.join(',') : String(value))}`);
  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}
```

Create `src/api/tasks.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Context, Task, TaskPatch, TaskStatus } from '../shared/exec/schemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';

export const tasksKey = ['exec', 'tasks'] as const;

export type TaskFilters = { status?: TaskStatus[]; context?: Context; week?: string; followUpBy?: string };
export type CaptureInput = { title: string; context: Context; notes?: string };

export const taskListPath = (filters: TaskFilters): string =>
  `/tasks${toQueryString({ status: filters.status, context: filters.context, week: filters.week, followUpBy: filters.followUpBy })}`;

export function useTasks(filters: TaskFilters = {}) {
  return useQuery<Task[], ApiError>({ queryKey: [...tasksKey, filters], queryFn: () => api.get<Task[]>(taskListPath(filters)) });
}

/** Every write invalidates every tasks query, so lists refresh without bookkeeping. */
function useTasksMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: tasksKey }),
  });
}

export const useCaptureTask = () => useTasksMutation((input: CaptureInput) => api.post<Task>('/tasks', input));

export const useUpdateTask = () =>
  useTasksMutation(({ id, patch }: { id: string; patch: TaskPatch }) => api.patch<Task>(`/tasks/${id}`, patch));

export const useRollTask = () =>
  useTasksMutation(({ id, date }: { id: string; date: string }) => api.post<Task>(`/tasks/${id}/roll`, { date }));

export const useDeleteTask = () => useTasksMutation((id: string) => api.delete<{ id: string }>(`/tasks/${id}`));
```

Create `src/api/settings.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { Settings } from '../shared/exec/schemas';
import { api, ApiError } from './client';

export const settingsKey = ['exec', 'settings'] as const;

export function useSettings() {
  return useQuery<Settings, ApiError>({ queryKey: settingsKey, queryFn: () => api.get<Settings>('/settings') });
}
```

Create `src/api/projects.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { Project } from '../shared/exec/schemas';
import { api, ApiError } from './client';

export const projectsKey = ['exec', 'projects'] as const;

export function useProjects() {
  return useQuery<Project[], ApiError>({ queryKey: projectsKey, queryFn: () => api.get<Project[]>('/projects') });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project jsdom`
Expected: PASS — 2 query tests, 5 tasks-hook tests, 7 client tests, plus Phase 1's.

Run: `npx vitest run && npm run lint`
Expected: everything green; lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/api/query.ts src/api/tasks.ts src/api/settings.ts src/api/projects.ts src/test/fetch.ts src/test/fixtures.ts src/api/query.test.ts src/api/tasks.test.tsx src/api/client.test.ts
git commit -m "feat: add the tasks, settings and projects hooks with fetch test helpers"
```

---

### Task 7: Toast, capture bar, the `c` key, Today's pinned capture and the shell polish

**Files:**
- Create: `src/components/Toast.tsx`, `src/components/ContextToggle.tsx`, `src/components/CaptureBar.tsx`, `src/components/CaptureDialog.tsx`, `src/components/CaptureShortcut.tsx`, `src/lib/useCaptureKey.ts`, `src/screens/NotFound.tsx`
- Modify: `src/app/AppProviders.tsx`, `src/app/Shell.tsx`, `src/app/FullScreen.tsx`, `src/app/routes.tsx`, `src/screens/Today.tsx`, `src/styles/app.css`, `src/test/render.tsx`
- Test: `src/components/Toast.test.tsx`, `src/components/CaptureBar.test.tsx`, `src/components/CaptureShortcut.test.tsx`, `src/app/App.test.tsx` (append)

**Interfaces:**
- Consumes: `useCaptureTask`, `useSettings` (Task 6); `defaultContext` (Task 3); `stubFetch`, `json`, `failure`, `SETTINGS`, `makeTask` (Task 6 helpers); `ApiStatus`, `ScreenShell`, `routes` (Phase 1).
- Produces:
  - `Toast.tsx`: `ToastProvider`, `useToast(): { show(message: string): void }` — each toast is a `<p role="status">`, gone after 4 s; the container itself has no role.
  - `ContextToggle.tsx`: `ContextToggle({ value, onChange })` — two `aria-pressed` buttons, "Work" and "Build".
  - `CaptureBar.tsx`: `CaptureBar({ inputId = 'capture-input', autoFocus?, large?, onCaptured? })` — a form labelled "Capture" with a textbox labelled "Capture", the toggle, and a "Capture" submit; posts `{ title, context }`, clears, toasts `Captured. It is in the Inbox, not on Today.`
  - `CaptureDialog.tsx`: `CaptureDialog({ open, onClose })` — `role="dialog"` labelled "Capture" wrapping an auto-focused `CaptureBar`; closes on Escape, backdrop click or a successful capture.
  - `useCaptureKey.ts`: `useCaptureKey(onTrigger: () => void)` — a window keydown listener for a bare `c` outside editable elements.
  - `CaptureShortcut.tsx`: `CaptureShortcut()` — wires the key: focuses `#capture-input` when present, else opens the dialog. Rendered by both layouts.
  - `NotFound.tsx`: heading "Nothing here" and a link "Back to Today".
  - `routes.tsx`: `{ path: '*', element: <NotFound /> }` as the last child of the Shell route.
  - `render.tsx`: `renderWithProviders` now also wraps `ToastProvider`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/Toast.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ToastProvider, useToast } from './Toast';

function Trigger() {
  const toast = useToast();
  return <button onClick={() => toast.show('Captured. It is in the Inbox, not on Today.')}>go</button>;
}

afterEach(() => vi.useRealTimers());

describe('ToastProvider', () => {
  it('shows a message as a status and removes it after four seconds', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    expect(screen.queryByRole('status')).toBeNull();
    act(() => screen.getByText('go').click());
    expect(screen.getByRole('status')).toHaveTextContent('Captured. It is in the Inbox, not on Today.');
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
```

Create `src/components/CaptureBar.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CaptureBar } from './CaptureBar';
import { renderWithProviders } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeTask } from '../test/fixtures';

const settingsOr = (respond: (init?: RequestInit) => Response) => (url: string, init?: RequestInit) =>
  url.endsWith('/settings') ? json(SETTINGS) : respond(init);

beforeEach(() => {
  // 19:00 in Karachi on a Tuesday: outside office hours, so the clock says "build".
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-22T14:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('CaptureBar', () => {
  it('posts the trimmed title with the context the clock suggests, clears, and toasts', async () => {
    const calls = stubFetch(settingsOr(() => json(makeTask(), 201)));
    renderWithProviders(<CaptureBar />);
    const input = screen.getByRole('textbox', { name: 'Capture' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Build' })).toHaveAttribute('aria-pressed', 'true'));
    await userEvent.type(input, '  Call the supplier  {enter}');
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeDefined());
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/tasks', body: { title: 'Call the supplier', context: 'build' } });
    await waitFor(() => expect(input).toHaveValue(''));
    expect(await screen.findByRole('status')).toHaveTextContent('Captured. It is in the Inbox, not on Today.');
  });

  it('lets the toggle override the clock', async () => {
    const calls = stubFetch(settingsOr(() => json(makeTask(), 201)));
    renderWithProviders(<CaptureBar />);
    await userEvent.click(screen.getByRole('button', { name: 'Work' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Capture' }), 'Approve pricing{enter}');
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Approve pricing', context: 'work' }));
  });

  it('does not submit a blank title and reports a server failure', async () => {
    const calls = stubFetch(settingsOr(() => failure(500, 'INTERNAL', 'internal server error')));
    renderWithProviders(<CaptureBar />);
    const input = screen.getByRole('textbox', { name: 'Capture' });
    expect(screen.getByRole('button', { name: 'Capture' })).toBeDisabled();
    await userEvent.type(input, '   {enter}');
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
    await userEvent.type(input, 'x{enter}');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not capture: internal server error');
    expect(input).toHaveValue('x');
  });
});
```

Create `src/components/CaptureShortcut.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const ok = () => stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : json([])));

describe('the c key', () => {
  it('opens the capture dialog on a screen without a capture bar', async () => {
    ok();
    renderRoute('/week');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.keyboard('c');
    const dialog = await screen.findByRole('dialog', { name: 'Capture' });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Capture' })).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it('focuses the pinned bar on Today instead of opening a dialog', async () => {
    ok();
    renderRoute('/');
    await userEvent.keyboard('c');
    expect(screen.getByRole('textbox', { name: 'Capture' })).toHaveFocus();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ignores c typed inside a text field', async () => {
    ok();
    renderRoute('/');
    const input = screen.getByRole('textbox', { name: 'Capture' });
    await userEvent.type(input, 'c');
    expect(input).toHaveValue('c');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
```

Append to `src/app/App.test.tsx`, inside `describe('the app shell', …)`:

```tsx
  it('shows a way back from an unknown URL, inside the shell', async () => {
    renderRoute('/nowhere');
    expect(await screen.findByRole('heading', { level: 1, name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('warns about an unreachable API on the full-screen capture page too', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    renderRoute('/capture');
    expect(await screen.findByText(/Local API not reachable/)).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project jsdom`
Expected: FAIL — `./Toast`, `./CaptureBar`, the dialog and the not-found route do not exist.

- [ ] **Step 3: Write the toast and the toggle**

Create `src/components/Toast.tsx`:

```tsx
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Toast = { id: number; message: string };
type ToastApi = { show: (message: string) => void };

const ToastContext = createContext<ToastApi>({ show: () => {} });
const DURATION_MS = 4000;

/** One quiet line at the bottom of the screen, gone after four seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const show = useCallback((message: string) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) => [...current, { id, message }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), DURATION_MS);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex flex-col items-center gap-2 md:bottom-6">
        {toasts.map((toast) => (
          <p key={toast.id} role="status" className="rounded-md bg-ink px-4 py-2 text-sm text-paper shadow dark:bg-paper dark:text-ink">
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
```

Create `src/components/ContextToggle.tsx`:

```tsx
import type { Context } from '../shared/exec/schemas';

type Props = { value: Context; onChange: (value: Context) => void };

const OPTIONS: { value: Context; label: string }[] = [
  { value: 'work', label: 'Work' },
  { value: 'build', label: 'Build' },
];

/** Work or Build. The two contexts never mix on screen (§16), so the choice is always visible. */
export function ContextToggle({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Context" className="inline-flex rounded-md border border-line p-0.5 dark:border-ink-muted">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1.5 text-sm ${option.value === value ? 'bg-ink text-paper dark:bg-paper dark:text-ink' : 'text-ink-muted'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write the capture bar, dialog and shortcut**

Create `src/components/CaptureBar.tsx`:

```tsx
import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useCaptureTask } from '../api/tasks';
import { useSettings } from '../api/settings';
import { defaultContext } from '../shared/exec/time';
import type { Context, Task } from '../shared/exec/schemas';
import { ContextToggle } from './ContextToggle';
import { useToast } from './Toast';

type Props = { inputId?: string; autoFocus?: boolean; large?: boolean; onCaptured?: (task: Task) => void };

export const CAPTURED_MESSAGE = 'Captured. It is in the Inbox, not on Today.';

/** Capture is not commitment: this only ever creates an inbox item (§10). */
export function CaptureBar({ inputId = 'capture-input', autoFocus = false, large = false, onCaptured }: Props) {
  const settings = useSettings();
  const capture = useCaptureTask();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [chosen, setChosen] = useState<Context | null>(null);

  // The toggle follows the clock until the user picks; Work in office hours, Build otherwise.
  const context: Context = chosen ?? (settings.data ? defaultContext(new Date(), settings.data) : 'work');
  const trimmed = title.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || capture.isPending) return;
    capture.mutate(
      { title: trimmed, context },
      {
        onSuccess: (task) => {
          setTitle('');
          toast.show(CAPTURED_MESSAGE);
          onCaptured?.(task);
        },
      }
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') event.currentTarget.blur();
  };

  return (
    <form onSubmit={submit} aria-label="Capture" className="space-y-2">
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          aria-label="Capture"
          autoFocus={autoFocus}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Capture anything. It goes to the Inbox."
          className={`min-w-0 flex-1 rounded-md border border-line bg-paper-raised px-3 ${large ? 'py-3 text-lg' : 'py-2'} dark:border-ink-muted dark:bg-ink`}
        />
        <button
          type="submit"
          disabled={!trimmed || capture.isPending}
          className={`rounded-md bg-ink text-paper disabled:opacity-40 dark:bg-paper dark:text-ink ${large ? 'px-5 py-3 text-lg' : 'px-4 py-2'}`}
        >
          Capture
        </button>
      </div>
      <ContextToggle value={context} onChange={setChosen} />
      {capture.isError && (
        <p role="alert" className="text-sm text-ink-muted">
          Could not capture: {capture.error.message}
        </p>
      )}
    </form>
  );
}
```

Create `src/lib/useCaptureKey.ts`:

```ts
import { useEffect } from 'react';

const isEditable = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

/** A bare `c` anywhere, except while typing, triggers capture (spec C "Keyboard"). */
export function useCaptureKey(onTrigger: () => void): void {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'c' || event.metaKey || event.ctrlKey || event.altKey || isEditable(event.target)) return;
      event.preventDefault();
      onTrigger();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onTrigger]);
}
```

Create `src/components/CaptureDialog.tsx`:

```tsx
import { useEffect } from 'react';
import { CaptureBar } from './CaptureBar';

type Props = { open: boolean; onClose: () => void };

/** The `c` key away from Today: one input in the middle of the screen, nothing else. */
export function CaptureDialog({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center bg-ink/40 p-4 pt-24" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Capture"
        className="w-full max-w-lg rounded-lg bg-paper p-4 shadow-lg dark:bg-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <CaptureBar inputId="capture-dialog-input" autoFocus onCaptured={onClose} />
      </div>
    </div>
  );
}
```

Create `src/components/CaptureShortcut.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { useCaptureKey } from '../lib/useCaptureKey';
import { CaptureDialog } from './CaptureDialog';

/** Rendered by both layouts: `c` focuses a pinned capture bar when one is on screen, else opens the dialog. */
export function CaptureShortcut() {
  const [open, setOpen] = useState(false);
  const trigger = useCallback(() => {
    const pinned = document.getElementById('capture-input');
    if (pinned instanceof HTMLInputElement) pinned.focus();
    else setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  useCaptureKey(trigger);
  return <CaptureDialog open={open} onClose={close} />;
}
```

- [ ] **Step 5: Wire the layouts, Today, the providers, the catch-all and the stylesheet**

Create `src/screens/NotFound.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';

export default function NotFound() {
  return (
    <ScreenShell title="Nothing here">
      <Link to="/" className="underline">
        Back to Today
      </Link>
    </ScreenShell>
  );
}
```

In `src/app/routes.tsx`, add `import NotFound from '../screens/NotFound';` and, as the last entry of the Shell route's `children` array (after the `review` child), add `{ path: '*', element: <NotFound /> },`.

Overwrite `src/app/Shell.tsx`'s component body so `main` renders the shortcut (the `NAV` and `linkClass` definitions stay as they are):

```tsx
import { NavLink, Outlet } from 'react-router-dom';
import { ApiStatus } from '../components/ApiStatus';
import { CaptureShortcut } from '../components/CaptureShortcut';
```

and inside `<main …>`, after `<ApiStatus />`, add `<CaptureShortcut />`.

Overwrite `src/app/FullScreen.tsx`:

```tsx
import { Outlet } from 'react-router-dom';
import { ApiStatus } from '../components/ApiStatus';
import { CaptureShortcut } from '../components/CaptureShortcut';

/** Flows that must show nothing but themselves: focus, shutdown, planning, capture. */
export function FullScreen() {
  return (
    <div className="min-h-screen space-y-4 px-4 py-6 md:px-10">
      <ApiStatus />
      <CaptureShortcut />
      <Outlet />
    </div>
  );
}
```

Overwrite `src/screens/Today.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { CaptureBar } from '../components/CaptureBar';

/** Phase 2: an empty day with capture pinned at the bottom. Phase 3 replaces the banner with the real check. */
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
      <div className="sticky bottom-20 pt-6 md:bottom-6">
        <CaptureBar />
      </div>
    </ScreenShell>
  );
}
```

Overwrite `src/app/AppProviders.tsx`:

```tsx
import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../../utils/ThemeContext';
import { createQueryClient } from '../api/queryClient';
import { ToastProvider } from '../components/Toast';

export function AppProviders({ children }: { children: ReactNode }) {
  const [client] = useState(() => createQueryClient());
  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
```

In `src/test/render.tsx`, add `import { ToastProvider } from '../components/Toast';` and change `renderWithProviders` to wrap the client provider's children in `<ToastProvider>{ui}</ToastProvider>`.

In `src/styles/app.css`: delete the three lines `--color-sidebar: #202123;`, `--color-accent-pink: #ec4899;` and `--color-focus: #2563eb;` (nothing references them), and replace the `@layer base` block with:

```css
@layer base {
  html {
    color-scheme: light;
  }
  html.dark {
    color-scheme: dark;
  }
  body {
    @apply bg-paper text-ink antialiased dark:bg-ink dark:text-paper;
  }
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project jsdom`
Expected: PASS — 1 toast, 3 capture bar, 3 shortcut, 12 App tests, plus the rest. If the shortcut test's dialog focus assertion is flaky under jsdom, wrap it in `waitFor` as written; do not remove it.

Run: `npx vitest run && npm run lint && npm run build`
Expected: everything green; lint clean; build clean. Then `npm run server` and `npm run dev`: on Today, type into the pinned bar and press Enter — the toast appears and the input clears; press `c` on `/week` — the dialog opens with focus in the input; open `/nowhere` — "Nothing here" with the rail; switch the OS to dark mode with the app in light — scrollbars stay light.

- [ ] **Step 7: Commit**

```bash
git add src/components/Toast.tsx src/components/ContextToggle.tsx src/components/CaptureBar.tsx src/components/CaptureDialog.tsx src/components/CaptureShortcut.tsx src/lib/useCaptureKey.ts src/screens/NotFound.tsx src/app/AppProviders.tsx src/app/Shell.tsx src/app/FullScreen.tsx src/app/routes.tsx src/screens/Today.tsx src/styles/app.css src/test/render.tsx src/components/Toast.test.tsx src/components/CaptureBar.test.tsx src/components/CaptureShortcut.test.tsx src/app/App.test.tsx
git commit -m "feat: capture from Today and the c key, with a toast, a not-found route and the shell polish"
```

---

### Task 8: The phone capture page and its manifest

**Files:**
- Create: `public/manifest.webmanifest`, `public/icon.svg`
- Modify: `src/screens/Capture.tsx`, `index.html`
- Test: `src/screens/Capture.test.tsx`

**Interfaces:**
- Consumes: `CaptureBar` (Task 7), `useTasks` (Task 6).
- Produces: `/capture` renders the heading, a large auto-focused capture bar, "N in inbox" and the five most recent captures; `GET /manifest.webmanifest` and `GET /icon.svg` are served by Vite from `public/`.

- [ ] **Step 1: Write the failing test**

Create `src/screens/Capture.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeTask } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('/capture', () => {
  it('shows the inbox count and the five most recent captures, newest first', async () => {
    const tasks = [6, 5, 4, 3, 2, 1].map((n) => makeTask({ title: `Item ${n}` }));
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : json(tasks)));
    renderRoute('/capture');
    expect(await screen.findByText('6 in inbox')).toBeInTheDocument();
    const recent = screen.getByRole('list', { name: 'Recent captures' });
    expect(within(recent).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Item 6work',
      'Item 5work',
      'Item 4work',
      'Item 3work',
      'Item 2work',
    ]);
    expect(screen.getByRole('textbox', { name: 'Capture' })).toHaveFocus();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/screens/Capture.test.tsx`
Expected: FAIL — "6 in inbox" is not rendered.

- [ ] **Step 3: Write the page, the manifest and the icon**

Overwrite `src/screens/Capture.tsx`:

```tsx
import { useTasks } from '../api/tasks';
import { CaptureBar } from '../components/CaptureBar';

/** The phone page (§10, spec C "Capture"): one field, the count, the last five. Nothing else. */
export default function Capture() {
  const inbox = useTasks({ status: ['inbox'] });
  const count = inbox.data?.length ?? 0;
  const recent = (inbox.data ?? []).slice(0, 5);
  return (
    <section className="mx-auto max-w-md space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Capture</h1>
      <CaptureBar autoFocus large />
      <p className="text-ink-muted" aria-live="polite">
        {count} in inbox
      </p>
      <ul aria-label="Recent captures" className="space-y-1">
        {recent.map((task) => (
          <li key={task.id} className="flex justify-between gap-3 border-t border-line py-2 text-sm dark:border-ink-muted">
            <span>{task.title}</span>
            <span className="text-ink-muted">{task.context}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `public/manifest.webmanifest`:

```json
{
  "name": "Capture",
  "short_name": "Capture",
  "start_url": "/capture",
  "display": "standalone",
  "background_color": "#fafaf9",
  "theme_color": "#16181d",
  "icons": [{ "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml" }]
}
```

Create `public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#16181d"/>
  <path d="M32 18v28M18 32h28" stroke="#fafaf9" stroke-width="6" stroke-linecap="round"/>
</svg>
```

In `index.html`, inside `<head>` after the `<title>` line, add:

```html
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#16181d" />
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/screens/Capture.test.tsx`
Expected: PASS.

Run: `npx vitest run && npm run lint && npm run build`
Expected: everything green; the build copies `manifest.webmanifest` and `icon.svg` into `dist/`.

Then with `npm run server` and `npm run dev` running, `curl -s http://127.0.0.1:3001/manifest.webmanifest | head -3` (the port Vite printed) shows the JSON.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Capture.tsx src/screens/Capture.test.tsx public/manifest.webmanifest public/icon.svg index.html
git commit -m "feat: add the phone capture page with a home-screen manifest"
```

---

### Task 9: The Inbox screen with keyboard-first processing

**Files:**
- Create: `src/lib/keys.ts`, `src/lib/relativeTime.ts`, `src/lib/inboxRules.ts`, `src/components/inbox/useInboxKeys.ts`, `src/components/inbox/InboxRow.tsx`, `src/components/inbox/RowActions.tsx`, `src/components/inbox/InboxList.tsx`, `src/components/inbox/DelegatePanel.tsx`, `src/components/inbox/SchedulePanel.tsx`, `src/components/inbox/ProjectPicker.tsx`
- Modify: `src/lib/useCaptureKey.ts` (use `keys.ts`), `src/screens/Inbox.tsx`
- Test: `src/lib/relativeTime.test.ts`, `src/lib/inboxRules.test.ts`, `src/screens/Inbox.test.tsx`

**Interfaces:**
- Consumes: `useTasks`, `useUpdateTask`, `useDeleteTask`, `useSettings`, `useProjects` (Task 6); `useToast` (Task 7); `localClock`, `weekStartOf`, `weekEndOf`, `addDays`, `compareDates`, `toCalendarDate` (Task 3); the test helpers.
- Produces:
  - `keys.ts`: `isEditableTarget(target: EventTarget | null): boolean`
  - `relativeTime.ts`: `relativeTime(iso: string, now: Date): string` — `just now`, `N min ago`, `N h ago`, `N d ago`
  - `inboxRules.ts`: `tomorrowFrom(today: string): string`, `scheduleStatus(date, today, weekStartDay): TaskStatus` (`this_week` inside the current planning week, else `later`)
  - `useInboxKeys.ts`: `type InboxAction = 'this_week' | 'later' | 'delegate' | 'schedule' | 'project' | 'delete'`, `KEY_ACTIONS` (`t l d s p x`), `useInboxKeys(count, onAction, enabled): { selected, setSelected }` — `ArrowDown`/`j` and `ArrowUp`/`k` move the selection
  - `InboxRow`, `RowActions` (six buttons "This week (T)", "Later (L)", "Delegate (D)", "Schedule (S)", "Project (P)", "Delete (X)"), `InboxList` (`role="listbox"` labelled "Inbox" or "Later"), `DelegatePanel`, `SchedulePanel`, `ProjectPicker`
  - `Inbox` screen: tabs "Inbox" / "Later" (`role="tab"`), counter "N to process" / "N parked", empty states "Inbox zero." / "Nothing parked for later."

- [ ] **Step 1: Write the failing pure-function tests**

Create `src/lib/relativeTime.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { relativeTime } from './relativeTime';

const now = new Date('2026-09-22T10:00:00Z');

describe('relativeTime', () => {
  it.each([
    ['2026-09-22T09:59:30Z', 'just now'],
    ['2026-09-22T09:55:00Z', '5 min ago'],
    ['2026-09-22T08:00:00Z', '2 h ago'],
    ['2026-09-19T10:00:00Z', '3 d ago'],
    ['2026-09-22T10:00:05Z', 'just now'],
  ])('%s → %s', (iso, expected) => {
    expect(relativeTime(iso, now)).toBe(expected);
  });
});
```

Create `src/lib/inboxRules.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scheduleStatus, tomorrowFrom } from './inboxRules';

describe('inbox rules', () => {
  it('commits a date inside the current week and parks anything later', () => {
    // Today is Tuesday 22 Sep 2026; the Sunday-start week runs 20–26 Sep.
    expect(scheduleStatus('2026-09-25', '2026-09-22', 0)).toBe('this_week');
    expect(scheduleStatus('2026-09-26', '2026-09-22', 0)).toBe('this_week');
    expect(scheduleStatus('2026-09-27', '2026-09-22', 0)).toBe('later');
    expect(scheduleStatus('2026-09-21', '2026-09-22', 1)).toBe('this_week'); // Monday-start week: 21–27
    expect(scheduleStatus('2026-09-20', '2026-09-22', 1)).toBe('later');
  });

  it('defaults follow-ups and schedules to tomorrow', () => {
    expect(tomorrowFrom('2026-09-30')).toBe('2026-10-01');
  });
});
```

- [ ] **Step 2: Write the failing screen test**

Create `src/screens/Inbox.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
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

  it('the row buttons do what the keys do', async () => {
    const api = fakeApi([makeTask({ title: 'Click me' })]);
    renderRoute('/inbox');
    await screen.findByText('1 to process');
    await userEvent.click(screen.getByRole('button', { name: 'This week (T)' }));
    await waitFor(() => expect(patches(api.calls)[0]?.body).toEqual({ status: 'this_week' }));
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/lib/relativeTime.test.ts src/lib/inboxRules.test.ts src/screens/Inbox.test.tsx`
Expected: FAIL — the two lib modules cannot be resolved; the screen still says "Arrives in Phase 2."

- [ ] **Step 4: Write the pure helpers and share the editable-target check**

Create `src/lib/keys.ts`:

```ts
/** True when a key event came from somewhere the user is typing. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
```

In `src/lib/useCaptureKey.ts`, delete the local `isEditable` function and its use; add `import { isEditableTarget } from './keys';` and call `isEditableTarget(event.target)` in its place.

Create `src/lib/relativeTime.ts`:

```ts
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "just now", "5 min ago", "2 h ago", "3 d ago" — enough for an inbox row. */
export function relativeTime(iso: string, now: Date): string {
  const elapsed = now.getTime() - new Date(iso).getTime();
  if (elapsed < MINUTE) return 'just now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} min ago`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} h ago`;
  return `${Math.floor(elapsed / DAY)} d ago`;
}
```

Create `src/lib/inboxRules.ts`:

```ts
import { addDays, compareDates } from '../shared/exec/dates';
import type { TaskStatus } from '../shared/exec/schemas';
import { weekEndOf, weekStartOf } from '../shared/exec/time';

export const tomorrowFrom = (today: string): string => addDays(today, 1);

/** A date inside the current planning week is a commitment to this week; anything later is parked. */
export function scheduleStatus(date: string, today: string, weekStartDay: number): TaskStatus {
  const inWeek =
    compareDates(date, weekStartOf(today, weekStartDay)) >= 0 && compareDates(date, weekEndOf(today, weekStartDay)) <= 0;
  return inWeek ? 'this_week' : 'later';
}
```

- [ ] **Step 5: Write the keyboard hook and the list pieces**

Create `src/components/inbox/useInboxKeys.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { isEditableTarget } from '../../lib/keys';

export type InboxAction = 'this_week' | 'later' | 'delegate' | 'schedule' | 'project' | 'delete';

export const KEY_ACTIONS: Record<string, InboxAction> = {
  t: 'this_week',
  l: 'later',
  d: 'delegate',
  s: 'schedule',
  p: 'project',
  x: 'delete',
};

const clamp = (index: number, count: number) => Math.min(Math.max(index, 0), Math.max(count - 1, 0));

/** Selection plus the six processing keys (spec C "Inbox"). Disabled while a panel has the keyboard. */
export function useInboxKeys(count: number, onAction: (action: InboxAction, index: number) => void, enabled: boolean) {
  const [selected, setSelected] = useState(0);
  const selectedRef = useRef(0);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    setSelected((current) => clamp(current, count));
  }, [count]);

  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return;
      if (event.key === 'ArrowDown' || event.key === 'j') {
        event.preventDefault();
        setSelected((current) => clamp(current + 1, count));
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'k') {
        event.preventDefault();
        setSelected((current) => clamp(current - 1, count));
        return;
      }
      const action = KEY_ACTIONS[event.key];
      if (action && count > 0) {
        event.preventDefault();
        onAction(action, selectedRef.current);
      }
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [count, enabled, onAction]);

  return { selected, setSelected };
}
```

Create `src/components/inbox/RowActions.tsx`:

```tsx
import type { InboxAction } from './useInboxKeys';

type Props = { onAction: (action: InboxAction) => void; parked: boolean };

const ACTIONS: { action: InboxAction; label: string; inboxOnly: boolean }[] = [
  { action: 'this_week', label: 'This week (T)', inboxOnly: false },
  { action: 'later', label: 'Later (L)', inboxOnly: true },
  { action: 'delegate', label: 'Delegate (D)', inboxOnly: false },
  { action: 'schedule', label: 'Schedule (S)', inboxOnly: false },
  { action: 'project', label: 'Project (P)', inboxOnly: false },
  { action: 'delete', label: 'Delete (X)', inboxOnly: true },
];

/** The same six actions as the keys, for the mouse and the phone. */
export function RowActions({ onAction, parked }: Props) {
  return (
    <div className="flex flex-wrap gap-1 pt-2">
      {ACTIONS.map(({ action, label, inboxOnly }) => (
        <button
          key={action}
          type="button"
          disabled={parked && inboxOnly}
          onClick={(event) => {
            event.stopPropagation();
            onAction(action);
          }}
          className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-40 dark:border-ink-muted dark:hover:text-paper"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
```

Create `src/components/inbox/InboxRow.tsx`:

```tsx
import type { Task } from '../../shared/exec/schemas';
import { relativeTime } from '../../lib/relativeTime';
import { RowActions } from './RowActions';
import type { InboxAction } from './useInboxKeys';

type Props = { task: Task; selected: boolean; parked: boolean; now: Date; onSelect: () => void; onAction: (action: InboxAction) => void };

export function InboxRow({ task, selected, parked, now, onSelect, onAction }: Props) {
  return (
    <li
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`cursor-default rounded-md border px-3 py-2 ${selected ? 'border-ink bg-paper-raised dark:border-paper dark:bg-ink' : 'border-transparent'}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{task.title}</span>
        <span className="shrink-0 text-xs text-ink-muted">
          {task.context} · {relativeTime(task.capturedAt, now)}
        </span>
      </div>
      {selected && <RowActions onAction={onAction} parked={parked} />}
    </li>
  );
}
```

Create `src/components/inbox/InboxList.tsx`:

```tsx
import type { Task } from '../../shared/exec/schemas';
import { InboxRow } from './InboxRow';
import type { InboxAction } from './useInboxKeys';

type Props = {
  label: 'Inbox' | 'Later';
  tasks: Task[];
  selected: number;
  now: Date;
  emptyText: string;
  onSelect: (index: number) => void;
  onAction: (action: InboxAction, index: number) => void;
};

export function InboxList({ label, tasks, selected, now, emptyText, onSelect, onAction }: Props) {
  if (tasks.length === 0) return <p className="text-ink-muted">{emptyText}</p>;
  return (
    <ul role="listbox" aria-label={label} className="space-y-1">
      {tasks.map((task, index) => (
        <InboxRow
          key={task.id}
          task={task}
          selected={index === selected}
          parked={label === 'Later'}
          now={now}
          onSelect={() => onSelect(index)}
          onAction={(action) => onAction(action, index)}
        />
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: Write the three panels**

Create `src/components/inbox/DelegatePanel.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import type { Task } from '../../shared/exec/schemas';

export type DelegateFields = { ownerName: string; expectedOutput: string | null; followUpDate: string };
type Props = { task: Task; defaultFollowUp: string; onSubmit: (fields: DelegateFields) => void; onCancel: () => void };

/** Owner, expected output, follow-up date (§11). Owner is the one required field. */
export function DelegatePanel({ task, defaultFollowUp, onSubmit, onCancel }: Props) {
  const [ownerName, setOwnerName] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [followUpDate, setFollowUpDate] = useState(defaultFollowUp);
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const owner = ownerName.trim();
    if (!owner) {
      setError('Owner is required');
      return;
    }
    onSubmit({ ownerName: owner, expectedOutput: expectedOutput.trim() || null, followUpDate });
  };

  return (
    <form aria-label={`Delegate ${task.title}`} onSubmit={submit} className="space-y-3 rounded-md border border-line p-4 dark:border-ink-muted">
      <label className="block text-sm" htmlFor="delegate-owner">Owner</label>
      <input id="delegate-owner" autoFocus value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="w-full rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink" />
      <label className="block text-sm" htmlFor="delegate-output">Expected output</label>
      <input id="delegate-output" value={expectedOutput} onChange={(e) => setExpectedOutput(e.target.value)} className="w-full rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink" />
      <label className="block text-sm" htmlFor="delegate-follow-up">Follow up on</label>
      <input id="delegate-follow-up" type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink" />
      {error && <p role="alert" className="text-sm text-ink-muted">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Delegate</button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
      </div>
    </form>
  );
}
```

Create `src/components/inbox/SchedulePanel.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import type { Task } from '../../shared/exec/schemas';

type Props = { task: Task; defaultDate: string; onSubmit: (date: string) => void; onCancel: () => void };

export function SchedulePanel({ task, defaultDate, onSubmit, onCancel }: Props) {
  const [date, setDate] = useState(defaultDate);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (date) onSubmit(date);
  };
  return (
    <form aria-label={`Schedule ${task.title}`} onSubmit={submit} className="space-y-3 rounded-md border border-line p-4 dark:border-ink-muted">
      <label className="block text-sm" htmlFor="schedule-date">On</label>
      <input id="schedule-date" type="date" autoFocus value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink" />
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Schedule</button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
      </div>
    </form>
  );
}
```

Create `src/components/inbox/ProjectPicker.tsx`:

```tsx
import { useProjects } from '../../api/projects';
import type { Task } from '../../shared/exec/schemas';

type Props = { task: Task; onPick: (projectId: string) => void; onCancel: () => void };

export function ProjectPicker({ task, onPick, onCancel }: Props) {
  const projects = useProjects();
  const list = projects.data ?? [];
  return (
    <div role="group" aria-label={`Project for ${task.title}`} className="space-y-3 rounded-md border border-line p-4 dark:border-ink-muted">
      {list.length === 0 ? (
        <p className="text-ink-muted">No projects yet. Projects arrive in Phase 3.</p>
      ) : (
        <ul className="space-y-1">
          {list.map((project) => (
            <li key={project.id}>
              <button type="button" onClick={() => onPick(project.id)} className="w-full rounded border border-line px-3 py-2 text-left hover:border-ink dark:border-ink-muted">
                {project.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
    </div>
  );
}
```

- [ ] **Step 7: Write the screen**

Overwrite `src/screens/Inbox.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { useDeleteTask, useTasks, useUpdateTask } from '../api/tasks';
import { useSettings } from '../api/settings';
import { useToast } from '../components/Toast';
import { InboxList } from '../components/inbox/InboxList';
import { DelegatePanel } from '../components/inbox/DelegatePanel';
import { SchedulePanel } from '../components/inbox/SchedulePanel';
import { ProjectPicker } from '../components/inbox/ProjectPicker';
import { useInboxKeys, type InboxAction } from '../components/inbox/useInboxKeys';
import { scheduleStatus, tomorrowFrom } from '../lib/inboxRules';
import { toCalendarDate } from '../shared/exec/dates';
import { localClock } from '../shared/exec/time';
import type { Task } from '../shared/exec/schemas';

type Tab = 'inbox' | 'later';
type Panel = { kind: 'delegate' | 'schedule' | 'project'; task: Task } | null;

const TABS: { id: Tab; label: 'Inbox' | 'Later' }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'later', label: 'Later' },
];

/** Everything captured but not decided about (§10). Keyboard first; the row buttons mirror the keys. */
export default function Inbox() {
  const [tab, setTab] = useState<Tab>('inbox');
  const [panel, setPanel] = useState<Panel>(null);
  const tasks = useTasks({ status: [tab] });
  const settings = useSettings();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const toast = useToast();

  const items = tasks.data ?? [];
  const now = new Date();
  const today = settings.data ? localClock(now, settings.data.timezone).date : toCalendarDate(now);
  const weekStartDay = settings.data?.weekStartDay ?? 0;
  const parked = tab === 'later';

  const act = useCallback(
    (action: InboxAction, index: number) => {
      const task = items[index];
      if (!task) return;
      if (action === 'this_week') update.mutate({ id: task.id, patch: { status: 'this_week' } });
      else if (action === 'later' && !parked) update.mutate({ id: task.id, patch: { status: 'later' } });
      else if (action === 'delete') {
        if (parked) toast.show('Only an inbox item can be deleted.');
        else remove.mutate(task.id);
      } else if (action === 'delegate' || action === 'schedule' || action === 'project') setPanel({ kind: action, task });
    },
    [items, parked, update, remove, toast]
  );

  const { selected, setSelected } = useInboxKeys(items.length, act, panel === null);
  const close = () => setPanel(null);
  const patchAndClose = (id: string, patch: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ id, patch }, { onSuccess: close });

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
      <div role="tablist" className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setPanel(null); }} className={`rounded-md px-3 py-1.5 text-sm ${tab === t.id ? 'bg-ink text-paper dark:bg-paper dark:text-ink' : 'text-ink-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-ink-muted">{parked ? `${items.length} parked` : `${items.length} to process`}</p>
      <InboxList
        label={parked ? 'Later' : 'Inbox'}
        tasks={items}
        selected={selected}
        now={now}
        emptyText={parked ? 'Nothing parked for later.' : 'Inbox zero.'}
        onSelect={setSelected}
        onAction={act}
      />
      {panel?.kind === 'delegate' && (
        <DelegatePanel task={panel.task} defaultFollowUp={tomorrowFrom(today)} onCancel={close} onSubmit={(fields) => patchAndClose(panel.task.id, { status: 'delegated', ...fields })} />
      )}
      {panel?.kind === 'schedule' && (
        <SchedulePanel task={panel.task} defaultDate={tomorrowFrom(today)} onCancel={close} onSubmit={(date) => patchAndClose(panel.task.id, { status: scheduleStatus(date, today, weekStartDay), scheduledDate: date })} />
      )}
      {panel?.kind === 'project' && (
        <ProjectPicker task={panel.task} onCancel={close} onPick={(projectId) => patchAndClose(panel.task.id, { projectId, status: 'later' })} />
      )}
      <p className="text-xs text-ink-muted">T this week · L later · D delegate · S schedule · P project · X delete · j/k move</p>
    </section>
  );
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/lib/relativeTime.test.ts src/lib/inboxRules.test.ts src/screens/Inbox.test.tsx`
Expected: PASS — 5 relative-time cases, 2 rule tests, 11 screen tests.

Run: `npx vitest run && npm run lint && npm run build`
Expected: everything green (the shortcut tests still pass with `useCaptureKey` on the shared helper); lint clean; build clean.

Then with the servers running: capture three items from Today, open `/inbox`, process them with `t`, `l`, `x`, open the Later tab. Keep every file under 400 lines (the screen is about 110).

- [ ] **Step 9: Commit**

```bash
git add src/lib/keys.ts src/lib/useCaptureKey.ts src/lib/relativeTime.ts src/lib/inboxRules.ts src/components/inbox src/screens/Inbox.tsx src/lib/relativeTime.test.ts src/lib/inboxRules.test.ts src/screens/Inbox.test.tsx
git commit -m "feat: add the Inbox with keyboard processing, delegation, scheduling and a Later tab"
```

---

### Task 10: The capture and processing journeys, e2e teardown and README

**Files:**
- Create: `e2e/ports.ts`, `e2e/teardown.ts`, `e2e/capture.spec.ts`
- Modify: `e2e/playwright.config.ts`, `README.md`

**Interfaces:**
- Consumes: the running app (Tasks 7–9): the "Capture" textbox on `/` and `/capture`, the toast text, the Inbox counter and keys.
- Produces: `ports.ts` exporting `API_PORT = 4150`, `WEB_PORT = 3100`, `BASE_URL`; the config runs one worker, exports the temp directory as `TASKFLOW_E2E_DATA_DIR`, and removes it in `globalTeardown`; three new journeys in the `desktop` project.

- [ ] **Step 1: Share the ports and add the teardown**

Create `e2e/ports.ts`:

```ts
export const API_PORT = 4150;
export const WEB_PORT = 3100;
export const BASE_URL = `http://127.0.0.1:${WEB_PORT}`;
```

Create `e2e/teardown.ts`:

```ts
import { rmSync } from 'node:fs';

/** Removes the temporary database directory the config created for this run. */
export default function teardown(): void {
  const dir = process.env.TASKFLOW_E2E_DATA_DIR;
  if (dir) rmSync(dir, { recursive: true, force: true });
}
```

In `e2e/playwright.config.ts`:
- replace the two lines `const API_PORT = 4150;` and `const WEB_PORT = 3100;` with `import { API_PORT, WEB_PORT, BASE_URL } from './ports';`
- after `const dataDir = mkdtempSync(…);` add `process.env.TASKFLOW_E2E_DATA_DIR = dataDir;`
- inside `defineConfig({ … })` add `workers: 1,` after `fullyParallel: false,` (the journeys share one database, so files must not run in parallel workers) and `globalTeardown: './teardown.ts',` after `outputDir`
- change `baseURL: \`http://127.0.0.1:${WEB_PORT}\`` to `baseURL: BASE_URL`

- [ ] **Step 2: Write the journeys**

Create `e2e/capture.spec.ts`:

```ts
import { test, expect, devices } from '@playwright/test';
import { BASE_URL } from './ports';

const CAPTURED = 'Captured. It is in the Inbox, not on Today.';

test('a capture on the phone appears in the desktop Inbox when its tab regains focus', async ({ page, browser }) => {
  await page.goto('/inbox');
  await expect(page.getByText('Inbox zero.')).toBeVisible();

  const phone = await browser.newContext({ ...devices['Pixel 7'], baseURL: BASE_URL });
  const phonePage = await phone.newPage();
  await phonePage.goto('/capture');
  await phonePage.getByRole('textbox', { name: 'Capture' }).fill('Call the supplier');
  await phonePage.keyboard.press('Enter');
  await expect(phonePage.getByRole('status')).toHaveText(CAPTURED);
  await expect(phonePage.getByText('1 in inbox')).toBeVisible();
  await expect(phonePage.getByRole('list', { name: 'Recent captures' })).toContainText('Call the supplier');
  await phone.close();

  // TanStack Query's focus manager listens for visibilitychange on the window.
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('option').filter({ hasText: 'Call the supplier' })).toBeVisible();
  await expect(page.getByText('1 to process')).toBeVisible();

  // Leave the inbox empty for the next journey.
  await page.keyboard.press('x');
  await expect(page.getByText('Inbox zero.')).toBeVisible();
});

test('captures from Today and processes them with the keys', async ({ page }) => {
  await page.goto('/');
  const bar = page.getByRole('textbox', { name: 'Capture' });
  for (const title of ['Approve pricing', 'Review Haleon target', 'Chase the courier']) {
    await bar.fill(title);
    await bar.press('Enter');
    await expect(bar).toHaveValue('');
  }

  await page.goto('/inbox');
  await expect(page.getByText('3 to process')).toBeVisible();
  const options = page.getByRole('option');
  await expect(options).toHaveText([/Chase the courier/, /Review Haleon target/, /Approve pricing/]);

  await page.keyboard.press('t');
  await expect(page.getByText('2 to process')).toBeVisible();
  await expect(options.filter({ hasText: 'Chase the courier' })).toHaveCount(0);

  await page.keyboard.press('l');
  await expect(page.getByText('1 to process')).toBeVisible();

  await page.keyboard.press('x');
  await expect(page.getByText('Inbox zero.')).toBeVisible();

  await page.getByRole('tab', { name: 'Later' }).click();
  await expect(page.getByText('1 parked')).toBeVisible();
  await expect(page.getByRole('option')).toHaveText([/Review Haleon target/]);
});

test('serves the home-screen manifest', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest');
  expect(res.ok()).toBeTruthy();
  expect(await res.json()).toMatchObject({ start_url: '/capture', display: 'standalone' });
});
```

- [ ] **Step 3: Run the journeys**

Run: `npm run test:e2e`
Expected: 8 passed (6 desktop, 2 phone). Afterwards `ls /tmp | grep taskflow-e2e-` shows no directory left from this run.

If the first journey's `visibilitychange` dispatch does not refresh the list, dispatch it on `document` as well (`document.dispatchEvent(new Event('visibilitychange'))`) — the Phase 1 verification found the window event sufficient, but the assertion, not the mechanism, is the requirement.

- [ ] **Step 4: Update the README**

In `README.md`, after the "To reach the phone capture page…" paragraph, add:

```markdown
## Capturing

Press `c` on any screen, or type into the bar at the bottom of Today. On the
phone, open `/capture` (add it to the home screen: it ships a web-app
manifest). A capture always lands in the Inbox, never on Today. Process the
Inbox with the keys `T` (this week), `L` (later), `D` (delegate), `S`
(schedule), `P` (project) and `X` (delete an accidental capture); `j`/`k`
move the selection.
```

- [ ] **Step 5: Verify and commit**

Run: `npm run lint && npx vitest run`
Expected: clean; all green.

```bash
git add e2e/ports.ts e2e/teardown.ts e2e/capture.spec.ts e2e/playwright.config.ts README.md
git commit -m "test: add the phone-to-desktop capture journey and inbox processing journey"
```

---

### Task 11: Phase 2 verification and report

**Files:** none created; this is the after-every-phase ritual from the spec (section D).

- [ ] **Step 1: Static checks**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 2: Unit and integration coverage**

Run: `npm run test:coverage`
Expected: every project green; the 80% line threshold passes; note the totals and any file under 80% for the report.

- [ ] **Step 3: Journeys**

Run: `npm run test:e2e`
Expected: 8 passed; no `/tmp/taskflow-e2e-*` directory left behind.

- [ ] **Step 4: Manual run against the phase's bar**

The spec's Phase 2 "Done when": *A capture at a phone viewport appears in the desktop Inbox on focus; journey: capture then process.* Start `npm run server` and `npm run dev` (Vite prints 3001):
- `/` — the pinned capture bar; capture two items; the toast appears each time and the input clears.
- Press `c` on `/week` — the dialog opens focused; capture a third; Escape closes.
- `/inbox` — "3 to process", newest first with "just now"; `j`/`k` move the highlight; `t`, `d` (owner required; follow-up defaults to tomorrow), `s` (a date next month parks it), `x`; the Later tab shows the parked items; `x` there toasts the refusal.
- `/capture` in a narrow window — the large bar, the count, the last five, no navigation.
- Stop the API on `/capture`: the "Local API not reachable" line appears.
- The database survived: `node -e "const D=require('better-sqlite3');const db=new D('data/execution.db');console.log(db.prepare('SELECT status, COUNT(*) n FROM tasks GROUP BY status').all(), db.prepare('SELECT version FROM schema_migrations').all())"` shows the statuses you produced and the ledger row for version 1.
- Reserved for the owner: on the phone over the tailnet (`TASKFLOW_BIND` and `TASKFLOW_ALLOWED_HOST` set as in the Phase 1 report), open `/capture`, add it to the home screen, capture, then confirm it appears in the desktop Inbox on returning to that tab.

- [ ] **Step 5: Report**

Write the phase report where the executing skill keeps it: the commit list (`git log --oneline main..HEAD`), the coverage totals, the e2e result, what was verified by hand, what is reserved for the owner, and anything that did not pass — the spec's Phase 2 row is the reference.

---

## Self-review

**Spec coverage (Phase 2 scope):** B "Tables" `tasks` columns and timestamp rules — Task 4 (`transitions.ts`, `store.ts`); B "Routes" `/tasks` rows (`GET` with `status/context/week/followUpBy`, `POST` capture, `PATCH`, `POST /:id/roll`, `DELETE` inbox-only with `DELETE_NOT_ALLOWED`) and the read halves of `/settings` and `/projects` — Task 5; B "Validation" (zod first, `assertValidColumns` behind it, parameterised SQL) — Tasks 3–5; C "Today" item 5 (pinned capture, `c` anywhere, the toast text, context defaulting by office hours) — Task 7; C "Inbox" (two tabs, newest first, counter, the six keys, rows leave at once) — Task 9; C "Capture" (one field, the toggle defaulting by time of day, "N in inbox", the last five, a manifest, nothing else) — Task 8; C "Keyboard" (`c`) — Task 7; D "Testing" (constraint tests, supertest routes, pure core at 100%, hooks and components under jsdom, one journey per ritual) — Tasks 2–10; D Phase 2 "Done when" — Task 10's first journey and Task 11. Carry-overs from the Phase 1 final review: ledger/checksums/immediate transaction/mkdir/close — Task 1; exact CHECK text and every enum — Task 2; `ApiStatus` on full-screen routes, router catch-all, `color-scheme`, dead tokens — Task 7; client `patch`/`put`/`delete` and `success:false`@200 tests — Task 6; e2e teardown — Task 10; the "first fallible route" checklist — Task 5's tests drive `VALIDATION` (zod), `NOT_FOUND`, `DELETE_NOT_ALLOWED` and `CONSTRAINT` through real routes, and Phase 1's `errors.test.ts` keeps the remaining branches. Deferred to Phase 3 by decision: the 3-digit-crossing migration-order test (lands with `002_*.sql`).

**Placeholder scan:** no TBD/TODO; every code step has its code; the only "later phase" references are deliberate scope statements (`PUT /settings` in Phase 4, project writes in Phase 3).

**Type consistency:** `TaskListQuery`'s output type (`status?: TaskStatus[]`) is what `listTasks` consumes (Task 4) and what `tasksRouter` passes from `taskListQuerySchema.parse(req.query)` (Task 5). `TaskFilters` on the client (Task 6) has the same shape and `taskListPath` serialises `status` as a comma list, which `taskListQuerySchema` splits. `useUpdateTask`'s variables are `{ id, patch: TaskPatch }` in Task 6 and in the Inbox (Task 9); `patchAndClose`'s second parameter is typed from `update.mutate`, so it is `TaskPatch`. `CaptureBar`'s `inputId` default `'capture-input'` is what `CaptureShortcut` looks up (Task 7) and the dialog uses `'capture-dialog-input'` so the lookup never finds the dialog's own field. `CAPTURED_MESSAGE` in `CaptureBar.tsx` is the text the CaptureBar test, the Inbox flow and `e2e/capture.spec.ts` assert. `stubFetch`/`json`/`failure`, `SETTINGS`/`makeTask` (Task 6) are used unchanged by Tasks 7–9. `KEY_ACTIONS` maps `t l d s p x` to the `InboxAction` union that `RowActions`, `InboxList`, `InboxRow` and the screen share. `nowIso` (Task 4) is the default `clock` of `tasksRouter` (Task 5). `WEB_PORT`/`API_PORT` move from the config to `e2e/ports.ts` in Task 10 and the config imports them, so the values stay 3100/4150.
