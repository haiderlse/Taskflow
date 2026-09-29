# Execution System — Phase 3 (Weeks and Outcomes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the week real: weeks, outcomes and projects on the server with the three-outcome limit enforced; Sunday planning at `/plan` (last week's carry-over, choosing up to three outcomes with the activity nudge, "Week N is planned"); the Week screen with outcome cards, progress, kill and the replace flow; Projects with a detail page; Today's banner driven by the real week; and the Playwright journey "plan a week".

**Architecture:** Same layering as Phase 2. Server: one data module per resource (`server/exec/weeks/store.ts`, `outcomes/store.ts`, `projects/store.ts`) over a shared row helper (`server/exec/rows.ts`), one Express router per resource that parses with a shared zod schema, calls the store and answers in the envelope. Client: hook modules in `src/api/`, a shared error surface (`src/api/errors.ts`) that turns `ApiError` codes into toasts and lets forms branch on `WEEK_FULL`, and small components under `src/components/outcomes/` and `src/components/week/`.

**Tech Stack:** unchanged — Node 22 · React 19.2 · Vite 6.4 · Vitest 4.1 · TypeScript 5.8 strict · Express 5 · better-sqlite3 13 · react-router-dom 7 · @tanstack/react-query 5 · Tailwind 4 · zod 4.6 · Testing Library 16 + jsdom 30 · Playwright 1.63

**Spec:** `docs/superpowers/specs/2026-09-22-execution-system-design.md` — B "Tables" (`projects`, `weeks`, `outcomes`), B "The limits, as constraints", B "Routes" (the `/projects`, `/weeks`, `/outcomes` rows), B "Pure core" (`weekOf`, `isActivityTitle`), C "Week", C "Projects", C "Sunday planning" steps 1, 2 and 4, C "The activity nudge", D "Build sequence" Phase 3 row. Requirements: `docs/superpowers/specs/2026-09-22-execution-system-handoff.md` §4, §5, §9, §17, §20.

## Global Constraints

Copied from the spec and the earlier plans; every task's requirements include these.

- `/api/exec/*` responses are `{ success: true, data }` or `{ success: false, error, code }` with `code` one of `VALIDATION`, `NOT_FOUND`, `WEEK_FULL`, `DAY_TAKEN`, `SLOT_LIMIT`, `SHUTDOWN_NOT_READY`, `DELETE_NOT_ALLOWED`, `CONSTRAINT`, `INTERNAL`. Error responses never carry a stack, a path, a driver message, or a client-supplied field name or value.
- Every body and query is parsed by a zod schema from `src/shared/exec/schemas.ts` before the store is touched; every row write goes through `insertRow`/`updateRow` in `server/exec/rows.ts`, which checks each key against the live column list before building SQL text; statements are always parameterised.
- At most three outcomes hold a slot in a week (`slot IN (1,2,3)`, `UNIQUE (week_id, slot)`); a killed outcome frees its slot (`slot = NULL`); a fourth is refused with `409 WEEK_FULL` whose `details.outcomes` lists the three current ones.
- A week's `start_date` is the first day of the planning week containing the requested date, per `settings.week_start_day`. Calendar dates are `YYYY-MM-DD`; timestamps are ISO-8601 UTC set by the server; ids are server-generated UUIDs; rows are returned camelCase.
- The activity nudge ("This sounds like an activity. What will exist when it is finished?") never blocks saving an outcome; `/plan` alone requires a definition of done before a slot is filled.
- The API always binds `127.0.0.1`. No new environment variables. No new migration: every table this phase uses exists in `001_init.sql`.
- New code compiles under `strict: true` with `noUnusedLocals`/`noUnusedParameters`; `npm run lint` is `tsc --noEmit -p tsconfig.app.json`. Legacy code (`App.tsx`, `components/`, `services/`, `utils/`, `server/routes/*`, `server/db/*`) is not modified.
- Files stay under 400 lines and functions under 50 lines. No `console.log` in application code. New objects rather than mutation.
- TDD: the failing test lands before the code that passes it. Coverage stays at 80% lines. Phase 2's 376 tests keep passing.
- Commit messages follow `<type>: <description>` and contain nothing else — no `Co-Authored-By`, no `Claude-Session`, no trailer of any kind (the user's own git rules disable attribution). Never push.
- Port 3000 on the development machine is held by another project; `npm run dev` prints another port (3001). The e2e config uses 3100/4150. `os.tmpdir()` is `/mnt/clarus_nvme/tmp`.

## Decisions carried into this plan

- **Replace is atomic.** `POST /weeks/:id/outcomes` accepts an optional `replace: { outcomeId, reason }`; the server kills that outcome (status `killed`, `slot = NULL`, `review_reason = reason`, `closed_at` now) and fills the freed slot in one `BEGIN IMMEDIATE` transaction. The spec's route row does not mention it; two separate calls could leave a killed outcome and no replacement.
- **The kill reason is stored in `review_reason`.** Its eleven codes (§13) are the natural vocabulary for "why this gave up its slot", and a killed outcome is never graded on Friday (only slotted outcomes are), so nothing else writes it.
- **`GET /weeks?date=` looks up without creating.** It returns `{ current, previous, hasHistory }` (each week a `WeekView` or `null`): the Today screen and `/plan` need exactly this in one call, and reading should not create rows. `POST /weeks { date }` is the spec's create-or-return; the client calls it only when adding the first outcome of a week.
- **Rolling an outcome keeps its progress and is idempotent.** `POST /outcomes/:id/roll { weekId }` copies title, category, description, definition of done, project, notes and progress into the target week with `rolled_from_id`, sets the target date to that week's Friday, and returns the existing copy (200) if one was already rolled there. A `done` outcome is not rolled. Friday review (Phase 6) is the main caller; `/plan` step 1 uses it now for "Carry into this week".
- **`done` sets progress 100 and `closed_at`; `done → active` clears `closed_at` and keeps the slot; a killed outcome cannot be reopened** (add it again instead — reopening would need a free slot and a second limit check).
- **Deferred to the phase that owns the data:** "Must Ships shipped x of y" on outcome cards and Must Ship candidates on project pages (Phase 4, `must_ships`); deep-work minutes, "No time allocated" and `/plan` step 3 (Phase 5, `deep_work_blocks` — in this phase every card would say "No time allocated", which is noise); last week's scoreboard on `/plan` step 1 (Phase 6). `/plan` step 1 shows last week's outcomes and offers to carry the unfinished ones.
- **Week number is the ISO-8601 week of the week's Thursday**, so a Sunday-start week gets the number of the Monday–Sunday week that holds most of its days (Week 39 for 20–26 Sep 2026, matching the handoff's example).
- **Carried from the Phase 2 final review:** `?week=` is normalised to the planning week that contains it (Task 1); the duplicated `PLAIN` field spec is extracted into `server/exec/rows.ts` (Task 1); a code-aware error surface replaces the Inbox's local `report` helper (Task 6); the Inbox selection resets on tab switch and the tests import `CAPTURED_MESSAGE` (Task 6). Still deferred: `rollTask` × `processedAt` (Phase 6), Inbox listbox `aria-activedescendant`, client-side response parsing, the legacy error handler's echo (Phase 7).
- **The new e2e spec is `e2e/week.spec.ts`.** Playwright runs one worker over files in path order against a shared database, and `smoke.spec.ts` asserts the first-run "Plan your first week" link; a planning journey must sort after it.

---

## File Structure

**Server**
- Create: `server/exec/rows.ts` — `PLAIN`, `Bindable`, `ExecTable`, `toEntity`, `placeholders`, `insertRow`, `updateRow`.
- Create: `server/exec/settings/store.ts` — `getSettings(db)`.
- Create: `server/exec/weeks/store.ts` — `getWeek`, `findWeekByStart`, `listOutcomes`, `getWeekView`, `ensureWeek`, `lookupWeek`.
- Create: `server/exec/outcomes/store.ts` — `getOutcome`, `addOutcome`, `patchOutcome`, `rollOutcome`.
- Create: `server/exec/projects/store.ts` — `listProjectSummaries`, `getProjectDetail`, `createProject`, `patchProject`.
- Create: `server/exec/routes/weeks.ts`, `server/exec/routes/outcomes.ts`.
- Modify: `server/exec/tasks/store.ts`, `server/exec/routes/tasks.ts`, `server/exec/routes/settings.ts`, `server/exec/routes/projects.ts`, `server/exec/router.ts`.
- Tests: `server/exec/__tests__/rows.test.ts`, `settings-store.test.ts`, `weeks-store.test.ts`, `outcomes-store.test.ts`, `projects-store.test.ts`, `projects-routes.test.ts`, `weeks-routes.test.ts`; append to `tasks-routes.test.ts`.

**Shared**
- Modify: `src/shared/exec/schemas.ts` — week, outcome and project schemas.
- Create: `src/shared/exec/nudge.ts`, `src/shared/exec/week.ts`.
- Tests: `src/shared/exec/nudge.test.ts`, `week.test.ts`; append to `schemas.test.ts`.

**Client**
- Create: `src/api/errors.ts`, `src/api/weeks.ts`, `src/lib/useToday.ts`, `src/lib/labels.ts`.
- Modify: `src/api/projects.ts`, `src/screens/Inbox.tsx`, `src/components/CaptureBar.test.tsx`, `src/components/Toast.test.tsx`.
- Create: `src/components/outcomes/NudgeLine.tsx`, `OutcomeForm.tsx`, `OutcomeCard.tsx`, `ReplacePicker.tsx`; `src/components/week/WeekSlots.tsx`, `WeekTasks.tsx`; `src/components/plan/CarryOver.tsx`, `ChooseOutcomes.tsx`.
- Modify: `src/screens/Week.tsx`, `src/screens/Today.tsx`, `src/screens/Plan.tsx`, `src/screens/Projects.tsx`, `src/app/routes.tsx`, `src/test/fixtures.ts`.
- Create: `src/screens/ProjectDetail.tsx`.
- Tests beside each (jsdom project).

**End to end**
- Create: `e2e/week.spec.ts`; modify `README.md`.

---

### Task 1: Shared row helpers, settings store and the week normalisation

**Files:**
- Create: `server/exec/rows.ts`, `server/exec/settings/store.ts`
- Modify: `server/exec/tasks/store.ts`, `server/exec/routes/tasks.ts`, `server/exec/routes/settings.ts`, `server/exec/routes/projects.ts`
- Test: `server/exec/__tests__/rows.test.ts`, `server/exec/__tests__/settings-store.test.ts`; append to `server/exec/__tests__/tasks-routes.test.ts`

**Interfaces:**
- Consumes: `rowToEntity`, `entityToRow`, `FieldSpec` (`server/db/mappers.ts`); `assertValidColumns`, `getTableColumns` (`server/db/sql.ts`); `ApiError` (`server/exec/http.ts`); `settingsSchema`, `Settings` (`src/shared/exec/schemas.ts`); `weekStartOf` (`src/shared/exec/time.ts`).
- Produces:
  - `rows.ts`: `PLAIN: FieldSpec`, `type Bindable = string | number | null`, `type ExecTable = 'tasks' | 'projects' | 'weeks' | 'outcomes'`, `toEntity<T>(row: unknown): T`, `placeholders(count: number): string`, `insertRow(db, table: ExecTable, fields: Record<string, unknown>): void`, `updateRow(db, table: ExecTable, id: string, fields: Record<string, unknown>): void` (no-op for an empty object)
  - `settings/store.ts`: `getSettings(db): Settings` (throws `ApiError(500, 'INTERNAL', 'settings row is missing' | 'settings row is invalid')`)
  - `tasks/store.ts`: `listTasks(db, query, weekStartDay = 0)` — `week` is normalised with `weekStartOf(query.week, weekStartDay)`

- [ ] **Step 1: Write the failing row-helper tests**

Create `server/exec/__tests__/rows.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { insertRow, updateRow, toEntity, placeholders } from '../rows';

const NOW = '2026-09-22T03:00:00.000Z';
let db: Database.Database;

type ProjectRow = { id: string; name: string; context: string; status: string; notes: string; createdAt: string };
const project = (id: string) => toEntity<ProjectRow>(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
const insertProject = (id: string) =>
  insertRow(db, 'projects', { id, name: 'Supply plan', context: 'work', createdAt: NOW, updatedAt: NOW });

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('insertRow and updateRow', () => {
  it('writes camelCase fields to snake_case columns and reads them back camelCase', () => {
    insertProject('p1');
    expect(project('p1')).toMatchObject({ id: 'p1', name: 'Supply plan', context: 'work', status: 'active', notes: '', createdAt: NOW });
    updateRow(db, 'projects', 'p1', { name: 'September supply plan', updatedAt: NOW });
    expect(project('p1').name).toBe('September supply plan');
  });

  it('refuses a field that is not a column before any SQL is built', () => {
    insertProject('p1');
    expect(() => updateRow(db, 'projects', 'p1', { bogus: 'x' })).toThrow(/unknown column: bogus/);
    expect(() =>
      insertRow(db, 'projects', { id: 'p2', name: 'x', context: 'work', createdAt: NOW, updatedAt: NOW, evil: 1 })
    ).toThrow(/unknown column: evil/);
    expect(db.prepare('SELECT COUNT(*) FROM projects').pluck().get()).toBe(1);
  });

  it('treats an empty update as a no-op', () => {
    insertProject('p1');
    expect(() => updateRow(db, 'projects', 'p1', {})).not.toThrow();
    expect(project('p1').name).toBe('Supply plan');
  });

  it('builds placeholder lists', () => {
    expect(placeholders(3)).toBe('?, ?, ?');
    expect(placeholders(0)).toBe('');
  });
});
```

Create `server/exec/__tests__/settings-store.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { prepareExecDb } from '../db/prepare';
import { getSettings } from '../settings/store';

describe('getSettings', () => {
  it('reads the seeded schedule with its JSON columns decoded', () => {
    expect(getSettings(prepareExecDb(':memory:'))).toMatchObject({
      timezone: 'Asia/Karachi',
      weekStartDay: 0,
      workDays: [1, 2, 3, 4, 5],
      buildBlocks: [
        { weekday: 2, start: '06:30', minutes: 50 },
        { weekday: 4, start: '06:30', minutes: 50 },
        { weekday: 6, start: '09:00', minutes: 180 },
      ],
    });
  });

  it('fails closed on a corrupted JSON column', () => {
    const db = prepareExecDb(':memory:');
    db.prepare("UPDATE settings SET work_days = 'not json' WHERE id = 1").run();
    expect(() => getSettings(db)).toThrow(/settings row is invalid/);
  });

  it('fails closed on JSON of the wrong shape', () => {
    const db = prepareExecDb(':memory:');
    db.prepare(`UPDATE settings SET work_days = '"weekdays"' WHERE id = 1`).run();
    expect(() => getSettings(db)).toThrow(/settings row is invalid/);
  });
});
```

Append inside `describe('GET /api/exec/tasks', …)` in `server/exec/__tests__/tasks-routes.test.ts`:

```ts
  it('normalises week to the planning week that contains the date', async () => {
    const a = await capture('a');
    await patch(a.id, { status: 'later', scheduledDate: '2026-09-25' });
    // The Sunday-start week holding 25 Sep runs 20–26 Sep; any day in it finds the task.
    for (const day of ['2026-09-20', '2026-09-22', '2026-09-26']) {
      const res = await request(app).get(`/api/exec/tasks?week=${day}`);
      expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(['a']);
    }
    const next = await request(app).get('/api/exec/tasks?week=2026-09-27');
    expect(next.body.data).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/rows.test.ts server/exec/__tests__/settings-store.test.ts server/exec/__tests__/tasks-routes.test.ts`
Expected: FAIL — `../rows` and `../settings/store` cannot be resolved; the normalisation test finds nothing for `2026-09-22` and `2026-09-26`.

- [ ] **Step 3: Write the row helpers and the settings store**

Create `server/exec/rows.ts`:

```ts
import type Database from 'better-sqlite3';
import { rowToEntity, entityToRow, type FieldSpec } from '../db/mappers';
import { assertValidColumns, getTableColumns } from '../db/sql';

/** Exec rows keep dates and timestamps as text, so no codec applies; the spec only drives snake/camel. */
export const PLAIN: FieldSpec = { json: [], dates: [], bools: [] };

export type Bindable = string | number | null;

/** Every table a store may write. A literal union, so the name is never request-derived. */
export type ExecTable = 'tasks' | 'projects' | 'weeks' | 'outcomes';

export const toEntity = <T>(row: unknown): T => rowToEntity<T>(row as Record<string, unknown>, PLAIN);

export const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(', ');

const columnsByDb = new WeakMap<Database.Database, Map<ExecTable, Set<string>>>();

function columnsOf(db: Database.Database, table: ExecTable): Set<string> {
  const byTable = columnsByDb.get(db) ?? new Map<ExecTable, Set<string>>();
  columnsByDb.set(db, byTable);
  const columns = byTable.get(table) ?? getTableColumns(db, table);
  byTable.set(table, columns);
  return columns;
}

/** Keys are camelCase; each must be a real column before any SQL text is built. */
function toColumns(db: Database.Database, table: ExecTable, fields: Record<string, unknown>) {
  const row = entityToRow(fields, PLAIN);
  assertValidColumns(row, columnsOf(db, table));
  return { columns: Object.keys(row), values: Object.values(row) as Bindable[] };
}

export function insertRow(db: Database.Database, table: ExecTable, fields: Record<string, unknown>): void {
  const { columns, values } = toColumns(db, table, fields);
  db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders(columns.length)})`).run(...values);
}

export function updateRow(db: Database.Database, table: ExecTable, id: string, fields: Record<string, unknown>): void {
  const { columns, values } = toColumns(db, table, fields);
  if (columns.length === 0) return;
  db.prepare(`UPDATE ${table} SET ${columns.map((column) => `${column} = ?`).join(', ')} WHERE id = ?`).run(...values, id);
}
```

Create `server/exec/settings/store.ts`:

```ts
import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { settingsSchema, type Settings } from '../../../src/shared/exec/schemas';

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

const invalid = () => new ApiError(500, 'INTERNAL', 'settings row is invalid');

function decodeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw invalid();
  }
}

/** The single settings row, JSON columns decoded and validated; fails closed rather than leak a bad row. */
export function getSettings(db: Database.Database): Settings {
  const row = db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow | undefined;
  if (!row) throw new ApiError(500, 'INTERNAL', 'settings row is missing');
  const parsed = settingsSchema.safeParse({
    timezone: row.timezone,
    weekStartDay: row.week_start_day,
    workDays: decodeJson(row.work_days),
    deepWorkStart: row.deep_work_start,
    deepWorkMinutes: row.deep_work_minutes,
    shutdownTime: row.shutdown_time,
    officeStart: row.office_start,
    officeEnd: row.office_end,
    buildBlocks: decodeJson(row.build_blocks),
  });
  if (!parsed.success) throw invalid();
  return parsed.data;
}
```

- [ ] **Step 4: Move the routes and the tasks store onto the helpers**

Overwrite `server/exec/routes/settings.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok } from '../http';
import { getSettings } from '../settings/store';

/** Read-only until Phase 4 adds PUT. */
export function settingsRouter(db: Database.Database): Router {
  const router = Router();
  router.get('/', (_req, res) => ok(res, getSettings(db)));
  return router;
}
```

In `server/exec/routes/projects.ts`, replace the two lines
`import { rowToEntity, type FieldSpec } from '../../db/mappers';` and `const PLAIN: FieldSpec = { json: [], dates: [], bools: [] };`
with `import { toEntity } from '../rows';`, and change `rows.map((row) => rowToEntity<Project>(row, PLAIN))` to `rows.map((row) => toEntity<Project>(row))`. (Task 4 rewrites this file; this step only removes the duplicate.)

In `server/exec/tasks/store.ts`:
- Replace the imports of `rowToEntity, entityToRow, type FieldSpec` and `assertValidColumns, getTableColumns` with:
  ```ts
  import { toEntity, placeholders, updateRow, type Bindable } from '../rows';
  import { weekStartOf } from '../../../src/shared/exec/time';
  ```
- Delete the local `PLAIN`, `type Bindable`, `placeholders`, `columnsByDb`, `tasksColumns` and `writeRow` definitions (and the comment above `PLAIN`), and define `const toTask = (row: unknown): Task => toEntity<Task>(row);`.
- Replace each `writeRow(db, id, …)` call with `updateRow(db, 'tasks', id, …)`.
- Change `listTasks`'s signature and `week` clause to:
  ```ts
  /** Newest capture first. Filters combine with AND; `week` is any day of the planning week it names. */
  export function listTasks(db: Database.Database, query: TaskListQuery, weekStartDay = 0): Task[] {
  ```
  and, inside `if (query.week) { … }`, first compute `const start = weekStartOf(query.week, weekStartDay);` and bind `start, addDays(start, 6)` in place of `query.week, addDays(query.week, 6)`.

In `server/exec/routes/tasks.ts`, add `import { getSettings } from '../settings/store';` and change the list handler to:

```ts
  router.get('/', (req, res) => {
    ok(res, listTasks(db, taskListQuerySchema.parse(req.query), getSettings(db).weekStartDay));
  });
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run server/exec`
Expected: PASS — 4 rows, 3 settings-store, the new normalisation test, and every existing server test (tasks store, tasks routes, settings routes, errors, schema, migrate).

Run: `npx vitest run && npm run lint`
Expected: 384 passing; lint clean.

- [ ] **Step 6: Commit**

```bash
git add server/exec/rows.ts server/exec/settings/store.ts server/exec/tasks/store.ts server/exec/routes/tasks.ts server/exec/routes/settings.ts server/exec/routes/projects.ts server/exec/__tests__/rows.test.ts server/exec/__tests__/settings-store.test.ts server/exec/__tests__/tasks-routes.test.ts
git commit -m "refactor: share row helpers and the settings store, and normalise the week filter"
```

---

### Task 2: Week, outcome and project schemas, the nudge and week helpers

**Files:**
- Modify: `src/shared/exec/schemas.ts`
- Create: `src/shared/exec/nudge.ts`, `src/shared/exec/week.ts`
- Test: `src/shared/exec/nudge.test.ts`, `src/shared/exec/week.test.ts`; append to `src/shared/exec/schemas.test.ts`

**Interfaces:**
- Consumes: the private `timestamp`, `uuid`, `title`-style helpers and `calendarDateSchema`, `contextSchema`, `taskSchema`, `projectSchema` already in `schemas.ts`; `addDays` (`dates.ts`).
- Produces (all exported):
  - `schemas.ts`: `OUTCOME_CATEGORIES`, `outcomeCategorySchema`, `type OutcomeCategory`; `OUTCOME_STATUSES`, `type OutcomeStatus`; `REVIEW_GRADES`; `REVIEW_REASONS`, `reviewReasonSchema`, `type ReviewReason`; `REVIEW_DISPOSITIONS`; `PROJECT_STATUSES`, `type ProjectStatus`; `weekSchema`/`type Week`; `outcomeSchema`/`type Outcome`; `weekViewSchema`/`type WeekView` (`{ week, outcomes }`); `weekLookupSchema`/`type WeekLookup` (`{ current, previous, hasHistory }`); `weekQuerySchema`, `weekCreateSchema` (`{ date }`); `outcomeCreateSchema` with `type OutcomeCreate` (output) and `type OutcomeInput` (`z.input`, for the client); `outcomePatchSchema`/`type OutcomePatch`; `outcomeRollSchema`; `projectCreateSchema`/`type ProjectCreate`, `type ProjectInput`; `projectPatchSchema`/`type ProjectPatch`; `projectSummarySchema`/`type ProjectSummary`; `projectDetailSchema`/`type ProjectDetail`
  - `nudge.ts`: `ACTIVITY_VERBS`, `NUDGE_MESSAGE`, `isActivityTitle(title): boolean`, `needsNudge(title, definitionOfDone): boolean`
  - `week.ts`: `dayInWeek(startDate, weekday): string`, `fridayOf(startDate): string`, `weekNumber(startDate): number`, `weekRangeLabel(startDate): string`, `contextOf(category): Context`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/exec/nudge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { isActivityTitle, needsNudge, NUDGE_MESSAGE } from './nudge';

describe('isActivityTitle', () => {
  it.each(['Work on supplier meetings', 'look into the Haleon gap', 'Continue', 'REVIEW pricing', 'follow up with Bilal', 'think about hiring', 'Research POS vendors', '  discuss   margins '])(
    'flags %j',
    (title) => {
      expect(isActivityTitle(title)).toBe(true);
    }
  );

  it.each(['Complete the September supplier delivery plan', 'Reviewed pricing sheet shared', 'Workshop agenda published', ''])(
    'accepts %j',
    (title) => {
      expect(isActivityTitle(title)).toBe(false);
    }
  );
});

describe('needsNudge', () => {
  it('nudges an activity title or a missing definition of done, never an empty title', () => {
    expect(needsNudge('Work on Pinkbox', 'P&L dashboard live')).toBe(true);
    expect(needsNudge('Pinkbox P&L dashboard live', '   ')).toBe(true);
    expect(needsNudge('Pinkbox P&L dashboard live', 'Dashboard shows live franchise data')).toBe(false);
    expect(needsNudge('', '')).toBe(false);
  });

  it('has the spec wording', () => {
    expect(NUDGE_MESSAGE).toBe('This sounds like an activity. What will exist when it is finished?');
  });
});
```

Create `src/shared/exec/week.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { dayInWeek, fridayOf, weekNumber, weekRangeLabel, contextOf } from './week';

describe('week helpers', () => {
  it('finds a weekday inside the seven days from the start', () => {
    expect(dayInWeek('2026-09-20', 0)).toBe('2026-09-20');
    expect(dayInWeek('2026-09-20', 6)).toBe('2026-09-26');
    expect(dayInWeek('2026-09-21', 0)).toBe('2026-09-27'); // Monday-start week: its Sunday is last
    expect(fridayOf('2026-09-20')).toBe('2026-09-25');
    expect(fridayOf('2026-09-21')).toBe('2026-09-25');
  });

  it('numbers the week by the ISO week of its Thursday', () => {
    expect(weekNumber('2026-09-20')).toBe(39);
    expect(weekNumber('2026-09-21')).toBe(39);
    expect(weekNumber('2025-12-28')).toBe(1); // Thursday 1 Jan 2026 is in ISO week 1
    expect(weekNumber('2026-12-27')).toBe(53); // Thursday 31 Dec 2026 is in ISO week 53
  });

  it('labels the date range', () => {
    expect(weekRangeLabel('2026-09-20')).toBe('20–26 Sep');
    expect(weekRangeLabel('2026-09-27')).toBe('27 Sep – 3 Oct');
  });

  it('derives the context from the category', () => {
    expect(contextOf('office')).toBe('work');
    expect(contextOf('business')).toBe('build');
    expect(contextOf('career')).toBe('build');
    expect(contextOf('personal')).toBe('build');
  });
});
```

Append to `src/shared/exec/schemas.test.ts` (the file's `issuePaths` helper is reused; add the new names to its import line from `./schemas`: `outcomeCreateSchema, outcomePatchSchema, outcomeRollSchema, weekQuerySchema, projectCreateSchema, projectPatchSchema, outcomeSchema`):

```ts
describe('outcome schemas', () => {
  it('trims the title and fills defaults on create', () => {
    expect(outcomeCreateSchema.parse({ title: '  Supplier plan confirmed ', category: 'office' })).toEqual({
      title: 'Supplier plan confirmed',
      category: 'office',
      description: '',
      definitionOfDone: '',
      targetDate: null,
      projectId: null,
      notes: '',
    });
  });

  it('accepts a replace instruction and rejects a bad one', () => {
    const replace = { outcomeId: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f', reason: 'priority_changed' };
    expect(outcomeCreateSchema.parse({ title: 'x', category: 'career', replace }).replace).toEqual(replace);
    expect(issuePaths(outcomeCreateSchema.safeParse({ title: 'x', category: 'career', replace: { ...replace, reason: 'bored' } }))).toEqual(['replace.reason']);
  });

  it('rejects an unknown category, a blank title and unknown keys', () => {
    expect(issuePaths(outcomeCreateSchema.safeParse({ title: 'x', category: 'hobby' }))).toEqual(['category']);
    expect(issuePaths(outcomeCreateSchema.safeParse({ title: ' ', category: 'office' }))).toEqual(['title']);
    expect(issuePaths(outcomeCreateSchema.safeParse({ title: 'x', category: 'office', slot: 4 }))).toEqual(['']);
  });

  it('patches partially, bounds progress and never accepts a slot or timestamp', () => {
    expect(outcomePatchSchema.parse({ progress: 60 })).toEqual({ progress: 60 });
    expect(outcomePatchSchema.safeParse({}).success).toBe(false);
    expect(issuePaths(outcomePatchSchema.safeParse({ progress: 101 }))).toEqual(['progress']);
    expect(outcomePatchSchema.safeParse({ slot: 1 }).success).toBe(false);
    expect(outcomePatchSchema.safeParse({ closedAt: '2026-09-22T03:00:00.000Z' }).success).toBe(false);
  });

  it('rolls into a week by id and looks weeks up by a calendar date', () => {
    expect(outcomeRollSchema.safeParse({ weekId: 'w1' }).success).toBe(false);
    expect(weekQuerySchema.parse({ date: '2026-09-22' })).toEqual({ date: '2026-09-22' });
    expect(weekQuerySchema.safeParse({ date: '2026-09-31' }).success).toBe(false);
  });

  it('parses an outcome row as the server returns it', () => {
    const row = {
      id: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f',
      weekId: '5f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f',
      slot: 1,
      title: 'x',
      description: '',
      category: 'office',
      definitionOfDone: '',
      targetDate: '2026-09-25',
      projectId: null,
      progress: 0,
      status: 'active',
      reviewGrade: null,
      reviewReason: null,
      reviewDisposition: null,
      rolledFromId: null,
      notes: '',
      closedAt: null,
      createdAt: '2026-09-22T03:00:00.000Z',
      updatedAt: '2026-09-22T03:00:00.000Z',
    };
    expect(outcomeSchema.safeParse(row).success).toBe(true);
    expect(outcomeSchema.safeParse({ ...row, slot: 4 }).success).toBe(false);
  });
});

describe('project schemas', () => {
  it('creates with a trimmed name and patches the status', () => {
    expect(projectCreateSchema.parse({ name: ' Supply plan ', context: 'work' })).toEqual({ name: 'Supply plan', context: 'work', notes: '' });
    expect(projectPatchSchema.parse({ status: 'archived' })).toEqual({ status: 'archived' });
    expect(issuePaths(projectPatchSchema.safeParse({ status: 'paused' }))).toEqual(['status']);
    expect(projectPatchSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/exec`
Expected: FAIL — `./nudge` and `./week` cannot be resolved; the new schema names are not exported.

- [ ] **Step 3: Write the nudge and week helpers**

Create `src/shared/exec/nudge.ts`:

```ts
/** The verbs that make a title an activity rather than an output (spec C "The activity nudge", §9). */
export const ACTIVITY_VERBS = ['work on', 'look into', 'continue', 'review', 'discuss', 'follow up', 'think about', 'research'] as const;

export const NUDGE_MESSAGE = 'This sounds like an activity. What will exist when it is finished?';

export function isActivityTitle(title: string): boolean {
  const normalised = title.trim().toLowerCase().replace(/\s+/g, ' ');
  return ACTIVITY_VERBS.some((verb) => normalised === verb || normalised.startsWith(`${verb} `));
}

/** Lightweight coaching: shown under the field, never a reason to refuse the save. */
export const needsNudge = (title: string, definitionOfDone: string): boolean =>
  title.trim() !== '' && (isActivityTitle(title) || definitionOfDone.trim() === '');
```

Create `src/shared/exec/week.ts`:

```ts
import { addDays } from './dates';
import type { Context, OutcomeCategory } from './schemas';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_MS = 86_400_000;

const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The date among the seven days starting at `startDate` that falls on `weekday` (0 = Sunday). */
export const dayInWeek = (startDate: string, weekday: number): string =>
  addDays(startDate, (weekday - weekdayOf(startDate) + 7) % 7);

/** Outcomes default their target to the week's Friday (spec C "Sunday planning"). */
export const fridayOf = (startDate: string): string => dayInWeek(startDate, 5);

/** ISO-8601 week number of the week's Thursday: a Sunday-start week takes the number of the ISO week holding most of it. */
export function weekNumber(startDate: string): number {
  const thursday = new Date(`${dayInWeek(startDate, 4)}T00:00:00Z`);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
}

/** "20–26 Sep", or "27 Sep – 3 Oct" across a month end. */
export function weekRangeLabel(startDate: string): string {
  const [, startMonth, startDay] = startDate.split('-').map(Number);
  const [, endMonth, endDay] = addDays(startDate, 6).split('-').map(Number);
  return startMonth === endMonth
    ? `${startDay}–${endDay} ${MONTHS[startMonth - 1]}`
    : `${startDay} ${MONTHS[startMonth - 1]} – ${endDay} ${MONTHS[endMonth - 1]}`;
}

/** Office outcomes are work; business, career and personal are build (§16). */
export const contextOf = (category: OutcomeCategory): Context => (category === 'office' ? 'work' : 'build');
```

- [ ] **Step 4: Add the schemas**

In `src/shared/exec/schemas.ts`, change the existing `projectSchema`'s status field from `z.enum(['active', 'done', 'archived'])` to `projectStatusSchema`, and add, directly above `projectSchema`:

```ts
export const PROJECT_STATUSES = ['active', 'done', 'archived'] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
```

Then append at the end of the file:

```ts
// ---- Weeks, outcomes and projects (Phase 3) ----

export const OUTCOME_CATEGORIES = ['office', 'business', 'career', 'personal'] as const;
export const outcomeCategorySchema = z.enum(OUTCOME_CATEGORIES);
export type OutcomeCategory = z.infer<typeof outcomeCategorySchema>;

export const OUTCOME_STATUSES = ['active', 'done', 'killed'] as const;
const outcomeStatusSchema = z.enum(OUTCOME_STATUSES);
export type OutcomeStatus = z.infer<typeof outcomeStatusSchema>;

export const REVIEW_GRADES = ['done', 'partial', 'missed'] as const;
export const REVIEW_REASONS = [
  'insufficient_time',
  'unexpected_urgent_work',
  'dependency_blocker',
  'poor_estimation',
  'too_many_meetings',
  'priority_changed',
  'procrastination',
  'unclear_outcome',
  'delegated_dependency',
  'no_longer_important',
  'other',
] as const;
export const reviewReasonSchema = z.enum(REVIEW_REASONS);
export type ReviewReason = z.infer<typeof reviewReasonSchema>;
export const REVIEW_DISPOSITIONS = ['roll_forward', 'reschedule', 'delegate', 'kill'] as const;

const outcomeTitle = z.string().trim().min(1, 'title is required').max(200, 'title is too long');
const longText = z.string().max(4000, 'text is too long');

export const weekSchema = z.object({
  id: uuid,
  startDate: calendarDateSchema,
  reviewedAt: timestamp.nullable(),
  reviewNotes: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Week = z.infer<typeof weekSchema>;

export const outcomeSchema = z.object({
  id: uuid,
  weekId: uuid,
  slot: z.number().int().min(1).max(3).nullable(),
  title: z.string(),
  description: z.string(),
  category: outcomeCategorySchema,
  definitionOfDone: z.string(),
  targetDate: calendarDateSchema.nullable(),
  projectId: uuid.nullable(),
  progress: z.number().int().min(0).max(100),
  status: outcomeStatusSchema,
  reviewGrade: z.enum(REVIEW_GRADES).nullable(),
  reviewReason: reviewReasonSchema.nullable(),
  reviewDisposition: z.enum(REVIEW_DISPOSITIONS).nullable(),
  rolledFromId: uuid.nullable(),
  notes: z.string(),
  closedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Outcome = z.infer<typeof outcomeSchema>;

export const weekViewSchema = z.object({ week: weekSchema, outcomes: z.array(outcomeSchema) });
export type WeekView = z.infer<typeof weekViewSchema>;

export const weekLookupSchema = z.object({
  current: weekViewSchema.nullable(),
  previous: weekViewSchema.nullable(),
  hasHistory: z.boolean(),
});
export type WeekLookup = z.infer<typeof weekLookupSchema>;

export const weekQuerySchema = z.strictObject({ date: calendarDateSchema });
export const weekCreateSchema = z.strictObject({ date: calendarDateSchema });

export const outcomeCreateSchema = z.strictObject({
  title: outcomeTitle,
  category: outcomeCategorySchema,
  description: longText.default(''),
  definitionOfDone: longText.default(''),
  targetDate: calendarDateSchema.nullable().default(null),
  projectId: uuid.nullable().default(null),
  notes: longText.default(''),
  replace: z.strictObject({ outcomeId: uuid, reason: reviewReasonSchema }).optional(),
});
export type OutcomeCreate = z.infer<typeof outcomeCreateSchema>;
export type OutcomeInput = z.input<typeof outcomeCreateSchema>;

/** Slot, lineage and timestamps are never client-writable; status changes set them. */
export const outcomePatchSchema = z
  .strictObject({
    title: outcomeTitle.optional(),
    description: longText.optional(),
    category: outcomeCategorySchema.optional(),
    definitionOfDone: longText.optional(),
    targetDate: calendarDateSchema.nullable().optional(),
    projectId: uuid.nullable().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    status: outcomeStatusSchema.optional(),
    reviewGrade: z.enum(REVIEW_GRADES).nullable().optional(),
    reviewReason: reviewReasonSchema.nullable().optional(),
    reviewDisposition: z.enum(REVIEW_DISPOSITIONS).nullable().optional(),
    notes: longText.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type OutcomePatch = z.infer<typeof outcomePatchSchema>;

export const outcomeRollSchema = z.strictObject({ weekId: uuid });

export const projectCreateSchema = z.strictObject({
  name: z.string().trim().min(1, 'name is required').max(120, 'name is too long'),
  context: contextSchema,
  notes: longText.default(''),
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectInput = z.input<typeof projectCreateSchema>;

export const projectPatchSchema = z
  .strictObject({
    name: z.string().trim().min(1, 'name is required').max(120, 'name is too long').optional(),
    context: contextSchema.optional(),
    status: projectStatusSchema.optional(),
    notes: longText.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type ProjectPatch = z.infer<typeof projectPatchSchema>;

export const projectSummarySchema = projectSchema.extend({
  activeOutcomes: z.number().int().nonnegative(),
  openTasks: z.number().int().nonnegative(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const projectDetailSchema = z.object({
  project: projectSchema,
  outcomes: z.array(outcomeSchema.extend({ weekStartDate: calendarDateSchema })),
  tasks: z.array(taskSchema),
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/shared/exec`
Expected: PASS — 8+4 nudge cases and 2 tests, 4 week tests, 7 new schema tests, plus the existing shared tests.

Run: `npx vitest run && npm run lint`
Expected: all green; lint clean. `schemas.ts` stays under 400 lines.

- [ ] **Step 6: Commit**

```bash
git add src/shared/exec/schemas.ts src/shared/exec/nudge.ts src/shared/exec/week.ts src/shared/exec/nudge.test.ts src/shared/exec/week.test.ts src/shared/exec/schemas.test.ts
git commit -m "feat: add the week, outcome and project schemas with the activity nudge and week helpers"
```

---

### Task 3: The weeks and outcomes data module

**Files:**
- Create: `server/exec/weeks/store.ts`, `server/exec/outcomes/store.ts`
- Test: `server/exec/__tests__/weeks-store.test.ts`, `server/exec/__tests__/outcomes-store.test.ts`

**Interfaces:**
- Consumes: `toEntity`, `insertRow`, `updateRow` (Task 1); `ApiError`; `weekStartOf` (`time.ts`), `addDays` (`dates.ts`), `fridayOf` (Task 2); types `Week`, `WeekView`, `WeekLookup`, `Outcome`, `OutcomeCreate`, `OutcomePatch`, `OutcomeStatus`, `ReviewReason` (Task 2).
- Produces:
  - `weeks/store.ts`: `getWeek(db, id): Week | null`, `findWeekByStart(db, startDate): Week | null`, `listOutcomes(db, weekId): Outcome[]` (slotted by slot, then killed, oldest first), `getWeekView(db, id): WeekView | null`, `ensureWeek(db, date, weekStartDay, now): { view: WeekView; created: boolean }`, `lookupWeek(db, date, weekStartDay): WeekLookup`
  - `outcomes/store.ts`: `getOutcome(db, id): Outcome | null`, `addOutcome(db, weekId, input: OutcomeCreate, now): Outcome` (throws `ApiError(409, 'WEEK_FULL', 'the week already has three outcomes', { outcomes })` or `ApiError(400, 'VALIDATION', 'the outcome to replace is not in this week')`), `patchOutcome(db, id, patch: OutcomePatch, now): Outcome | null` (throws `ApiError(400, 'VALIDATION', 'a killed outcome cannot be reopened; add it again')`), `type RollResult = { outcome: Outcome; created: boolean }`, `rollOutcome(db, id, targetWeekId, now): RollResult | null` (throws `404 NOT_FOUND 'no such week'`, `400 VALIDATION 'an outcome cannot be rolled into its own week'`, `400 VALIDATION 'a finished outcome is not rolled forward'`, or `WEEK_FULL`)

- [ ] **Step 1: Write the failing week tests**

Create `server/exec/__tests__/weeks-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek, lookupWeek, getWeekView, findWeekByStart } from '../weeks/store';
import { addOutcome, patchOutcome } from '../outcomes/store';
import type { OutcomeCreate } from '../../../src/shared/exec/schemas';

const T0 = '2026-09-22T03:00:00.000Z';
const T1 = '2026-09-22T03:05:00.000Z';
let db: Database.Database;

const input = (title: string): OutcomeCreate => ({
  title,
  category: 'office',
  description: '',
  definitionOfDone: 'It exists',
  targetDate: null,
  projectId: null,
  notes: '',
});

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('ensureWeek', () => {
  it('creates the week containing the date once, starting on the configured weekday', () => {
    const first = ensureWeek(db, '2026-09-23', 0, T0);
    expect(first.created).toBe(true);
    expect(first.view.week).toMatchObject({ startDate: '2026-09-20', reviewedAt: null, reviewNotes: '', createdAt: T0, updatedAt: T0 });
    expect(first.view.outcomes).toEqual([]);

    const again = ensureWeek(db, '2026-09-26', 0, T1);
    expect(again.created).toBe(false);
    expect(again.view.week.id).toBe(first.view.week.id);

    expect(ensureWeek(db, '2026-09-23', 1, T0).view.week.startDate).toBe('2026-09-21');
  });
});

describe('lookupWeek', () => {
  it('finds nothing and creates nothing on a fresh database', () => {
    expect(lookupWeek(db, '2026-09-23', 0)).toEqual({ current: null, previous: null, hasHistory: false });
    expect(findWeekByStart(db, '2026-09-20')).toBeNull();
  });

  it('returns the current and previous views and reports history from an earlier week', () => {
    const previous = ensureWeek(db, '2026-09-15', 0, T0).view.week;
    addOutcome(db, previous.id, input('Last week'), T0);
    const current = ensureWeek(db, '2026-09-22', 0, T0).view.week;

    const lookup = lookupWeek(db, '2026-09-24', 0);
    expect(lookup.current?.week.id).toBe(current.id);
    expect(lookup.previous?.week.id).toBe(previous.id);
    expect(lookup.previous?.outcomes.map((o) => o.title)).toEqual(['Last week']);
    expect(lookup.hasHistory).toBe(true);
  });

  it("does not count the current week's own outcomes as history", () => {
    const current = ensureWeek(db, '2026-09-22', 0, T0).view.week;
    addOutcome(db, current.id, input('This week'), T0);
    expect(lookupWeek(db, '2026-09-22', 0).hasHistory).toBe(false);
  });
});

describe('getWeekView', () => {
  it('lists slotted outcomes by slot with killed ones last, and returns null for an unknown id', () => {
    const week = ensureWeek(db, '2026-09-22', 0, T0).view.week;
    const a = addOutcome(db, week.id, input('A'), T0);
    addOutcome(db, week.id, input('B'), T0);
    patchOutcome(db, a.id, { status: 'killed' }, T1);
    addOutcome(db, week.id, input('C'), T1); // takes the slot A released
    expect(getWeekView(db, week.id)?.outcomes.map((o) => [o.title, o.slot])).toEqual([
      ['C', 1],
      ['B', 2],
      ['A', null],
    ]);
    expect(getWeekView(db, 'missing')).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing outcome tests**

Create `server/exec/__tests__/outcomes-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome, getOutcome, patchOutcome, rollOutcome } from '../outcomes/store';
import { ApiError } from '../http';
import type { OutcomeCreate } from '../../../src/shared/exec/schemas';

const T0 = '2026-09-22T03:00:00.000Z';
const T1 = '2026-09-22T03:05:00.000Z';
let db: Database.Database;
let weekId: string;

const input = (title: string, overrides: Partial<OutcomeCreate> = {}): OutcomeCreate => ({
  title,
  category: 'office',
  description: '',
  definitionOfDone: 'It exists',
  targetDate: null,
  projectId: null,
  notes: '',
  ...overrides,
});
const fill = (...titles: string[]) => titles.map((title) => addOutcome(db, weekId, input(title), T0));

beforeEach(() => {
  db = prepareExecDb(':memory:');
  weekId = ensureWeek(db, '2026-09-22', 0, T0).view.week.id;
});

describe('addOutcome', () => {
  it('fills the lowest free slot with server-set fields', () => {
    const a = addOutcome(db, weekId, input('A', { targetDate: '2026-09-25' }), T0);
    expect(a).toMatchObject({ weekId, slot: 1, title: 'A', status: 'active', progress: 0, targetDate: '2026-09-25', rolledFromId: null, closedAt: null, createdAt: T0 });
    expect(addOutcome(db, weekId, input('B'), T0).slot).toBe(2);
  });

  it('refuses a fourth outcome with WEEK_FULL listing the three', () => {
    fill('A', 'B', 'C');
    let caught: unknown;
    try {
      addOutcome(db, weekId, input('D'), T0);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ApiError);
    expect(caught).toMatchObject({ status: 409, code: 'WEEK_FULL', message: 'the week already has three outcomes' });
    expect((caught as ApiError).details).toMatchObject({ outcomes: [{ title: 'A' }, { title: 'B' }, { title: 'C' }] });
  });

  it('reuses the slot a killed outcome released', () => {
    const [, b] = fill('A', 'B', 'C');
    patchOutcome(db, b.id, { status: 'killed' }, T1);
    expect(addOutcome(db, weekId, input('D'), T1).slot).toBe(2);
  });

  it('replaces atomically: kills the named outcome with its reason and takes its slot', () => {
    const [, b] = fill('A', 'B', 'C');
    const d = addOutcome(db, weekId, input('D', { replace: { outcomeId: b.id, reason: 'priority_changed' } }), T1);
    expect(d.slot).toBe(2);
    expect(getOutcome(db, b.id)).toMatchObject({ status: 'killed', slot: null, reviewReason: 'priority_changed', closedAt: T1 });
  });

  it('refuses to replace an outcome from another week and changes nothing', () => {
    const otherWeek = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
    const foreign = addOutcome(db, otherWeek, input('Elsewhere'), T0);
    fill('A', 'B', 'C');
    expect(() => addOutcome(db, weekId, input('D', { replace: { outcomeId: foreign.id, reason: 'other' } }), T1)).toThrow(
      /the outcome to replace is not in this week/
    );
    expect(getOutcome(db, foreign.id)?.status).toBe('active');
  });
});

describe('patchOutcome', () => {
  it('edits fields and returns null for an unknown id', () => {
    const [a] = fill('A');
    expect(patchOutcome(db, a.id, { title: 'A2', progress: 60, notes: 'n' }, T1)).toMatchObject({ title: 'A2', progress: 60, notes: 'n', updatedAt: T1 });
    expect(patchOutcome(db, 'missing', { title: 'x' }, T1)).toBeNull();
  });

  it('marking done sets progress 100 and closedAt; reopening clears closedAt and keeps the slot', () => {
    const [a] = fill('A');
    expect(patchOutcome(db, a.id, { status: 'done' }, T1)).toMatchObject({ status: 'done', progress: 100, closedAt: T1, slot: 1 });
    expect(patchOutcome(db, a.id, { status: 'active' }, T1)).toMatchObject({ status: 'active', closedAt: null, slot: 1 });
  });

  it('killing frees the slot and stamps closedAt, and a killed outcome cannot be reopened', () => {
    const [a] = fill('A');
    expect(patchOutcome(db, a.id, { status: 'killed', reviewReason: 'no_longer_important' }, T1)).toMatchObject({
      status: 'killed',
      slot: null,
      closedAt: T1,
      reviewReason: 'no_longer_important',
    });
    expect(() => patchOutcome(db, a.id, { status: 'active' }, T1)).toThrow(/a killed outcome cannot be reopened/);
    expect(patchOutcome(db, a.id, { notes: 'why' }, T1)?.notes).toBe('why');
  });
});

describe('rollOutcome', () => {
  let nextWeekId: string;
  beforeEach(() => {
    nextWeekId = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
  });

  it('copies into the target week with lineage, progress and a Friday target', () => {
    const [a] = fill('A');
    patchOutcome(db, a.id, { progress: 40 }, T0);
    const result = rollOutcome(db, a.id, nextWeekId, T1);
    expect(result?.created).toBe(true);
    expect(result?.outcome).toMatchObject({ weekId: nextWeekId, slot: 1, title: 'A', progress: 40, rolledFromId: a.id, targetDate: '2026-10-02', status: 'active', createdAt: T1 });
    expect(getOutcome(db, a.id)).toMatchObject({ status: 'active', slot: 1 });
  });

  it('returns the existing copy when rolled into the same week again', () => {
    const [a] = fill('A');
    const first = rollOutcome(db, a.id, nextWeekId, T1);
    const second = rollOutcome(db, a.id, nextWeekId, T1);
    expect(second).toMatchObject({ created: false, outcome: { id: first?.outcome.id } });
  });

  it('refuses a finished outcome, its own week and a full target week', () => {
    const [a, b] = fill('A', 'B');
    patchOutcome(db, a.id, { status: 'done' }, T1);
    expect(() => rollOutcome(db, a.id, nextWeekId, T1)).toThrow(/a finished outcome is not rolled forward/);
    expect(() => rollOutcome(db, b.id, weekId, T1)).toThrow(/cannot be rolled into its own week/);
    ['X', 'Y', 'Z'].forEach((title) => addOutcome(db, nextWeekId, input(title), T0));
    expect(() => rollOutcome(db, b.id, nextWeekId, T1)).toThrow(/the week already has three outcomes/);
  });

  it('returns null for an unknown outcome and refuses an unknown week', () => {
    const [a] = fill('A');
    expect(rollOutcome(db, 'missing', nextWeekId, T1)).toBeNull();
    expect(() => rollOutcome(db, a.id, 'missing', T1)).toThrow(/no such week/);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/weeks-store.test.ts server/exec/__tests__/outcomes-store.test.ts`
Expected: FAIL — `../weeks/store` and `../outcomes/store` cannot be resolved.

- [ ] **Step 4: Write the weeks store**

Create `server/exec/weeks/store.ts`:

```ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { toEntity } from '../rows';
import { addDays } from '../../../src/shared/exec/dates';
import { weekStartOf } from '../../../src/shared/exec/time';
import type { Outcome, Week, WeekLookup, WeekView } from '../../../src/shared/exec/schemas';

export function getWeek(db: Database.Database, id: string): Week | null {
  const row = db.prepare('SELECT * FROM weeks WHERE id = ?').get(id);
  return row ? toEntity<Week>(row) : null;
}

export function findWeekByStart(db: Database.Database, startDate: string): Week | null {
  const row = db.prepare('SELECT * FROM weeks WHERE start_date = ?').get(startDate);
  return row ? toEntity<Week>(row) : null;
}

/** Slotted outcomes by slot, then killed ones (slot NULL), oldest first. */
export function listOutcomes(db: Database.Database, weekId: string): Outcome[] {
  return db
    .prepare('SELECT * FROM outcomes WHERE week_id = ? ORDER BY slot IS NULL, slot, created_at, id')
    .all(weekId)
    .map((row) => toEntity<Outcome>(row));
}

const viewOf = (db: Database.Database, week: Week): WeekView => ({ week, outcomes: listOutcomes(db, week.id) });

export function getWeekView(db: Database.Database, id: string): WeekView | null {
  const week = getWeek(db, id);
  return week ? viewOf(db, week) : null;
}

/** Create-or-return the planning week containing `date` (spec B, POST /weeks). */
export function ensureWeek(db: Database.Database, date: string, weekStartDay: number, now: string) {
  const startDate = weekStartOf(date, weekStartDay);
  // Literal columns, bound values; ON CONFLICT makes a repeat call a read.
  const info = db
    .prepare('INSERT INTO weeks (id, start_date, created_at, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT (start_date) DO NOTHING')
    .run(randomUUID(), startDate, now, now);
  return { view: viewOf(db, findWeekByStart(db, startDate) as Week), created: info.changes === 1 };
}

/** Today and /plan in one read: this week, last week, and whether any earlier week ever held an outcome. */
export function lookupWeek(db: Database.Database, date: string, weekStartDay: number): WeekLookup {
  const startDate = weekStartOf(date, weekStartDay);
  const current = findWeekByStart(db, startDate);
  const previous = findWeekByStart(db, addDays(startDate, -7));
  const history = db
    .prepare('SELECT EXISTS (SELECT 1 FROM outcomes o JOIN weeks w ON w.id = o.week_id WHERE w.start_date < ?)')
    .pluck()
    .get(startDate);
  return {
    current: current ? viewOf(db, current) : null,
    previous: previous ? viewOf(db, previous) : null,
    hasHistory: history === 1,
  };
}
```

- [ ] **Step 5: Write the outcomes store**

Create `server/exec/outcomes/store.ts`:

```ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../http';
import { toEntity, insertRow, updateRow } from '../rows';
import { getWeek } from '../weeks/store';
import { fridayOf } from '../../../src/shared/exec/week';
import type { Outcome, OutcomeCreate, OutcomePatch, OutcomeStatus, ReviewReason } from '../../../src/shared/exec/schemas';

const SLOTS = [1, 2, 3] as const;

type OutcomeFields = Omit<OutcomeCreate, 'replace'> & { progress?: number; rolledFromId?: string | null };
type Replace = { outcomeId: string; reason: ReviewReason };
export type RollResult = { outcome: Outcome; created: boolean };

export function getOutcome(db: Database.Database, id: string): Outcome | null {
  const row = db.prepare('SELECT * FROM outcomes WHERE id = ?').get(id);
  return row ? toEntity<Outcome>(row) : null;
}

const slotted = (db: Database.Database, weekId: string): Outcome[] =>
  db
    .prepare('SELECT * FROM outcomes WHERE week_id = ? AND slot IS NOT NULL ORDER BY slot')
    .all(weekId)
    .map((row) => toEntity<Outcome>(row));

function freeSlot(db: Database.Database, weekId: string): number | null {
  const taken = new Set(slotted(db, weekId).map((outcome) => outcome.slot));
  return SLOTS.find((slot) => !taken.has(slot)) ?? null;
}

function killForReplace(db: Database.Database, weekId: string, replace: Replace, now: string): void {
  const target = getOutcome(db, replace.outcomeId);
  if (!target || target.weekId !== weekId || target.slot === null) {
    throw new ApiError(400, 'VALIDATION', 'the outcome to replace is not in this week');
  }
  updateRow(db, 'outcomes', target.id, { status: 'killed', slot: null, reviewReason: replace.reason, closedAt: now, updatedAt: now });
}

/** The three-outcome limit lives here and in UNIQUE (week_id, slot); callers hold a write transaction. */
function insertOutcome(db: Database.Database, weekId: string, fields: OutcomeFields, now: string): Outcome {
  const slot = freeSlot(db, weekId);
  if (slot === null) {
    throw new ApiError(409, 'WEEK_FULL', 'the week already has three outcomes', { outcomes: slotted(db, weekId) });
  }
  const id = randomUUID();
  insertRow(db, 'outcomes', { ...fields, id, weekId, slot, createdAt: now, updatedAt: now });
  return getOutcome(db, id) as Outcome;
}

/** Fills the lowest free slot; with `replace`, kills that outcome and takes its slot in the same transaction. */
export function addOutcome(db: Database.Database, weekId: string, input: OutcomeCreate, now: string): Outcome {
  const { replace, ...fields } = input;
  return db
    .transaction((): Outcome => {
      if (replace) killForReplace(db, weekId, replace, now);
      return insertOutcome(db, weekId, fields, now);
    })
    .immediate();
}

function statusFields(from: OutcomeStatus, to: OutcomeStatus, now: string): Record<string, unknown> {
  if (from === to) return {};
  if (to === 'killed') return { slot: null, closedAt: now };
  if (to === 'done') return { progress: 100, closedAt: now };
  return { closedAt: null };
}

/** Edits an outcome; a status change sets slot, progress and closedAt. Null when it does not exist. */
export function patchOutcome(db: Database.Database, id: string, patch: OutcomePatch, now: string): Outcome | null {
  const current = getOutcome(db, id);
  if (!current) return null;
  const to = patch.status ?? current.status;
  if (current.status === 'killed' && to !== 'killed') {
    throw new ApiError(400, 'VALIDATION', 'a killed outcome cannot be reopened; add it again');
  }
  updateRow(db, 'outcomes', id, { ...patch, ...statusFields(current.status, to, now), updatedAt: now });
  return getOutcome(db, id);
}

/** Carries an outcome into another week with lineage; returns the existing copy if it was already carried there. */
export function rollOutcome(db: Database.Database, id: string, targetWeekId: string, now: string): RollResult | null {
  const source = getOutcome(db, id);
  if (!source) return null;
  const target = getWeek(db, targetWeekId);
  if (!target) throw new ApiError(404, 'NOT_FOUND', 'no such week');
  if (target.id === source.weekId) throw new ApiError(400, 'VALIDATION', 'an outcome cannot be rolled into its own week');
  if (source.status === 'done') throw new ApiError(400, 'VALIDATION', 'a finished outcome is not rolled forward');
  return db
    .transaction((): RollResult => {
      const existing = db
        .prepare("SELECT * FROM outcomes WHERE week_id = ? AND rolled_from_id = ? AND status != 'killed'")
        .get(target.id, source.id);
      if (existing) return { outcome: toEntity<Outcome>(existing), created: false };
      const outcome = insertOutcome(db, target.id, {
        title: source.title,
        category: source.category,
        description: source.description,
        definitionOfDone: source.definitionOfDone,
        targetDate: fridayOf(target.startDate),
        projectId: source.projectId,
        notes: source.notes,
        progress: source.progress,
        rolledFromId: source.id,
      }, now);
      return { outcome, created: true };
    })
    .immediate();
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/weeks-store.test.ts server/exec/__tests__/outcomes-store.test.ts`
Expected: PASS — 5 week tests, 12 outcome tests.

Run: `npx vitest run && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 7: Commit**

```bash
git add server/exec/weeks/store.ts server/exec/outcomes/store.ts server/exec/__tests__/weeks-store.test.ts server/exec/__tests__/outcomes-store.test.ts
git commit -m "feat: add the weeks and outcomes data module with the three-outcome limit, replace and roll"
```

---

### Task 4: Projects data module and routes

**Files:**
- Create: `server/exec/projects/store.ts`
- Modify: `server/exec/routes/projects.ts` (overwrite)
- Test: `server/exec/__tests__/projects-store.test.ts`, `server/exec/__tests__/projects-routes.test.ts`

**Interfaces:**
- Consumes: `toEntity`, `insertRow`, `updateRow`, `placeholders` (Task 1); `OPEN_STATUSES`; types `Project`, `ProjectCreate`, `ProjectPatch`, `ProjectSummary`, `ProjectDetail`, `Outcome`, `Task`; schemas `projectCreateSchema`, `projectPatchSchema` (Task 2); `nowIso`.
- Produces:
  - `projects/store.ts`: `getProject(db, id): Project | null`, `listProjectSummaries(db): ProjectSummary[]` (active first, then done, then archived; by name), `getProjectDetail(db, id): ProjectDetail | null` (outcomes newest week first, with `weekStartDate`; open tasks newest first), `createProject(db, input, now): Project`, `patchProject(db, id, patch, now): Project | null`
  - `routes/projects.ts`: `projectsRouter(db, clock = nowIso)` serving `GET /`, `GET /:id`, `POST /` (201), `PATCH /:id`; unknown id → `404 NOT_FOUND 'no such project'`

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/projects-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { createProject, getProjectDetail, listProjectSummaries, patchProject } from '../projects/store';
import { ensureWeek } from '../weeks/store';
import { addOutcome, patchOutcome } from '../outcomes/store';
import { createTask, patchTask } from '../tasks/store';

const T0 = '2026-09-22T03:00:00.000Z';
const T1 = '2026-09-22T03:05:00.000Z';
let db: Database.Database;

const outcome = (weekId: string, title: string, projectId: string) =>
  addOutcome(db, weekId, { title, category: 'office', description: '', definitionOfDone: 'x', targetDate: null, projectId, notes: '' }, T0);
const task = (title: string, projectId: string) => {
  const created = createTask(db, { title, context: 'work', notes: '' }, T0);
  return patchTask(db, created.id, { projectId, status: 'later' }, T0);
};

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('projects store', () => {
  it('creates a project with defaults and patches it', () => {
    const p = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    expect(p).toMatchObject({ name: 'Supply plan', context: 'work', status: 'active', notes: '', createdAt: T0 });
    expect(patchProject(db, p.id, { status: 'done', notes: 'Shipped' }, T1)).toMatchObject({ status: 'done', notes: 'Shipped', updatedAt: T1 });
    expect(patchProject(db, 'missing', { name: 'x' }, T1)).toBeNull();
  });

  it('summarises each project with active outcomes and open tasks, active projects first', () => {
    const supply = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    const archive = createProject(db, { name: 'Archive me', context: 'work', notes: '' }, T0);
    const pinkbox = createProject(db, { name: 'pinkbox dashboard', context: 'build', notes: '' }, T0);
    patchProject(db, archive.id, { status: 'archived' }, T0);
    const weekId = ensureWeek(db, '2026-09-22', 0, T0).view.week.id;
    const kept = outcome(weekId, 'Delivery plan', supply.id);
    const killed = outcome(weekId, 'Old idea', supply.id);
    patchOutcome(db, killed.id, { status: 'killed' }, T1);
    task('Call supplier', supply.id);
    const done = task('Send tracker', supply.id);
    patchTask(db, done!.id, { status: 'done' }, T1);

    expect(listProjectSummaries(db).map((p) => [p.name, p.activeOutcomes, p.openTasks])).toEqual([
      ['pinkbox dashboard', 0, 0],
      ['Supply plan', 1, 1],
      ['Archive me', 0, 0],
    ]);
    expect(kept.projectId).toBe(supply.id);
    expect(pinkbox.context).toBe('build');
  });

  it('details a project with outcomes by week and open tasks, or null', () => {
    const supply = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    const earlier = ensureWeek(db, '2026-09-15', 0, T0).view.week.id;
    const later = ensureWeek(db, '2026-09-22', 0, T0).view.week.id;
    outcome(earlier, 'First', supply.id);
    outcome(later, 'Second', supply.id);
    task('Call supplier', supply.id);

    const detail = getProjectDetail(db, supply.id);
    expect(detail?.project.name).toBe('Supply plan');
    expect(detail?.outcomes.map((o) => [o.title, o.weekStartDate])).toEqual([
      ['Second', '2026-09-20'],
      ['First', '2026-09-13'],
    ]);
    expect(detail?.tasks.map((t) => t.title)).toEqual(['Call supplier']);
    expect(getProjectDetail(db, 'missing')).toBeNull();
  });
});
```

Create `server/exec/__tests__/projects-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { projectSummarySchema, projectDetailSchema } from '../../../src/shared/exec/schemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const create = async (body: Record<string, unknown>) => {
  const res = await request(app).post('/api/exec/projects').send(body);
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
};

describe('/api/exec/projects', () => {
  it('creates, lists with counts, details and patches a project', async () => {
    const created = await create({ name: '  Supply plan ', context: 'work' });
    const list = await request(app).get('/api/exec/projects');
    expect(list.body.data).toHaveLength(1);
    expect(projectSummarySchema.safeParse(list.body.data[0]).success).toBe(true);
    expect(list.body.data[0]).toMatchObject({ name: 'Supply plan', activeOutcomes: 0, openTasks: 0 });

    const detail = await request(app).get(`/api/exec/projects/${created.id}`);
    expect(projectDetailSchema.safeParse(detail.body.data).success).toBe(true);

    const patched = await request(app).patch(`/api/exec/projects/${created.id}`).send({ status: 'archived' });
    expect(patched.body.data).toMatchObject({ status: 'archived' });
  });

  it('answers 404 for an unknown project on read and write', async () => {
    const missing = { success: false, error: 'no such project', code: 'NOT_FOUND' };
    expect((await request(app).get('/api/exec/projects/nope')).body).toEqual(missing);
    expect((await request(app).patch('/api/exec/projects/nope').send({ name: 'x' })).body).toEqual(missing);
  });

  it('rejects a blank name, an empty patch and unknown keys without echoing them', async () => {
    expect((await request(app).post('/api/exec/projects').send({ name: ' ', context: 'work' })).status).toBe(400);
    const created = await create({ name: 'x', context: 'build' });
    expect((await request(app).patch(`/api/exec/projects/${created.id}`).send({})).status).toBe(400);
    const extra = await request(app).post('/api/exec/projects').send({ name: 'y', context: 'work', ownerSecret: 'z' });
    expect(extra.status).toBe(400);
    expect(JSON.stringify(extra.body)).not.toContain('ownerSecret');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/projects-store.test.ts server/exec/__tests__/projects-routes.test.ts`
Expected: FAIL — `../projects/store` cannot be resolved; `POST /api/exec/projects` answers 404.

- [ ] **Step 3: Write the store**

Create `server/exec/projects/store.ts`:

```ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { toEntity, insertRow, updateRow, placeholders } from '../rows';
import { OPEN_STATUSES } from '../../../src/shared/exec/schemas';
import type { Outcome, Project, ProjectCreate, ProjectDetail, ProjectPatch, ProjectSummary, Task } from '../../../src/shared/exec/schemas';

export function getProject(db: Database.Database, id: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return row ? toEntity<Project>(row) : null;
}

/** Active projects first, then done, then archived; each with its active outcomes and open tasks. */
export function listProjectSummaries(db: Database.Database): ProjectSummary[] {
  return db
    .prepare(
      `SELECT p.*,
         (SELECT COUNT(*) FROM outcomes o WHERE o.project_id = p.id AND o.status = 'active') AS active_outcomes,
         (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status IN (${placeholders(OPEN_STATUSES.length)})) AS open_tasks
       FROM projects p
       ORDER BY CASE p.status WHEN 'active' THEN 0 WHEN 'done' THEN 1 ELSE 2 END, p.name COLLATE NOCASE, p.id`
    )
    .all(...OPEN_STATUSES)
    .map((row) => toEntity<ProjectSummary>(row));
}

/** A project page: outcomes newest week first with the week's start date, and its open tasks. */
export function getProjectDetail(db: Database.Database, id: string): ProjectDetail | null {
  const project = getProject(db, id);
  if (!project) return null;
  const outcomes = db
    .prepare(
      `SELECT o.*, w.start_date AS week_start_date FROM outcomes o JOIN weeks w ON w.id = o.week_id
       WHERE o.project_id = ? ORDER BY w.start_date DESC, o.slot IS NULL, o.slot, o.created_at`
    )
    .all(id)
    .map((row) => toEntity<Outcome & { weekStartDate: string }>(row));
  const tasks = db
    .prepare(`SELECT * FROM tasks WHERE project_id = ? AND status IN (${placeholders(OPEN_STATUSES.length)}) ORDER BY captured_at DESC, id`)
    .all(id, ...OPEN_STATUSES)
    .map((row) => toEntity<Task>(row));
  return { project, outcomes, tasks };
}

export function createProject(db: Database.Database, input: ProjectCreate, now: string): Project {
  const id = randomUUID();
  insertRow(db, 'projects', { ...input, id, createdAt: now, updatedAt: now });
  return getProject(db, id) as Project;
}

export function patchProject(db: Database.Database, id: string, patch: ProjectPatch, now: string): Project | null {
  if (!getProject(db, id)) return null;
  updateRow(db, 'projects', id, { ...patch, updatedAt: now });
  return getProject(db, id);
}
```

- [ ] **Step 4: Write the routes**

Overwrite `server/exec/routes/projects.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { projectCreateSchema, projectPatchSchema } from '../../../src/shared/exec/schemas';
import { listProjectSummaries, getProjectDetail, createProject, patchProject } from '../projects/store';

export function projectsRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such project');

  router.get('/', (_req, res) => ok(res, listProjectSummaries(db)));

  router.get('/:id', (req, res) => {
    const detail = getProjectDetail(db, req.params.id);
    if (!detail) throw notFound();
    ok(res, detail);
  });

  router.post('/', (req, res) => {
    ok(res, createProject(db, projectCreateSchema.parse(req.body), clock()), 201);
  });

  router.patch('/:id', (req, res) => {
    const project = patchProject(db, req.params.id, projectPatchSchema.parse(req.body), clock());
    if (!project) throw notFound();
    ok(res, project);
  });

  return router;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run server/exec`
Expected: PASS — 3 projects-store and 3 projects-routes tests; Phase 2's `settings-routes.test.ts` still sees `GET /api/exec/projects` → `{ success: true, data: [] }`.

Run: `npx vitest run && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 6: Commit**

```bash
git add server/exec/projects/store.ts server/exec/routes/projects.ts server/exec/__tests__/projects-store.test.ts server/exec/__tests__/projects-routes.test.ts
git commit -m "feat: create, list, detail and edit projects under /api/exec"
```

---

### Task 5: The weeks and outcomes routes

**Files:**
- Create: `server/exec/routes/weeks.ts`, `server/exec/routes/outcomes.ts`
- Modify: `server/exec/router.ts`
- Test: `server/exec/__tests__/weeks-routes.test.ts`

**Interfaces:**
- Consumes: Task 3's stores; `getSettings` (Task 1); `weekQuerySchema`, `weekCreateSchema`, `outcomeCreateSchema`, `outcomePatchSchema`, `outcomeRollSchema` (Task 2); `ok`, `ApiError`, `nowIso`.
- Produces: `weeksRouter(db, clock = nowIso)` serving `GET /?date=` (→ `WeekLookup`), `POST /` (201 created / 200 existing, → `WeekView`), `GET /:id` (→ `WeekView`), `POST /:id/outcomes` (201 → `Outcome`); `outcomesRouter(db, clock = nowIso)` serving `PATCH /:id` and `POST /:id/roll` (201 created / 200 existing); both mounted in `createExecRouter` after `/projects`. Unknown ids → `404 NOT_FOUND` with `'no such week'` / `'no such outcome'`.

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/weeks-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type Database from 'better-sqlite3';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { weekViewSchema, weekLookupSchema, outcomeSchema } from '../../../src/shared/exec/schemas';

let app: Express;
let exec: Database.Database;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  exec = prepareExecDb(':memory:');
  app = createApp(legacy, exec);
});

const ensure = async (date = '2026-09-22') => (await request(app).post('/api/exec/weeks').send({ date })).body.data.week.id as string;
const add = (weekId: string, body: Record<string, unknown>) => request(app).post(`/api/exec/weeks/${weekId}/outcomes`).send(body);
const outcome = (title: string) => ({ title, category: 'office', definitionOfDone: 'It exists' });

describe('/api/exec/weeks', () => {
  it('looks a week up without creating it', async () => {
    const res = await request(app).get('/api/exec/weeks?date=2026-09-22');
    expect(res.body).toEqual({ success: true, data: { current: null, previous: null, hasHistory: false } });
    expect(weekLookupSchema.safeParse(res.body.data).success).toBe(true);
    expect(exec.prepare('SELECT COUNT(*) FROM weeks').pluck().get()).toBe(0);
  });

  it('creates the week once (201 then 200) and reads it by id', async () => {
    const first = await request(app).post('/api/exec/weeks').send({ date: '2026-09-23' });
    expect(first.status).toBe(201);
    expect(weekViewSchema.safeParse(first.body.data).success).toBe(true);
    expect(first.body.data.week.startDate).toBe('2026-09-20');
    const second = await request(app).post('/api/exec/weeks').send({ date: '2026-09-26' });
    expect(second.status).toBe(200);
    expect(second.body.data.week.id).toBe(first.body.data.week.id);
    expect((await request(app).get(`/api/exec/weeks/${first.body.data.week.id}`)).body.data.week.startDate).toBe('2026-09-20');
  });

  it('starts the week on the configured weekday', async () => {
    exec.prepare('UPDATE settings SET week_start_day = 1 WHERE id = 1').run();
    const res = await request(app).post('/api/exec/weeks').send({ date: '2026-09-22' });
    expect(res.body.data.week.startDate).toBe('2026-09-21');
  });

  it('answers 404 for an unknown week and 400 for a bad date', async () => {
    const missing = { success: false, error: 'no such week', code: 'NOT_FOUND' };
    expect((await request(app).get('/api/exec/weeks/nope')).body).toEqual(missing);
    expect((await add('nope', outcome('A'))).body).toEqual(missing);
    expect((await request(app).get('/api/exec/weeks?date=2026-09-31')).status).toBe(400);
    expect((await request(app).get('/api/exec/weeks')).status).toBe(400);
  });
});

describe('POST /api/exec/weeks/:id/outcomes', () => {
  it('adds up to three outcomes and refuses a fourth with WEEK_FULL listing them', async () => {
    const weekId = await ensure();
    for (const [index, title] of ['A', 'B', 'C'].entries()) {
      const res = await add(weekId, outcome(title));
      expect(res.status).toBe(201);
      expect(outcomeSchema.safeParse(res.body.data).success).toBe(true);
      expect(res.body.data.slot).toBe(index + 1);
    }
    const fourth = await add(weekId, outcome('D'));
    expect(fourth.status).toBe(409);
    expect(fourth.body).toMatchObject({ success: false, code: 'WEEK_FULL', error: 'the week already has three outcomes' });
    expect(fourth.body.details.outcomes.map((o: { title: string }) => o.title)).toEqual(['A', 'B', 'C']);
  });

  it('replaces an outcome atomically and refuses a replace target from elsewhere', async () => {
    const weekId = await ensure();
    const ids: string[] = [];
    for (const title of ['A', 'B', 'C']) ids.push((await add(weekId, outcome(title))).body.data.id);
    const replaced = await add(weekId, { ...outcome('D'), replace: { outcomeId: ids[1], reason: 'priority_changed' } });
    expect(replaced.status).toBe(201);
    expect(replaced.body.data.slot).toBe(2);
    const view = (await request(app).get(`/api/exec/weeks/${weekId}`)).body.data;
    expect(view.outcomes.map((o: { title: string; status: string }) => [o.title, o.status])).toEqual([
      ['A', 'active'],
      ['D', 'active'],
      ['C', 'active'],
      ['B', 'killed'],
    ]);

    const otherWeek = await ensure('2026-09-29');
    const foreign = (await add(otherWeek, outcome('X'))).body.data.id;
    const refused = await add(weekId, { ...outcome('E'), replace: { outcomeId: foreign, reason: 'other' } });
    expect(refused.body).toEqual({ success: false, error: 'the outcome to replace is not in this week', code: 'VALIDATION' });
  });

  it('rejects a slot, a timestamp or an unknown category in the body', async () => {
    const weekId = await ensure();
    expect((await add(weekId, { ...outcome('A'), slot: 3 })).status).toBe(400);
    expect((await add(weekId, { ...outcome('A'), createdAt: '2026-09-22T03:00:00.000Z' })).status).toBe(400);
    expect((await add(weekId, { title: 'A', category: 'hobby' })).status).toBe(400);
  });
});

describe('/api/exec/outcomes', () => {
  it('patches progress, marks done, and refuses to reopen a killed outcome', async () => {
    const weekId = await ensure();
    const id = (await add(weekId, outcome('A'))).body.data.id;
    expect((await request(app).patch(`/api/exec/outcomes/${id}`).send({ progress: 60 })).body.data.progress).toBe(60);
    expect((await request(app).patch(`/api/exec/outcomes/${id}`).send({ status: 'done' })).body.data).toMatchObject({ status: 'done', progress: 100 });
    await request(app).patch(`/api/exec/outcomes/${id}`).send({ status: 'killed' });
    const reopen = await request(app).patch(`/api/exec/outcomes/${id}`).send({ status: 'active' });
    expect(reopen.body).toEqual({ success: false, error: 'a killed outcome cannot be reopened; add it again', code: 'VALIDATION' });
  });

  it('answers 404 for an unknown outcome and 400 for an empty or slot patch', async () => {
    const missing = { success: false, error: 'no such outcome', code: 'NOT_FOUND' };
    expect((await request(app).patch('/api/exec/outcomes/nope').send({ progress: 1 })).body).toEqual(missing);
    const weekId = await ensure();
    const id = (await add(weekId, outcome('A'))).body.data.id;
    expect((await request(app).patch(`/api/exec/outcomes/${id}`).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/exec/outcomes/${id}`).send({ slot: 2 })).status).toBe(400);
  });

  it('rolls into another week (201), returns the same copy again (200) and 404s unknowns', async () => {
    const weekId = await ensure();
    const nextWeek = await ensure('2026-09-29');
    const id = (await add(weekId, outcome('A'))).body.data.id;
    const first = await request(app).post(`/api/exec/outcomes/${id}/roll`).send({ weekId: nextWeek });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ weekId: nextWeek, rolledFromId: id, targetDate: '2026-10-02' });
    const again = await request(app).post(`/api/exec/outcomes/${id}/roll`).send({ weekId: nextWeek });
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect((await request(app).post('/api/exec/outcomes/nope/roll').send({ weekId: nextWeek })).body.code).toBe('NOT_FOUND');
    const unknownWeek = await request(app).post(`/api/exec/outcomes/${id}/roll`).send({ weekId: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f' });
    expect(unknownWeek.body).toEqual({ success: false, error: 'no such week', code: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run server/exec/__tests__/weeks-routes.test.ts`
Expected: FAIL — every request answers `404 no such endpoint`.

- [ ] **Step 3: Write the routers and mount them**

Create `server/exec/routes/weeks.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { ensureWeek, getWeek, getWeekView, lookupWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { outcomeCreateSchema, weekCreateSchema, weekQuerySchema } from '../../../src/shared/exec/schemas';

export function weeksRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such week');
  const weekStartDay = () => getSettings(db).weekStartDay;

  router.get('/', (req, res) => {
    const { date } = weekQuerySchema.parse(req.query);
    ok(res, lookupWeek(db, date, weekStartDay()));
  });

  router.post('/', (req, res) => {
    const { date } = weekCreateSchema.parse(req.body);
    const { view, created } = ensureWeek(db, date, weekStartDay(), clock());
    ok(res, view, created ? 201 : 200);
  });

  router.get('/:id', (req, res) => {
    const view = getWeekView(db, req.params.id);
    if (!view) throw notFound();
    ok(res, view);
  });

  router.post('/:id/outcomes', (req, res) => {
    const input = outcomeCreateSchema.parse(req.body);
    if (!getWeek(db, req.params.id)) throw notFound();
    ok(res, addOutcome(db, req.params.id, input, clock()), 201);
  });

  return router;
}
```

Create `server/exec/routes/outcomes.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { patchOutcome, rollOutcome } from '../outcomes/store';
import { outcomePatchSchema, outcomeRollSchema } from '../../../src/shared/exec/schemas';

export function outcomesRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such outcome');

  router.patch('/:id', (req, res) => {
    const outcome = patchOutcome(db, req.params.id, outcomePatchSchema.parse(req.body), clock());
    if (!outcome) throw notFound();
    ok(res, outcome);
  });

  router.post('/:id/roll', (req, res) => {
    const { weekId } = outcomeRollSchema.parse(req.body);
    const result = rollOutcome(db, req.params.id, weekId, clock());
    if (!result) throw notFound();
    ok(res, result.outcome, result.created ? 201 : 200);
  });

  return router;
}
```

In `server/exec/router.ts`, add the imports `import { weeksRouter } from './routes/weeks';` and `import { outcomesRouter } from './routes/outcomes';`, and after `router.use('/projects', projectsRouter(db));` add:

```ts
  router.use('/weeks', weeksRouter(db));
  router.use('/outcomes', outcomesRouter(db));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/exec`
Expected: PASS — 10 weeks-routes tests plus every existing server test (Phase 1's `errors.test.ts` still reaches its `extend` routes and the 404 catch-all).

Run: `npx vitest run && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 5: Commit**

```bash
git add server/exec/routes/weeks.ts server/exec/routes/outcomes.ts server/exec/router.ts server/exec/__tests__/weeks-routes.test.ts
git commit -m "feat: serve weeks and outcomes under /api/exec with WEEK_FULL, atomic replace and roll"
```

---

### Task 6: The error surface, week and project hooks, and the Inbox follow-ups

**Files:**
- Create: `src/api/errors.ts`, `src/api/weeks.ts`, `src/lib/useToday.ts`, `src/lib/labels.ts`
- Modify: `src/api/projects.ts` (overwrite), `src/screens/Inbox.tsx`, `src/test/fixtures.ts`, `src/components/CaptureBar.test.tsx`, `src/components/Toast.test.tsx`
- Test: `src/api/errors.test.tsx`, `src/api/weeks.test.tsx`, `src/api/projects.test.tsx`; append to `src/screens/Inbox.test.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError` (`src/api/client.ts`); `toQueryString`; `useToast`; `useSettings`; `localClock`, `toCalendarDate`; Task 2's types; test helpers `stubFetch`, `json`, `failure`, `renderWithProviders`.
- Produces:
  - `errors.ts`: `errorMessage(error: ApiError): string` (friendly text for `NETWORK`, `WEEK_FULL`, `CONSTRAINT`; the server's message otherwise), `useReportError(): (verb: string) => (error: ApiError) => void` (toasts `Could not <verb>: <message>`), `weekFullOutcomes(error: unknown): Outcome[] | null`
  - `weeks.ts`: `weeksKey`, `useWeekLookup(date)`, `type AddOutcomeVariables = { date: string; weekId?: string; input: OutcomeInput }`, `useAddOutcome()`, `useUpdateOutcome()` (variables `{ id, patch }`), `type RollOutcomeVariables = { id: string; date: string; weekId?: string }`, `useRollOutcome()` — every write invalidates `weeksKey` and `projectsKey`
  - `projects.ts`: `projectsKey`, `useProjects()` (→ `ProjectSummary[]`), `useProject(id)` (→ `ProjectDetail`), `useCreateProject()`, `useUpdateProject()` — writes invalidate `projectsKey` and `weeksKey`
  - `useToday.ts`: `useToday(): { today: string; weekStartDay: number }`
  - `labels.ts`: `CATEGORY_LABELS`, `REASON_LABELS`, `PROJECT_STATUS_LABELS`
  - `fixtures.ts`: `WEEK_ID`, `makeOutcome(overrides?)`, `makeWeekView(outcomes?, weekOverrides?)`, `makeLookup(overrides?)`, `makeProjectSummary(overrides?)`

- [ ] **Step 1: Add the fixtures**

Append to `src/test/fixtures.ts`, and extend its type import to `import type { Outcome, ProjectSummary, Settings, Task, Week, WeekLookup, WeekView } from '../shared/exec/schemas';`:

```ts
export const WEEK_ID = '20000000-0000-4000-8000-000000000001';
const STAMP = '2026-09-20T03:00:00.000Z';

/** An outcome as the server returns it; slot 1 in the week of 20 Sep 2026 unless overridden. */
export function makeOutcome(overrides: Partial<Outcome> = {}): Outcome {
  counter += 1;
  return {
    id: `10000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    weekId: WEEK_ID,
    slot: 1,
    title: `Outcome ${counter}`,
    description: '',
    category: 'office',
    definitionOfDone: 'It exists',
    targetDate: '2026-09-25',
    projectId: null,
    progress: 0,
    status: 'active',
    reviewGrade: null,
    reviewReason: null,
    reviewDisposition: null,
    rolledFromId: null,
    notes: '',
    closedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function makeWeekView(outcomes: Outcome[] = [], weekOverrides: Partial<Week> = {}): WeekView {
  return {
    week: { id: WEEK_ID, startDate: '2026-09-20', reviewedAt: null, reviewNotes: '', createdAt: STAMP, updatedAt: STAMP, ...weekOverrides },
    outcomes,
  };
}

export const makeLookup = (overrides: Partial<WeekLookup> = {}): WeekLookup => ({ current: null, previous: null, hasHistory: false, ...overrides });

export function makeProjectSummary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  counter += 1;
  return {
    id: `30000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    name: `Project ${counter}`,
    context: 'work',
    status: 'active',
    notes: '',
    createdAt: STAMP,
    updatedAt: STAMP,
    activeOutcomes: 0,
    openTasks: 0,
    ...overrides,
  };
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/api/errors.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ApiError } from './client';
import { errorMessage, useReportError, weekFullOutcomes } from './errors';
import { ToastProvider } from '../components/Toast';
import { makeOutcome } from '../test/fixtures';

describe('errorMessage', () => {
  it('uses friendly text for the codes a person can act on and the server text otherwise', () => {
    expect(errorMessage(new ApiError(0, 'NETWORK', 'The local API is not reachable'))).toBe('the local API is not reachable');
    expect(errorMessage(new ApiError(409, 'WEEK_FULL', 'the week already has three outcomes'))).toBe('this week already has three outcomes');
    expect(errorMessage(new ApiError(400, 'VALIDATION', 'invalid request body'))).toBe('invalid request body');
  });
});

describe('useReportError', () => {
  it('returns an onError that toasts what failed and why', () => {
    const wrapper = ({ children }: { children: ReactNode }) => <ToastProvider>{children}</ToastProvider>;
    const { result } = renderHook(() => useReportError(), { wrapper });
    act(() => result.current('save')(new ApiError(500, 'INTERNAL', 'internal server error')));
    expect(screen.getByRole('status')).toHaveTextContent('Could not save: internal server error');
  });
});

describe('weekFullOutcomes', () => {
  it('extracts the three outcomes from a WEEK_FULL refusal and nothing from anything else', () => {
    const outcomes = [makeOutcome(), makeOutcome({ slot: 2 }), makeOutcome({ slot: 3 })];
    expect(weekFullOutcomes(new ApiError(409, 'WEEK_FULL', 'full', { outcomes }))).toEqual(outcomes);
    expect(weekFullOutcomes(new ApiError(400, 'VALIDATION', 'bad'))).toBeNull();
    expect(weekFullOutcomes(new Error('boom'))).toBeNull();
  });
});
```

Create `src/api/weeks.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useWeekLookup, useAddOutcome, useUpdateOutcome, useRollOutcome } from './weeks';
import { stubFetch, json } from '../test/fetch';
import { WEEK_ID, makeLookup, makeOutcome, makeWeekView } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);
const input = { title: 'Supplier plan confirmed', category: 'office' as const, definitionOfDone: 'Dates confirmed' };

afterEach(() => vi.unstubAllGlobals());

describe('useWeekLookup', () => {
  it('reads the week containing a date', async () => {
    const calls = stubFetch(() => json(makeLookup({ hasHistory: true })));
    const { result } = renderHook(() => useWeekLookup('2026-09-22'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.hasHistory).toBe(true);
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/exec/weeks?date=2026-09-22' });
  });
});

describe('outcome mutations', () => {
  it('creates the week first when there is none, then adds the outcome', async () => {
    const calls = stubFetch((url) => (url === '/api/exec/weeks' ? json(makeWeekView(), 201) : json(makeOutcome(), 201)));
    const { result } = renderHook(() => useAddOutcome(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ date: '2026-09-22', input });
    });
    expect(calls.map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', '/api/exec/weeks', { date: '2026-09-22' }],
      ['POST', `/api/exec/weeks/${WEEK_ID}/outcomes`, input],
    ]);
  });

  it('adds straight to a known week, patches and rolls', async () => {
    const calls = stubFetch((url) => (url === '/api/exec/weeks' ? json(makeWeekView()) : json(makeOutcome())));
    const { result } = renderHook(() => ({ add: useAddOutcome(), update: useUpdateOutcome(), roll: useRollOutcome() }), { wrapper });
    await act(async () => {
      await result.current.add.mutateAsync({ date: '2026-09-22', weekId: 'w1', input });
      await result.current.update.mutateAsync({ id: 'o1', patch: { progress: 60 } });
      await result.current.roll.mutateAsync({ id: 'o2', date: '2026-09-22' });
    });
    expect(calls.map((c) => [c.method, c.url])).toEqual([
      ['POST', '/api/exec/weeks/w1/outcomes'],
      ['PATCH', '/api/exec/outcomes/o1'],
      ['POST', '/api/exec/weeks'],
      ['POST', '/api/exec/outcomes/o2/roll'],
    ]);
    expect(calls[1].body).toEqual({ progress: 60 });
    expect(calls[3].body).toEqual({ weekId: WEEK_ID });
  });
});
```

Create `src/api/projects.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useProject, useCreateProject, useUpdateProject } from './projects';
import { stubFetch, json } from '../test/fetch';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('project hooks', () => {
  it('reads one project, creates and updates', async () => {
    const calls = stubFetch(() => json({ project: { id: 'p1' }, outcomes: [], tasks: [] }));
    const { result } = renderHook(() => ({ detail: useProject('p1'), create: useCreateProject(), update: useUpdateProject() }), { wrapper });
    await waitFor(() => expect(result.current.detail.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({ name: 'Supply plan', context: 'work' });
      await result.current.update.mutateAsync({ id: 'p1', patch: { status: 'archived' } });
    });
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/exec/projects/p1' });
    // Each write invalidates and refetches the open detail query, so reads interleave; check the writes alone.
    expect(calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', '/api/exec/projects', { name: 'Supply plan', context: 'work' }],
      ['PATCH', '/api/exec/projects/p1', { status: 'archived' }],
    ]);
  });
});
```

Append to `src/screens/Inbox.test.tsx`, inside `describe('/inbox', …)`:

```tsx
  it('starts the selection at the first row when the tab changes', async () => {
    fakeApi([makeTask({ title: 'A' }), makeTask({ title: 'B' }), makeTask({ title: 'P1', status: 'later' }), makeTask({ title: 'P2', status: 'later' })]);
    renderRoute('/inbox');
    await screen.findByText('2 to process');
    await userEvent.keyboard('j');
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByRole('tab', { name: 'Later' }));
    await screen.findByText('2 parked');
    expect(rows()[0]).toHaveAttribute('aria-selected', 'true');
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project jsdom`
Expected: FAIL — `./errors` and `./weeks` cannot be resolved; `useProject`, `useCreateProject`, `useUpdateProject` are not exported; the Inbox selection stays on row 2 after the tab switch.

- [ ] **Step 4: Write the error surface, labels and today hook**

Create `src/api/errors.ts`:

```ts
import { useCallback } from 'react';
import { ApiError } from './client';
import { useToast } from '../components/Toast';
import type { Outcome } from '../shared/exec/schemas';

const FRIENDLY: Partial<Record<ApiError['code'], string>> = {
  NETWORK: 'the local API is not reachable',
  WEEK_FULL: 'this week already has three outcomes',
  CONSTRAINT: 'that conflicts with saved data',
};

export const errorMessage = (error: ApiError): string => FRIENDLY[error.code] ?? error.message;

/** `report('save')` is an onError that toasts "Could not save: <reason>". */
export function useReportError(): (verb: string) => (error: ApiError) => void {
  const toast = useToast();
  return useCallback((verb: string) => (error: ApiError) => toast.show(`Could not ${verb}: ${errorMessage(error)}`), [toast]);
}

/** The outcomes a WEEK_FULL refusal carries, so a form can offer the replace prompt; null for any other error. */
export function weekFullOutcomes(error: unknown): Outcome[] | null {
  if (!(error instanceof ApiError) || error.code !== 'WEEK_FULL') return null;
  const details = error.details as { outcomes?: Outcome[] } | undefined;
  return details?.outcomes ?? [];
}
```

Create `src/lib/labels.ts`:

```ts
import type { OutcomeCategory, ProjectStatus, ReviewReason } from '../shared/exec/schemas';

export const CATEGORY_LABELS: Record<OutcomeCategory, string> = {
  office: 'Office',
  business: 'Business',
  career: 'Career',
  personal: 'Personal',
};

export const REASON_LABELS: Record<ReviewReason, string> = {
  insufficient_time: 'Not enough time',
  unexpected_urgent_work: 'Urgent work came up',
  dependency_blocker: 'Blocked by a dependency',
  poor_estimation: 'Underestimated',
  too_many_meetings: 'Too many meetings',
  priority_changed: 'Priority changed',
  procrastination: 'Put it off',
  unclear_outcome: 'Outcome was unclear',
  delegated_dependency: 'Waiting on someone',
  no_longer_important: 'No longer important',
  other: 'Other',
};

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  done: 'Done',
  archived: 'Archived',
};
```

Create `src/lib/useToday.ts`:

```ts
import { useSettings } from '../api/settings';
import { toCalendarDate } from '../shared/exec/dates';
import { localClock } from '../shared/exec/time';

/** Today's calendar date in the settings time zone (the UTC date until settings arrive) and the week's first weekday. */
export function useToday(): { today: string; weekStartDay: number } {
  const settings = useSettings();
  const zone = settings.data?.timezone;
  const now = new Date();
  return {
    today: zone ? localClock(now, zone).date : toCalendarDate(now),
    weekStartDay: settings.data?.weekStartDay ?? 0,
  };
}
```

- [ ] **Step 5: Write the week and project hooks**

Create `src/api/weeks.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Outcome, OutcomeInput, OutcomePatch, WeekLookup, WeekView } from '../shared/exec/schemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { projectsKey } from './projects';

export const weeksKey = ['exec', 'weeks'] as const;

export type AddOutcomeVariables = { date: string; weekId?: string; input: OutcomeInput };
export type RollOutcomeVariables = { id: string; date: string; weekId?: string };

export function useWeekLookup(date: string) {
  return useQuery<WeekLookup, ApiError>({
    queryKey: [...weeksKey, 'lookup', date],
    queryFn: () => api.get<WeekLookup>(`/weeks${toQueryString({ date })}`),
  });
}

/** Weeks and projects both show outcomes, so every outcome write refreshes both. */
function useOutcomeMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: weeksKey }), queryClient.invalidateQueries({ queryKey: projectsKey })]),
  });
}

/** POST /weeks is create-or-return, so the first outcome of a week brings the week into being. */
const weekIdFor = async (date: string, weekId?: string): Promise<string> =>
  weekId ?? (await api.post<WeekView>('/weeks', { date })).week.id;

export const useAddOutcome = () =>
  useOutcomeMutation(async ({ date, weekId, input }: AddOutcomeVariables) =>
    api.post<Outcome>(`/weeks/${await weekIdFor(date, weekId)}/outcomes`, input)
  );

export const useUpdateOutcome = () =>
  useOutcomeMutation(({ id, patch }: { id: string; patch: OutcomePatch }) => api.patch<Outcome>(`/outcomes/${id}`, patch));

export const useRollOutcome = () =>
  useOutcomeMutation(async ({ id, date, weekId }: RollOutcomeVariables) =>
    api.post<Outcome>(`/outcomes/${id}/roll`, { weekId: await weekIdFor(date, weekId) })
  );
```

Overwrite `src/api/projects.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Project, ProjectDetail, ProjectInput, ProjectPatch, ProjectSummary } from '../shared/exec/schemas';
import { api, ApiError } from './client';

export const projectsKey = ['exec', 'projects'] as const;
// Kept literal here: weeks.ts imports projectsKey, so importing weeksKey back would be a cycle.
const weeksKey = ['exec', 'weeks'] as const;

export function useProjects() {
  return useQuery<ProjectSummary[], ApiError>({ queryKey: projectsKey, queryFn: () => api.get<ProjectSummary[]>('/projects') });
}

export function useProject(id: string) {
  return useQuery<ProjectDetail, ApiError>({ queryKey: [...projectsKey, id], queryFn: () => api.get<ProjectDetail>(`/projects/${id}`) });
}

function useProjectMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Project>) {
  const queryClient = useQueryClient();
  return useMutation<Project, ApiError, TVariables>({
    mutationFn,
    onSuccess: () =>
      Promise.all([queryClient.invalidateQueries({ queryKey: projectsKey }), queryClient.invalidateQueries({ queryKey: weeksKey })]),
  });
}

export const useCreateProject = () => useProjectMutation((input: ProjectInput) => api.post<Project>('/projects', input));

export const useUpdateProject = () =>
  useProjectMutation(({ id, patch }: { id: string; patch: ProjectPatch }) => api.patch<Project>(`/projects/${id}`, patch));
```

- [ ] **Step 6: Move the Inbox onto the error surface and reset its selection; import the shared toast text**

In `src/screens/Inbox.tsx`:
- Replace `import { useToast } from '../components/Toast';` with `import { useToast } from '../components/Toast';` plus `import { useReportError } from '../api/errors';`, and delete `import type { ApiError } from '../api/client';`.
- Replace the line `const report = (verb: string) => (error: ApiError) => toast.show(\`Could not ${verb}: ${error.message}\`);` with `const report = useReportError();`.
- Change the tab button's `onClick={() => { setTab(t.id); setPanel(null); }}` to `onClick={() => { setTab(t.id); setPanel(null); setSelected(0); }}`.

In `src/components/CaptureBar.test.tsx`, change the import `import { CaptureBar } from './CaptureBar';` to `import { CaptureBar, CAPTURED_MESSAGE } from './CaptureBar';` and the assertion `.toHaveTextContent('Captured. It is in the Inbox, not on Today.')` to `.toHaveTextContent(CAPTURED_MESSAGE)`.

In `src/components/Toast.test.tsx`, add `import { CAPTURED_MESSAGE } from './CaptureBar';` and replace both literal occurrences of `'Captured. It is in the Inbox, not on Today.'` with `CAPTURED_MESSAGE`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run --project jsdom`
Expected: PASS — 3 errors, 3 weeks, 1 projects, the new Inbox test, and every existing client test (the Inbox failure test still reads `Could not update: internal server error`).

Run: `npx vitest run && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 8: Commit**

```bash
git add src/api/errors.ts src/api/weeks.ts src/api/projects.ts src/lib/useToday.ts src/lib/labels.ts src/test/fixtures.ts src/screens/Inbox.tsx src/components/CaptureBar.test.tsx src/components/Toast.test.tsx src/api/errors.test.tsx src/api/weeks.test.tsx src/api/projects.test.tsx src/screens/Inbox.test.tsx
git commit -m "feat: add the week and project hooks with a code-aware error surface"
```

---

### Task 7: The outcome components

**Files:**
- Create: `src/components/outcomes/NudgeLine.tsx`, `src/components/outcomes/ReasonSelect.tsx`, `src/components/outcomes/OutcomeForm.tsx`, `src/components/outcomes/OutcomeCard.tsx`, `src/components/outcomes/ReplacePicker.tsx`
- Test: `src/components/outcomes/OutcomeForm.test.tsx`, `src/components/outcomes/OutcomeCard.test.tsx`, `src/components/outcomes/ReplacePicker.test.tsx`

**Interfaces:**
- Consumes: `needsNudge`, `isActivityTitle`, `NUDGE_MESSAGE` (Task 2); `OUTCOME_CATEGORIES`, `REVIEW_REASONS` and types; `CATEGORY_LABELS`, `REASON_LABELS` (Task 6); `useProjects` (Task 6); test helpers.
- Produces:
  - `NudgeLine({ show })` — `<p role="note">` with `NUDGE_MESSAGE`, or nothing
  - `ReasonSelect({ label, value, onChange })` — a labelled `<select>` of the eleven reasons
  - `OutcomeForm({ initial?, defaultTargetDate, submitLabel, requireDefinition?, pending?, onSubmit, onCancel? })` — a form named `submitLabel` with fields labelled "Outcome", "Category", "Definition of done", "Target date", "Project"; `onSubmit` receives `OutcomeInput` without `replace`
  - `OutcomeCard({ outcome, onUpdate, onKill })` — an `<article>` named by the title with a progress slider labelled `Progress for <title>` (committed on blur, pointer-up or key-up), actions "Mark done" / "Reopen", "Edit", "Kill"
  - `ReplacePicker({ outcomes, pending?, onPick, onCancel })` — a form named "Replace an outcome": one radio per outcome, a reason, and "Replace"

- [ ] **Step 1: Write the failing tests**

Create `src/components/outcomes/OutcomeForm.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutcomeForm } from './OutcomeForm';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { makeProjectSummary } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const active = makeProjectSummary({ name: 'September supply plan' });
const archived = makeProjectSummary({ name: 'Old plan', status: 'archived' });

function renderForm(props: Partial<Parameters<typeof OutcomeForm>[0]> = {}) {
  stubFetch(() => json([active, archived]));
  const onSubmit = vi.fn();
  renderWithProviders(<OutcomeForm defaultTargetDate="2026-09-25" submitLabel="Add outcome" onSubmit={onSubmit} {...props} />);
  return onSubmit;
}

describe('OutcomeForm', () => {
  it('submits a trimmed outcome with the default target date and no project', async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText('Outcome'), '  Supplier delivery plan confirmed ');
    await userEvent.type(screen.getByLabelText('Definition of done'), 'Dates confirmed for the top 20 suppliers');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    expect(onSubmit).toHaveBeenCalledWith({
      title: 'Supplier delivery plan confirmed',
      category: 'office',
      definitionOfDone: 'Dates confirmed for the top 20 suppliers',
      targetDate: '2026-09-25',
      projectId: null,
    });
  });

  it('nudges an activity title, moves focus to the definition of done, and still saves', async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText('Outcome'), 'Work on supplier meetings');
    expect(screen.getByRole('note')).toHaveTextContent('This sounds like an activity. What will exist when it is finished?');
    // A blur event, not userEvent.tab(): tab would move focus on to the next field after the handler runs.
    fireEvent.blur(screen.getByLabelText('Outcome'));
    expect(screen.getByLabelText('Definition of done')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    expect(onSubmit).toHaveBeenCalledOnce();
  });

  it('requires a definition of done only when asked to', async () => {
    const onSubmit = renderForm({ requireDefinition: true });
    await userEvent.type(screen.getByLabelText('Outcome'), 'Pinkbox P&L dashboard live');
    expect(screen.getByRole('button', { name: 'Add outcome' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Definition of done'), 'Dashboard shows live franchise data');
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Business');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: 'business' }));
  });

  it('offers only active projects', async () => {
    const onSubmit = renderForm();
    await waitFor(() => expect(screen.getByRole('option', { name: 'September supply plan' })).toBeInTheDocument());
    expect(screen.queryByRole('option', { name: 'Old plan' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Project'), 'September supply plan');
    await userEvent.type(screen.getByLabelText('Outcome'), 'Tracker sent');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ projectId: active.id }));
  });
});
```

Create `src/components/outcomes/OutcomeCard.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutcomeCard } from './OutcomeCard';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { makeOutcome } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

function renderCard(overrides = {}) {
  stubFetch(() => json([]));
  const outcome = makeOutcome({ title: 'Supplier plan confirmed', definitionOfDone: 'Dates for the top 20', progress: 40, ...overrides });
  const onUpdate = vi.fn();
  const onKill = vi.fn();
  renderWithProviders(<OutcomeCard outcome={outcome} onUpdate={onUpdate} onKill={onKill} />);
  return { outcome, onUpdate, onKill, card: screen.getByRole('article', { name: 'Supplier plan confirmed' }) };
}

describe('OutcomeCard', () => {
  it('shows the category, the target and the folded definition of done', () => {
    const { card } = renderCard();
    expect(card).toHaveTextContent('Office');
    expect(card).toHaveTextContent('Target 2026-09-25');
    expect(within(card).getByText('Definition of done')).toBeInTheDocument();
  });

  it('commits a progress change when the slider is released, not on every step', () => {
    const { onUpdate } = renderCard();
    const slider = screen.getByLabelText('Progress for Supplier plan confirmed');
    fireEvent.change(slider, { target: { value: '60' } });
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.blur(slider);
    expect(onUpdate).toHaveBeenCalledWith({ progress: 60 });
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('marks done and reopens', async () => {
    const { onUpdate } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Mark done' }));
    expect(onUpdate).toHaveBeenCalledWith({ status: 'done' });
  });

  it('offers Reopen on a done outcome and disables its slider', async () => {
    const { onUpdate } = renderCard({ status: 'done', progress: 100 });
    expect(screen.getByLabelText('Progress for Supplier plan confirmed')).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Reopen' }));
    expect(onUpdate).toHaveBeenCalledWith({ status: 'active' });
  });

  it('kills with a reason', async () => {
    const { onKill } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Kill' }));
    await userEvent.selectOptions(screen.getByLabelText('Why does it go?'), 'No longer important');
    await userEvent.click(screen.getByRole('button', { name: 'Kill outcome' }));
    expect(onKill).toHaveBeenCalledWith('no_longer_important');
  });

  it('edits through the outcome form', async () => {
    const { onUpdate } = renderCard();
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText('Outcome');
    await userEvent.clear(title);
    await userEvent.type(title, 'Supplier plan published');
    await userEvent.click(screen.getByRole('button', { name: 'Save outcome' }));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ title: 'Supplier plan published', definitionOfDone: 'Dates for the top 20' }));
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });
});
```

Create `src/components/outcomes/ReplacePicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReplacePicker } from './ReplacePicker';
import { makeOutcome } from '../../test/fixtures';

describe('ReplacePicker', () => {
  it('asks which outcome gives up its slot and why', async () => {
    const outcomes = [makeOutcome({ title: 'A' }), makeOutcome({ title: 'B', slot: 2 }), makeOutcome({ title: 'C', slot: 3 })];
    const onPick = vi.fn();
    render(<ReplacePicker outcomes={outcomes} onPick={onPick} onCancel={() => {}} />);
    const form = screen.getByRole('form', { name: 'Replace an outcome' });
    expect(form).toHaveTextContent('This week already has three outcomes. Which one gives up its slot?');
    await userEvent.click(screen.getByRole('radio', { name: 'B' }));
    await userEvent.selectOptions(screen.getByLabelText('Why does it give way?'), 'Urgent work came up');
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(onPick).toHaveBeenCalledWith(outcomes[1].id, 'unexpected_urgent_work');
  });

  it('defaults to the first outcome and "Priority changed"', async () => {
    const outcomes = [makeOutcome({ title: 'A' })];
    const onPick = vi.fn();
    render(<ReplacePicker outcomes={outcomes} onPick={onPick} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(onPick).toHaveBeenCalledWith(outcomes[0].id, 'priority_changed');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/outcomes`
Expected: FAIL — the component modules cannot be resolved.

- [ ] **Step 3: Write the small pieces**

Create `src/components/outcomes/NudgeLine.tsx`:

```tsx
import { NUDGE_MESSAGE } from '../../shared/exec/nudge';

/** One quiet line of coaching under a title (§9). It never blocks a save. */
export function NudgeLine({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <p role="note" className="text-sm text-ink-muted">
      {NUDGE_MESSAGE}
    </p>
  );
}
```

Create `src/components/outcomes/ReasonSelect.tsx`:

```tsx
import { useId } from 'react';
import { REVIEW_REASONS, type ReviewReason } from '../../shared/exec/schemas';
import { REASON_LABELS } from '../../lib/labels';

type Props = { label: string; value: ReviewReason; onChange: (value: ReviewReason) => void };

export function ReasonSelect({ label, value, onChange }: Props) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as ReviewReason)} className="rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink">
        {REVIEW_REASONS.map((reason) => (
          <option key={reason} value={reason}>
            {REASON_LABELS[reason]}
          </option>
        ))}
      </select>
    </div>
  );
}
```

Create `src/components/outcomes/ReplacePicker.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import type { Outcome, ReviewReason } from '../../shared/exec/schemas';
import { ReasonSelect } from './ReasonSelect';

type Props = { outcomes: Outcome[]; pending?: boolean; onPick: (outcomeId: string, reason: ReviewReason) => void; onCancel: () => void };

/** A fourth outcome is never added, only swapped in (§4). */
export function ReplacePicker({ outcomes, pending = false, onPick, onCancel }: Props) {
  const [choice, setChoice] = useState(outcomes[0]?.id ?? '');
  const [reason, setReason] = useState<ReviewReason>('priority_changed');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (choice) onPick(choice, reason);
  };
  return (
    <form aria-label="Replace an outcome" onSubmit={submit} className="space-y-3 rounded-lg border border-line p-4 dark:border-ink-muted">
      <p>This week already has three outcomes. Which one gives up its slot?</p>
      <fieldset className="space-y-1">
        <legend className="sr-only">Outcome to replace</legend>
        {outcomes.map((outcome) => (
          <label key={outcome.id} className="flex items-center gap-2">
            <input type="radio" name="replace-outcome" value={outcome.id} checked={choice === outcome.id} onChange={() => setChoice(outcome.id)} />
            {outcome.title}
          </label>
        ))}
      </fieldset>
      <ReasonSelect label="Why does it give way?" value={reason} onChange={setReason} />
      <div className="flex gap-2">
        <button type="submit" disabled={!choice || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
          Replace
        </button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Write the form**

Create `src/components/outcomes/OutcomeForm.tsx`:

```tsx
import { useId, useRef, useState, type FormEvent } from 'react';
import { OUTCOME_CATEGORIES, type OutcomeCategory, type OutcomeInput } from '../../shared/exec/schemas';
import { isActivityTitle, needsNudge } from '../../shared/exec/nudge';
import { CATEGORY_LABELS } from '../../lib/labels';
import { useProjects } from '../../api/projects';
import { NudgeLine } from './NudgeLine';

type Props = {
  initial?: Partial<OutcomeInput>;
  defaultTargetDate: string;
  submitLabel: string;
  requireDefinition?: boolean;
  pending?: boolean;
  onSubmit: (input: OutcomeInput) => void;
  onCancel?: () => void;
};

const FIELD = 'w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink';

function useOutcomeFields(initial: Partial<OutcomeInput>, defaultTargetDate: string) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [category, setCategory] = useState<OutcomeCategory>(initial.category ?? 'office');
  const [definition, setDefinition] = useState(initial.definitionOfDone ?? '');
  const [targetDate, setTargetDate] = useState(initial.targetDate ?? defaultTargetDate);
  const [projectId, setProjectId] = useState(initial.projectId ?? '');
  const value: OutcomeInput = {
    title: title.trim(),
    category,
    definitionOfDone: definition.trim(),
    targetDate: targetDate || null,
    projectId: projectId || null,
  };
  return { title, setTitle, category, setCategory, definition, setDefinition, targetDate, setTargetDate, projectId, setProjectId, value };
}

/** Title, category, definition of done, target date, project. The nudge coaches (§9); it never blocks. */
export function OutcomeForm({ initial = {}, defaultTargetDate, submitLabel, requireDefinition = false, pending = false, onSubmit, onCancel }: Props) {
  const id = useId();
  const f = useOutcomeFields(initial, defaultTargetDate);
  const projects = (useProjects().data ?? []).filter((project) => project.status === 'active');
  const definitionRef = useRef<HTMLTextAreaElement>(null);
  const blocked = f.value.title === '' || (requireDefinition && f.value.definitionOfDone === '');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!blocked && !pending) onSubmit(f.value);
  };
  return (
    <form aria-label={submitLabel} onSubmit={submit} className="space-y-2 rounded-lg border border-line p-4 dark:border-ink-muted">
      <label htmlFor={`${id}-title`} className="block text-sm">Outcome</label>
      <input id={`${id}-title`} value={f.title} onChange={(e) => f.setTitle(e.target.value)} onBlur={() => isActivityTitle(f.title) && definitionRef.current?.focus()} placeholder="What will exist when this is finished?" className={FIELD} />
      <NudgeLine show={needsNudge(f.title, f.definition)} />
      <label htmlFor={`${id}-category`} className="block text-sm">Category</label>
      <select id={`${id}-category`} value={f.category} onChange={(e) => f.setCategory(e.target.value as OutcomeCategory)} className={FIELD}>
        {OUTCOME_CATEGORIES.map((category) => <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>)}
      </select>
      <label htmlFor={`${id}-definition`} className="block text-sm">Definition of done</label>
      <textarea id={`${id}-definition`} ref={definitionRef} rows={2} value={f.definition} onChange={(e) => f.setDefinition(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-target`} className="block text-sm">Target date</label>
      <input id={`${id}-target`} type="date" value={f.targetDate} onChange={(e) => f.setTargetDate(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-project`} className="block text-sm">Project</label>
      <select id={`${id}-project`} value={f.projectId} onChange={(e) => f.setProjectId(e.target.value)} className={FIELD}>
        <option value="">No project</option>
        {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={blocked || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>}
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Write the card**

Create `src/components/outcomes/OutcomeCard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import type { Outcome, OutcomePatch, ReviewReason } from '../../shared/exec/schemas';
import { CATEGORY_LABELS } from '../../lib/labels';
import { OutcomeForm } from './OutcomeForm';
import { ReasonSelect } from './ReasonSelect';

type Props = { outcome: Outcome; onUpdate: (patch: OutcomePatch) => void; onKill: (reason: ReviewReason) => void };

const BUTTON = 'rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink dark:border-ink-muted dark:hover:text-paper';

function KillPrompt({ onConfirm, onCancel }: { onConfirm: (reason: ReviewReason) => void; onCancel: () => void }) {
  const [reason, setReason] = useState<ReviewReason>('priority_changed');
  return (
    <div className="space-y-2 pt-2">
      <ReasonSelect label="Why does it go?" value={reason} onChange={setReason} />
      <div className="flex gap-2">
        <button type="button" className={BUTTON} onClick={() => onConfirm(reason)}>Kill outcome</button>
        <button type="button" className={BUTTON} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

/** One of the week's three outcomes (spec C "Week" item 2). Progress is set by hand, committed when released. */
export function OutcomeCard({ outcome, onUpdate, onKill }: Props) {
  const [mode, setMode] = useState<'view' | 'edit' | 'kill'>('view');
  const [progress, setProgress] = useState(outcome.progress);
  useEffect(() => setProgress(outcome.progress), [outcome.progress]);
  const done = outcome.status === 'done';
  const commit = () => progress !== outcome.progress && onUpdate({ progress });

  if (mode === 'edit') {
    return (
      <OutcomeForm
        initial={outcome}
        defaultTargetDate={outcome.targetDate ?? ''}
        submitLabel="Save outcome"
        onCancel={() => setMode('view')}
        onSubmit={(input) => {
          onUpdate({ title: input.title, category: input.category, definitionOfDone: input.definitionOfDone, targetDate: input.targetDate, projectId: input.projectId });
          setMode('view');
        }}
      />
    );
  }
  return (
    <article aria-label={outcome.title} className="space-y-2 rounded-lg border border-line bg-paper-raised p-4 dark:border-ink-muted dark:bg-ink">
      <p className="text-xs uppercase tracking-wide text-ink-muted">{CATEGORY_LABELS[outcome.category]} · Outcome {outcome.slot}{done && ' · Done'}</p>
      <h3 className="text-lg font-medium">{outcome.title}</h3>
      <div className="flex items-center gap-3">
        <input type="range" min={0} max={100} step={10} value={progress} disabled={done} aria-label={`Progress for ${outcome.title}`} onChange={(e) => setProgress(Number(e.target.value))} onPointerUp={commit} onKeyUp={commit} onBlur={commit} className="flex-1" />
        <span className="w-12 text-right text-sm text-ink-muted">{progress}%</span>
      </div>
      {outcome.definitionOfDone && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-muted">Definition of done</summary>
          <p className="pt-1">{outcome.definitionOfDone}</p>
        </details>
      )}
      {outcome.targetDate && <p className="text-sm text-ink-muted">Target {outcome.targetDate}</p>}
      {mode === 'kill' ? (
        <KillPrompt onCancel={() => setMode('view')} onConfirm={(reason) => { onKill(reason); setMode('view'); }} />
      ) : (
        <div className="flex gap-2 pt-1">
          <button type="button" className={BUTTON} onClick={() => onUpdate({ status: done ? 'active' : 'done' })}>{done ? 'Reopen' : 'Mark done'}</button>
          <button type="button" className={BUTTON} onClick={() => setMode('edit')}>Edit</button>
          <button type="button" className={BUTTON} onClick={() => setMode('kill')}>Kill</button>
        </div>
      )}
    </article>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/outcomes`
Expected: PASS — 4 form, 6 card, 2 picker tests.

Run: `npx vitest run && npm run lint`
Expected: all green; lint clean. If `OutcomeCard`'s `initial={outcome}` fails strict type-checking because `Outcome` carries fields `OutcomeInput` does not declare, pass `initial={{ title: outcome.title, category: outcome.category, definitionOfDone: outcome.definitionOfDone, targetDate: outcome.targetDate, projectId: outcome.projectId }}` instead and note it in the report.

- [ ] **Step 7: Commit**

```bash
git add src/components/outcomes
git commit -m "feat: add the outcome form with the activity nudge, the outcome card and the replace picker"
```

---

### Task 8: The Week screen and Today's real banner

**Files:**
- Create: `src/lib/groupTasks.ts`, `src/components/week/WeekSlots.tsx`, `src/components/week/WeekTasks.tsx`
- Modify: `src/screens/Week.tsx` (overwrite), `src/screens/Today.tsx` (overwrite)
- Test: `src/lib/groupTasks.test.ts`, `src/screens/Week.test.tsx`, `src/screens/Today.test.tsx`

**Interfaces:**
- Consumes: `useWeekLookup`, `useAddOutcome`, `useUpdateOutcome` (Task 6); `useReportError`, `weekFullOutcomes` (Task 6); `useTasks` (Phase 2); `useProjects`; `useToday`; `OutcomeCard`, `OutcomeForm`, `ReplacePicker` (Task 7); `weekNumber`, `weekRangeLabel`, `fridayOf` (Task 2); `weekStartOf` (`time.ts`); `CaptureBar`, `ScreenShell`; fixtures `SETTINGS`, `WEEK_ID`, `makeOutcome`, `makeWeekView`, `makeLookup`, `makeTask`.
- Produces:
  - `groupTasks(tasks, outcomes, projects): TaskGroup[]` with `type TaskGroup = { key: string; label: string; tasks: Task[] }` — by outcome, then project, then "Not linked"
  - `WeekSlots({ view, today, weekStartDate })` — a region "Outcomes": three slots (card or "Outcome N is open."), "Add an outcome" / "Replace an outcome", the form, the replace picker (also on a server `WEEK_FULL`)
  - `WeekTasks({ weekStartDate, outcomes })` — regions "This week's tasks" and "Waiting on others"
  - `/week`: heading "Week", "Week N · range", "Planned" or a "Plan this week" link, the slots, the tasks
  - `/`: the "Plan your first week" link when no earlier week ever held an outcome, "Plan this week" when the current week is empty, otherwise a "This week" list of the outcomes with "Open the week"

- [ ] **Step 1: Write the failing tests**

Create `src/lib/groupTasks.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { groupTasks } from './groupTasks';
import { makeOutcome, makeTask } from '../test/fixtures';

describe('groupTasks', () => {
  it('groups by outcome, then project, with unlinked tasks last', () => {
    const outcome = makeOutcome({ title: 'Supplier plan confirmed' });
    const project = { id: '30000000-0000-4000-8000-000000000099', name: 'Pinkbox' };
    const tasks = [
      makeTask({ title: 'Call supplier', outcomeId: outcome.id }),
      makeTask({ title: 'Draft dashboard', projectId: project.id }),
      makeTask({ title: 'Loose end' }),
      makeTask({ title: 'Send tracker', outcomeId: outcome.id, projectId: project.id }),
    ];
    expect(groupTasks(tasks, [outcome], [project]).map((g) => [g.label, g.tasks.map((t) => t.title)])).toEqual([
      ['Supplier plan confirmed', ['Call supplier', 'Send tracker']],
      ['Pinkbox', ['Draft dashboard']],
      ['Not linked', ['Loose end']],
    ]);
  });

  it('treats a link to an unknown outcome or project as unlinked and returns nothing for no tasks', () => {
    const tasks = [makeTask({ title: 'Orphan', outcomeId: '10000000-0000-4000-8000-000000009999' })];
    expect(groupTasks(tasks, [], []).map((g) => g.label)).toEqual(['Not linked']);
    expect(groupTasks([], [], [])).toEqual([]);
  });
});
```

Create `src/screens/Week.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, WEEK_ID, makeLookup, makeOutcome, makeTask, makeWeekView } from '../test/fixtures';
import type { WeekLookup } from '../shared/exec/schemas';

const weekFull = (outcomes: unknown) =>
  new Response(JSON.stringify({ success: false, error: 'the week already has three outcomes', code: 'WEEK_FULL', details: { outcomes } }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

function api(lookup: WeekLookup, onWrite: (url: string, init?: RequestInit) => Response = () => json(makeOutcome(), 201)) {
  return stubFetch((url, init) => {
    if (init?.method && init.method !== 'GET') return onWrite(url, init);
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url.startsWith('/api/exec/weeks?')) return json(lookup);
    if (url.includes('week=')) return json([makeTask({ title: 'Call supplier', status: 'this_week' })]);
    if (url.includes('status=delegated')) return json([makeTask({ title: 'Send tracker', status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-23' })]);
    return json([]);
  });
}

const three = () => [makeOutcome({ title: 'A', slot: 1 }), makeOutcome({ title: 'B', slot: 2 }), makeOutcome({ title: 'C', slot: 3 })];

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-22T04:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('/week', () => {
  it('shows the week number, range, three outcome cards, tasks and waiting', async () => {
    api(makeLookup({ current: makeWeekView(three()) }));
    renderRoute('/week');
    expect(await screen.findByText('Week 39 · 20–26 Sep')).toBeInTheDocument();
    expect(await screen.findByRole('article', { name: 'A' })).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(3);
    expect(screen.getByText('Planned')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: "This week's tasks" })).getByText('Call supplier')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Waiting on others' })).getByText(/Send tracker — Bilal/)).toBeInTheDocument();
  });

  it('offers to plan an empty week and creates the week on the first add', async () => {
    const calls = api(makeLookup(), (url) => (url === '/api/exec/weeks' ? json(makeWeekView(), 201) : json(makeOutcome(), 201)));
    renderRoute('/week');
    expect(await screen.findByRole('link', { name: 'Plan this week' })).toHaveAttribute('href', '/plan');
    expect(screen.getAllByText(/is open\./)).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Add an outcome' }));
    await userEvent.type(screen.getByLabelText('Outcome'), 'Supplier plan confirmed');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual(['/api/exec/weeks', `/api/exec/weeks/${WEEK_ID}/outcomes`]));
    expect(calls.find((c) => c.url === '/api/exec/weeks')?.body).toEqual({ date: '2026-09-22' });
  });

  it('turns Add into Replace when the week is full and sends the replace with the new outcome', async () => {
    const outcomes = three();
    const calls = api(makeLookup({ current: makeWeekView(outcomes) }));
    renderRoute('/week');
    await userEvent.click(await screen.findByRole('button', { name: 'Replace an outcome' }));
    await userEvent.type(screen.getByLabelText('Outcome'), 'Supplier risks identified');
    await userEvent.click(screen.getByRole('button', { name: 'Choose what it replaces' }));
    await userEvent.click(within(screen.getByRole('form', { name: 'Replace an outcome' })).getByRole('radio', { name: 'B' }));
    await userEvent.click(screen.getByRole('button', { name: 'Replace' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toBeDefined());
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({
      url: `/api/exec/weeks/${WEEK_ID}/outcomes`,
      body: expect.objectContaining({ title: 'Supplier risks identified', replace: { outcomeId: outcomes[1].id, reason: 'priority_changed' } }),
    });
  });

  it('shows the replace prompt when the server refuses a fourth the screen did not know about', async () => {
    const outcomes = three();
    api(makeLookup({ current: makeWeekView(outcomes.slice(0, 2)) }), () => weekFull(outcomes));
    renderRoute('/week');
    await userEvent.click(await screen.findByRole('button', { name: 'Add an outcome' }));
    await userEvent.type(screen.getByLabelText('Outcome'), 'D');
    await userEvent.click(screen.getByRole('button', { name: 'Add outcome' }));
    const picker = await screen.findByRole('form', { name: 'Replace an outcome' });
    expect(within(picker).getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['A', 'B', 'C']);
  });

  it('saves progress from a card', async () => {
    const outcomes = three();
    const calls = api(makeLookup({ current: makeWeekView(outcomes) }), () => json(outcomes[0]));
    renderRoute('/week');
    const slider = await screen.findByLabelText('Progress for A');
    fireEvent.change(slider, { target: { value: '60' } });
    fireEvent.blur(slider);
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: `/api/exec/outcomes/${outcomes[0].id}`, body: { progress: 60 } }));
  });
});
```

Create `src/screens/Today.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeLookup, makeOutcome, makeWeekView } from '../test/fixtures';
import type { WeekLookup } from '../shared/exec/schemas';

afterEach(() => vi.unstubAllGlobals());

const api = (lookup: WeekLookup) =>
  stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : url.startsWith('/api/exec/weeks') ? json(lookup) : json([])));

describe('Today and the week', () => {
  it('invites the first plan when no week has ever held an outcome', async () => {
    api(makeLookup());
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Plan your first week' })).toHaveAttribute('href', '/plan');
  });

  it('asks for this week\'s plan once there is history', async () => {
    api(makeLookup({ hasHistory: true, current: makeWeekView([]) }));
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Plan this week' })).toHaveAttribute('href', '/plan');
    expect(screen.queryByRole('link', { name: 'Plan your first week' })).toBeNull();
  });

  it("lists this week's outcomes instead of a banner when the week is planned", async () => {
    api(makeLookup({ current: makeWeekView([makeOutcome({ title: 'Supplier plan confirmed', progress: 40 }), makeOutcome({ title: 'Killed', slot: null, status: 'killed' })]) }));
    renderRoute('/');
    const list = await screen.findByRole('list', { name: 'This week' });
    expect(list).toHaveTextContent('Supplier plan confirmed');
    expect(list).toHaveTextContent('40%');
    expect(list).not.toHaveTextContent('Killed');
    expect(screen.getByRole('link', { name: 'Open the week' })).toHaveAttribute('href', '/week');
    expect(screen.queryByRole('link', { name: /Plan/ })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/groupTasks.test.ts src/screens/Week.test.tsx src/screens/Today.test.tsx`
Expected: FAIL — `./groupTasks` cannot be resolved; `/week` still says "Arrives in Phase 3."; Today shows "Plan your first week" unconditionally.

- [ ] **Step 3: Write the grouping helper**

Create `src/lib/groupTasks.ts`:

```ts
import type { Outcome, Task } from '../shared/exec/schemas';

export type TaskGroup = { key: string; label: string; tasks: Task[] };

/** Spec C "Week" item 5: tasks by outcome, then by project, unlinked last. Input order is kept inside a group. */
export function groupTasks(tasks: Task[], outcomes: Outcome[], projects: { id: string; name: string }[]): TaskGroup[] {
  const outcomeTitles = new Map(outcomes.map((outcome) => [outcome.id, outcome.title]));
  const projectNames = new Map(projects.map((project) => [project.id, project.name]));
  const byOutcome = new Map<string, Task[]>();
  const byProject = new Map<string, Task[]>();
  const unlinked: Task[] = [];
  for (const task of tasks) {
    if (task.outcomeId && outcomeTitles.has(task.outcomeId)) byOutcome.set(task.outcomeId, [...(byOutcome.get(task.outcomeId) ?? []), task]);
    else if (task.projectId && projectNames.has(task.projectId)) byProject.set(task.projectId, [...(byProject.get(task.projectId) ?? []), task]);
    else unlinked.push(task);
  }
  return [
    ...[...byOutcome].map(([id, list]) => ({ key: `outcome:${id}`, label: outcomeTitles.get(id) ?? '', tasks: list })),
    ...[...byProject].map(([id, list]) => ({ key: `project:${id}`, label: projectNames.get(id) ?? '', tasks: list })),
    ...(unlinked.length > 0 ? [{ key: 'unlinked', label: 'Not linked', tasks: unlinked }] : []),
  ];
}
```

- [ ] **Step 4: Write the week components**

Create `src/components/week/WeekSlots.tsx`:

```tsx
import { useState } from 'react';
import { useAddOutcome, useUpdateOutcome } from '../../api/weeks';
import { useReportError, weekFullOutcomes } from '../../api/errors';
import { fridayOf } from '../../shared/exec/week';
import type { Outcome, OutcomeInput, ReviewReason, WeekView } from '../../shared/exec/schemas';
import { OutcomeCard } from '../outcomes/OutcomeCard';
import { OutcomeForm } from '../outcomes/OutcomeForm';
import { ReplacePicker } from '../outcomes/ReplacePicker';

type Props = { view: WeekView | null; today: string; weekStartDate: string };
type PendingReplace = { input: OutcomeInput; outcomes: Outcome[] };

function Slots({ outcomes }: { outcomes: Outcome[] }) {
  const update = useUpdateOutcome();
  const report = useReportError();
  return (
    <>
      {[1, 2, 3].map((slot) => {
        const outcome = outcomes.find((candidate) => candidate.slot === slot);
        if (!outcome) return <p key={slot} className="rounded-lg border border-dashed border-line p-4 text-ink-muted dark:border-ink-muted">Outcome {slot} is open.</p>;
        return (
          <OutcomeCard
            key={outcome.id}
            outcome={outcome}
            onUpdate={(patch) => update.mutate({ id: outcome.id, patch }, { onError: report('save the outcome') })}
            onKill={(reason) => update.mutate({ id: outcome.id, patch: { status: 'killed', reviewReason: reason } }, { onError: report('kill the outcome') })}
          />
        );
      })}
    </>
  );
}

/** The three slots and the only way to change them: add while one is open, replace when all three are taken (§4). */
export function WeekSlots({ view, today, weekStartDate }: Props) {
  const add = useAddOutcome();
  const report = useReportError();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<PendingReplace | null>(null);
  const slotted = (view?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  const full = slotted.length === 3;

  const send = (input: OutcomeInput, replace?: { outcomeId: string; reason: ReviewReason }) =>
    add.mutate(
      { date: today, weekId: view?.week.id, input: replace ? { ...input, replace } : input },
      {
        onSuccess: () => { setAdding(false); setPending(null); },
        onError: (error) => {
          const outcomes = weekFullOutcomes(error);
          if (outcomes) setPending({ input, outcomes });
          else report('add the outcome')(error);
        },
      }
    );

  return (
    <section aria-label="Outcomes" className="space-y-3">
      <Slots outcomes={slotted} />
      {pending ? (
        <ReplacePicker outcomes={pending.outcomes} pending={add.isPending} onCancel={() => setPending(null)} onPick={(outcomeId, reason) => send(pending.input, { outcomeId, reason })} />
      ) : adding ? (
        <OutcomeForm
          defaultTargetDate={fridayOf(weekStartDate)}
          submitLabel={full ? 'Choose what it replaces' : 'Add outcome'}
          pending={add.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => (full ? setPending({ input, outcomes: slotted }) : send(input))}
        />
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">
          {full ? 'Replace an outcome' : 'Add an outcome'}
        </button>
      )}
    </section>
  );
}
```

Create `src/components/week/WeekTasks.tsx`:

```tsx
import { useTasks } from '../../api/tasks';
import { useProjects } from '../../api/projects';
import { groupTasks } from '../../lib/groupTasks';
import type { Outcome } from '../../shared/exec/schemas';

type Props = { weekStartDate: string; outcomes: Outcome[] };

/** Spec C "Week" items 5 and 6: this week's committed tasks, grouped, and everything waiting on someone else. */
export function WeekTasks({ weekStartDate, outcomes }: Props) {
  const committed = useTasks({ week: weekStartDate });
  const waiting = useTasks({ status: ['delegated', 'waiting'] });
  const projects = useProjects();
  const groups = groupTasks(committed.data ?? [], outcomes, projects.data ?? []);
  const owed = waiting.data ?? [];
  return (
    <>
      <section aria-label="This week's tasks" className="space-y-2">
        <h2 className="text-xl font-medium">This week's tasks</h2>
        {groups.length === 0 && <p className="text-ink-muted">Nothing committed to this week yet.</p>}
        {groups.map((group) => (
          <div key={group.key}>
            <h3 className="text-sm uppercase tracking-wide text-ink-muted">{group.label}</h3>
            <ul className="space-y-1">{group.tasks.map((task) => <li key={task.id}>{task.title}</li>)}</ul>
          </div>
        ))}
      </section>
      <section aria-label="Waiting on others" className="space-y-2">
        <h2 className="text-xl font-medium">Waiting on others</h2>
        {owed.length === 0 && <p className="text-ink-muted">Nothing is waiting on anyone.</p>}
        <ul className="space-y-1">
          {owed.map((task) => (
            <li key={task.id}>
              {task.title} — {task.ownerName}
              {task.followUpDate && <span className="text-ink-muted"> · follow up {task.followUpDate}</span>}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
```

- [ ] **Step 5: Write the screens**

Overwrite `src/screens/Week.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { WeekSlots } from '../components/week/WeekSlots';
import { WeekTasks } from '../components/week/WeekTasks';
import { useWeekLookup } from '../api/weeks';
import { useToday } from '../lib/useToday';
import { weekNumber, weekRangeLabel } from '../shared/exec/week';
import { weekStartOf } from '../shared/exec/time';

/** Spec C "Week": the three outcomes, how far they are, and what is committed or waiting. */
export default function Week() {
  const { today, weekStartDay } = useToday();
  const lookup = useWeekLookup(today);
  const view = lookup.data?.current ?? null;
  const startDate = view?.week.startDate ?? weekStartOf(today, weekStartDay);
  const planned = (view?.outcomes ?? []).some((outcome) => outcome.slot !== null);
  return (
    <ScreenShell title="Week">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-ink-muted">Week {weekNumber(startDate)} · {weekRangeLabel(startDate)}</p>
        {planned ? <span className="text-sm text-ink-muted">Planned</span> : <Link to="/plan" className="text-sm underline">Plan this week</Link>}
      </div>
      <WeekSlots view={view} today={today} weekStartDate={startDate} />
      <WeekTasks weekStartDate={startDate} outcomes={view?.outcomes ?? []} />
    </ScreenShell>
  );
}
```

Overwrite `src/screens/Today.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { CaptureBar } from '../components/CaptureBar';
import { useWeekLookup } from '../api/weeks';
import { useToday } from '../lib/useToday';
import type { Outcome } from '../shared/exec/schemas';

function PlanBanner({ firstWeek }: { firstWeek: boolean }) {
  return (
    <>
      <Link to="/plan" className="block rounded-lg border border-line bg-paper-raised px-4 py-3 text-lg font-medium hover:border-ink dark:border-ink-muted dark:bg-ink">
        {firstWeek ? 'Plan your first week' : 'Plan this week'}
      </Link>
      <p className="text-ink-muted">Nothing is planned yet. The week's outcomes come first.</p>
    </>
  );
}

function ThisWeek({ outcomes }: { outcomes: Outcome[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">This week</h2>
      <ol aria-label="This week" className="space-y-1">
        {outcomes.map((outcome) => (
          <li key={outcome.id} className="flex justify-between gap-3">
            <span>{outcome.title}</span>
            <span className="text-ink-muted">{outcome.progress}%</span>
          </li>
        ))}
      </ol>
      <Link to="/week" className="text-sm underline">Open the week</Link>
    </section>
  );
}

/** Phase 3: the week's outcomes or the invitation to plan them, with capture pinned below. Phase 4 adds the Must Ship. */
export default function Today() {
  const { today } = useToday();
  const lookup = useWeekLookup(today);
  const outcomes = (lookup.data?.current?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  return (
    <ScreenShell title="Today">
      {lookup.isSuccess && outcomes.length === 0 && <PlanBanner firstWeek={lookup.data?.hasHistory !== true} />}
      {outcomes.length > 0 && <ThisWeek outcomes={outcomes} />}
      <div className="sticky bottom-20 pt-6 md:bottom-6">
        <CaptureBar />
      </div>
    </ScreenShell>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project jsdom`
Expected: PASS — 2 groupTasks, 5 Week, 3 Today, and every existing client test. Phase 1's `App.test.tsx` "opens on Today with the first-week banner" still passes: its fetch stub answers the week lookup with an object that has no `current` and no `hasHistory`, which reads as a first week.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 7: Commit**

```bash
git add src/lib/groupTasks.ts src/components/week src/screens/Week.tsx src/screens/Today.tsx src/lib/groupTasks.test.ts src/screens/Week.test.tsx src/screens/Today.test.tsx
git commit -m "feat: show the week's outcomes with progress, kill and replace, and drive Today's banner from the week"
```

---

### Task 9: Sunday planning

**Files:**
- Create: `src/components/plan/CarryOver.tsx`, `src/components/plan/ChooseOutcomes.tsx`
- Modify: `src/screens/Plan.tsx` (overwrite)
- Test: `src/screens/Plan.test.tsx`

**Interfaces:**
- Consumes: `useWeekLookup`, `useAddOutcome`, `useRollOutcome`, `useReportError` (Task 6); `OutcomeForm` (Task 7); `useToday`; `weekNumber`, `weekRangeLabel`, `fridayOf`; `weekStartOf`; fixtures.
- Produces:
  - `CarryOver({ outcomes, today, weekId?, onNext })` — heading "Last week", one "Carry "<title>" into this week" button per open outcome, and "Next: choose this week's outcomes"
  - `ChooseOutcomes({ view, today, weekStartDate, onDone })` — heading "This week's outcomes", a "Chosen outcomes" list, an `OutcomeForm` with `requireDefinition` labelled "Add outcome N", and "Done choosing" once one exists
  - `/plan`: heading "Plan the week" and "Week N · range"; starts at "Last week" when last week left open slotted outcomes not yet carried, else at choosing; shows "Week N is planned." with the outcomes and links "Open the week" and "Back to Today" once three are chosen or "Done choosing" is pressed

- [ ] **Step 1: Write the failing test**

Create `src/screens/Plan.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, WEEK_ID, makeLookup, makeOutcome, makeWeekView } from '../test/fixtures';
import type { Outcome, WeekLookup } from '../shared/exec/schemas';

/** A stateful fake: POST /weeks creates the current week, adding and rolling append to it. */
function fakePlanApi(start: WeekLookup) {
  let lookup = start;
  const current = () => lookup.current ?? makeWeekView([]);
  const append = (outcome: Outcome) => {
    lookup = { ...lookup, current: makeWeekView([...current().outcomes, outcome]) };
    return json(outcome, 201);
  };
  const calls = stubFetch((url, init) => {
    const method = init?.method ?? 'GET';
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (method === 'GET' && url.startsWith('/api/exec/weeks?')) return json(lookup);
    if (method === 'POST' && url === '/api/exec/weeks') {
      lookup = { ...lookup, current: current() };
      return json(current(), 201);
    }
    const slot = current().outcomes.filter((o) => o.slot !== null).length + 1;
    if (url.endsWith('/outcomes')) return append(makeOutcome({ title: JSON.parse(String(init?.body)).title, slot }));
    if (url.endsWith('/roll')) return append(makeOutcome({ title: 'Carried', slot, rolledFromId: url.split('/').at(-2) ?? null }));
    return json([]);
  });
  return calls;
}

const addOutcome = async (title: string, definition: string, button: string) => {
  await userEvent.type(screen.getByLabelText('Outcome'), title);
  await userEvent.type(screen.getByLabelText('Definition of done'), definition);
  await userEvent.click(screen.getByRole('button', { name: button }));
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-22T04:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('/plan', () => {
  it('chooses three outcomes, requiring a definition of done, and ends on "Week 39 is planned."', async () => {
    const calls = fakePlanApi(makeLookup());
    renderRoute('/plan');
    expect(await screen.findByText('Week 39 · 20–26 Sep')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: "This week's outcomes" })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Last week' })).toBeNull();

    await userEvent.type(screen.getByLabelText('Outcome'), 'Work on supplier meetings');
    expect(screen.getByRole('note')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add outcome 1' })).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Outcome'));

    await addOutcome('Supplier plan confirmed', 'Dates for the top 20', 'Add outcome 1');
    await screen.findByRole('button', { name: 'Add outcome 2' });
    expect(within(screen.getByRole('list', { name: 'Chosen outcomes' })).getByText('Supplier plan confirmed')).toBeInTheDocument();
    await addOutcome('Haleon target signed off', 'Signed by the commercial head', 'Add outcome 2');
    await screen.findByRole('button', { name: 'Add outcome 3' });
    await addOutcome('Pinkbox P&L live', 'Live franchise data', 'Add outcome 3');

    expect(await screen.findByRole('heading', { level: 2, name: 'Week 39 is planned.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the week' })).toHaveAttribute('href', '/week');
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/');
    expect(calls.filter((c) => c.method === 'POST').map((c) => c.url)).toEqual([
      '/api/exec/weeks',
      `/api/exec/weeks/${WEEK_ID}/outcomes`,
      `/api/exec/weeks/${WEEK_ID}/outcomes`,
      `/api/exec/weeks/${WEEK_ID}/outcomes`,
    ]);
  });

  it('offers last week\'s open outcomes first, carries one, then moves on', async () => {
    const open = makeOutcome({ title: 'Delivery tracker sent', weekId: '20000000-0000-4000-8000-000000000002', progress: 60 });
    const finished = makeOutcome({ title: 'Price list approved', weekId: '20000000-0000-4000-8000-000000000002', slot: 2, status: 'done', progress: 100 });
    const calls = fakePlanApi(makeLookup({ hasHistory: true, previous: makeWeekView([open, finished], { id: '20000000-0000-4000-8000-000000000002', startDate: '2026-09-13' }) }));
    renderRoute('/plan');
    expect(await screen.findByRole('heading', { level: 2, name: 'Last week' })).toBeInTheDocument();
    expect(screen.getByText(/Delivery tracker sent/)).toBeInTheDocument();
    expect(screen.queryByText(/Price list approved/)).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Carry "Delivery tracker sent" into this week' }));
    await waitFor(() => expect(calls.some((c) => c.url === `/api/exec/outcomes/${open.id}/roll`)).toBe(true));
    expect(calls.find((c) => c.url.endsWith('/roll'))?.body).toEqual({ weekId: WEEK_ID });
    expect(await screen.findByRole('heading', { level: 2, name: "This week's outcomes" })).toBeInTheDocument();
  });

  it('lets you stop at fewer than three', async () => {
    fakePlanApi(makeLookup({ current: makeWeekView([makeOutcome({ title: 'Only one' })]) }));
    renderRoute('/plan');
    await userEvent.click(await screen.findByRole('button', { name: 'Done choosing' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 39 is planned.' })).toBeInTheDocument();
    expect(screen.getByText('Only one')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/screens/Plan.test.tsx`
Expected: FAIL — `/plan` still says "Arrives in Phase 3."

- [ ] **Step 3: Write the two steps**

Create `src/components/plan/CarryOver.tsx`:

```tsx
import { useRollOutcome } from '../../api/weeks';
import { useReportError } from '../../api/errors';
import type { Outcome } from '../../shared/exec/schemas';

type Props = { outcomes: Outcome[]; today: string; weekId?: string; onNext: () => void };

/** Step 1 (§4): last week's open outcomes. Carrying is a conscious choice; the rest stay where they were. */
export function CarryOver({ outcomes, today, weekId, onNext }: Props) {
  const roll = useRollOutcome();
  const report = useReportError();
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Last week</h2>
      <p className="text-ink-muted">These were still open. Carry the ones that still matter.</p>
      <ul className="space-y-2">
        {outcomes.map((outcome) => (
          <li key={outcome.id} className="flex items-center justify-between gap-3">
            <span>{outcome.title} · {outcome.progress}%</span>
            <button
              type="button"
              aria-label={`Carry "${outcome.title}" into this week`}
              disabled={roll.isPending}
              onClick={() => roll.mutate({ id: outcome.id, date: today, weekId }, { onError: report('carry the outcome') })}
              className="rounded border border-line px-2 py-1 text-sm dark:border-ink-muted"
            >
              Carry into this week
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onNext} className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">
        Next: choose this week's outcomes
      </button>
    </section>
  );
}
```

Create `src/components/plan/ChooseOutcomes.tsx`:

```tsx
import { useState } from 'react';
import { useAddOutcome } from '../../api/weeks';
import { useReportError } from '../../api/errors';
import { fridayOf } from '../../shared/exec/week';
import type { WeekView } from '../../shared/exec/schemas';
import { OutcomeForm } from '../outcomes/OutcomeForm';

type Props = { view: WeekView | null; today: string; weekStartDate: string; onDone: () => void };

/** Step 2 (§4): up to three outcomes, one at a time, each with a definition of done. */
export function ChooseOutcomes({ view, today, weekStartDate, onDone }: Props) {
  const add = useAddOutcome();
  const report = useReportError();
  const [formKey, setFormKey] = useState(0);
  const chosen = (view?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">This week's outcomes</h2>
      <p className="text-ink-muted">Up to three. Results, not activities.</p>
      {chosen.length > 0 && (
        <ol aria-label="Chosen outcomes" className="list-decimal space-y-1 pl-5">
          {chosen.map((outcome) => <li key={outcome.id}>{outcome.title}</li>)}
        </ol>
      )}
      <OutcomeForm
        key={formKey}
        requireDefinition
        defaultTargetDate={fridayOf(weekStartDate)}
        submitLabel={`Add outcome ${chosen.length + 1}`}
        pending={add.isPending}
        onSubmit={(input) =>
          add.mutate({ date: today, weekId: view?.week.id, input }, { onSuccess: () => setFormKey((key) => key + 1), onError: report('add the outcome') })
        }
      />
      {chosen.length > 0 && (
        <button type="button" onClick={onDone} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">
          Done choosing
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Write the screen**

Overwrite `src/screens/Plan.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { CarryOver } from '../components/plan/CarryOver';
import { ChooseOutcomes } from '../components/plan/ChooseOutcomes';
import { useWeekLookup } from '../api/weeks';
import { useToday } from '../lib/useToday';
import { weekNumber, weekRangeLabel } from '../shared/exec/week';
import { weekStartOf } from '../shared/exec/time';
import type { Outcome } from '../shared/exec/schemas';

type Step = 'carry' | 'choose' | 'done';

function Planned({ startDate, outcomes }: { startDate: string; outcomes: Outcome[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Week {weekNumber(startDate)} is planned.</h2>
      <ol className="list-decimal space-y-1 pl-5">{outcomes.map((outcome) => <li key={outcome.id}>{outcome.title}</li>)}</ol>
      <div className="flex gap-4">
        <Link to="/week" className="underline">Open the week</Link>
        <Link to="/" className="underline">Back to Today</Link>
      </div>
    </section>
  );
}

/** Sunday planning (spec C, §4): steps 1, 2 and 4. Step 3, assigning deep-work blocks, arrives with the blocks. */
export default function Plan() {
  const { today, weekStartDay } = useToday();
  const lookup = useWeekLookup(today);
  const [chosenStep, setChosenStep] = useState<Step | null>(null);
  const current = lookup.data?.current ?? null;
  const startDate = current?.week.startDate ?? weekStartOf(today, weekStartDay);
  const slotted = (current?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  const carryable = (lookup.data?.previous?.outcomes ?? []).filter(
    (outcome) => outcome.status === 'active' && outcome.slot !== null && !slotted.some((mine) => mine.rolledFromId === outcome.id)
  );
  const natural: Step = carryable.length > 0 ? 'carry' : 'choose';
  const step: Step = slotted.length === 3 || chosenStep === 'done' ? 'done' : chosenStep === 'choose' ? 'choose' : natural;

  return (
    <ScreenShell title="Plan the week">
      <p className="text-ink-muted">Week {weekNumber(startDate)} · {weekRangeLabel(startDate)}</p>
      {!lookup.isSuccess && <p className="text-ink-muted">Loading the week…</p>}
      {lookup.isSuccess && step === 'carry' && <CarryOver outcomes={carryable} today={today} weekId={current?.week.id} onNext={() => setChosenStep('choose')} />}
      {lookup.isSuccess && step === 'choose' && <ChooseOutcomes view={current} today={today} weekStartDate={startDate} onDone={() => setChosenStep('done')} />}
      {lookup.isSuccess && step === 'done' && <Planned startDate={startDate} outcomes={slotted} />}
    </ScreenShell>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/screens/Plan.test.tsx src/app/App.test.tsx`
Expected: PASS — 3 plan tests; Phase 1's full-screen `/plan` test still finds the heading "Plan the week" without primary navigation.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/plan src/screens/Plan.tsx src/screens/Plan.test.tsx
git commit -m "feat: add Sunday planning with last week's carry-over and three outcomes with the nudge"
```

---

### Task 10: Projects and the project page

**Files:**
- Create: `src/screens/ProjectDetail.tsx`
- Modify: `src/screens/Projects.tsx` (overwrite), `src/app/routes.tsx`
- Test: `src/screens/Projects.test.tsx`, `src/screens/ProjectDetail.test.tsx`

**Interfaces:**
- Consumes: `useProjects`, `useProject`, `useCreateProject`, `useUpdateProject` (Task 6); `useReportError`; `ContextToggle` (Phase 2); `PROJECT_STATUS_LABELS` (Task 6); `weekNumber`; fixtures `makeProjectSummary`, `makeOutcome`, `makeTask`.
- Produces:
  - `/projects`: heading "Projects", a form "New project" (textbox "Project name", the Work/Build toggle, "Create project"), regions "Work" and "Build" listing projects as links to `/projects/:id` with "N outcomes · M open tasks"
  - `/projects/:id`: heading = the project name, "All projects" link, a "Status" select, a "Notes" textarea saved on blur, regions "Outcomes" (each "Week N · title") and "Open tasks"; an unknown id shows "That project does not exist."

- [ ] **Step 1: Write the failing tests**

Create `src/screens/Projects.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeProjectSummary } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('/projects', () => {
  it('lists work and build projects apart, with counts and links', async () => {
    const supply = makeProjectSummary({ name: 'Supply plan', activeOutcomes: 1, openTasks: 3 });
    const pinkbox = makeProjectSummary({ name: 'Pinkbox', context: 'build', status: 'done' });
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : json([supply, pinkbox])));
    renderRoute('/projects');
    const work = await screen.findByRole('region', { name: 'Work' });
    expect(within(work).getByRole('link', { name: 'Supply plan' })).toHaveAttribute('href', `/projects/${supply.id}`);
    expect(work).toHaveTextContent('1 outcome · 3 open tasks');
    const build = screen.getByRole('region', { name: 'Build' });
    expect(within(build).getByRole('link', { name: 'Pinkbox' })).toBeInTheDocument();
    expect(build).toHaveTextContent('Done');
  });

  it('creates a project in the chosen context', async () => {
    const calls = stubFetch((url, init) => (url.endsWith('/settings') ? json(SETTINGS) : init?.method === 'POST' ? json(makeProjectSummary(), 201) : json([])));
    renderRoute('/projects');
    expect(await screen.findByText('No work projects yet.')).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: 'Project name' }), 'Healify launch');
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/projects', body: { name: 'Healify launch', context: 'build' } }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveValue(''));
  });
});
```

Create `src/screens/ProjectDetail.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeOutcome, makeProjectSummary, makeTask } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('/projects/:id', () => {
  it('shows the project with its outcomes by week and open tasks, and saves status and notes', async () => {
    const project = makeProjectSummary({ name: 'Supply plan', notes: 'Top 20 suppliers' });
    const detail = { project, outcomes: [{ ...makeOutcome({ title: 'Delivery plan confirmed' }), weekStartDate: '2026-09-20' }], tasks: [makeTask({ title: 'Call supplier' })] };
    const calls = stubFetch((url, init) => (url.endsWith('/settings') ? json(SETTINGS) : init?.method === 'PATCH' ? json(project) : json(detail)));
    renderRoute(`/projects/${project.id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Supply plan' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All projects' })).toHaveAttribute('href', '/projects');
    expect(within(screen.getByRole('region', { name: 'Outcomes' })).getByText('Week 39 · Delivery plan confirmed')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Open tasks' })).getByText('Call supplier')).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Archived');
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({ status: 'archived' }));

    const notes = screen.getByLabelText('Notes');
    await userEvent.clear(notes);
    await userEvent.type(notes, 'Top 25 suppliers');
    fireEvent.blur(notes);
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ notes: 'Top 25 suppliers' }));
  });

  it('says so when the project does not exist', async () => {
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(404, 'NOT_FOUND', 'no such project')));
    renderRoute('/projects/nope');
    expect(await screen.findByText('That project does not exist.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/screens/Projects.test.tsx src/screens/ProjectDetail.test.tsx`
Expected: FAIL — `/projects` still says "Arrives in Phase 3."; `/projects/:id` renders "Nothing here".

- [ ] **Step 3: Write the list screen**

Overwrite `src/screens/Projects.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { ContextToggle } from '../components/ContextToggle';
import { useCreateProject, useProjects } from '../api/projects';
import { useReportError } from '../api/errors';
import { PROJECT_STATUS_LABELS } from '../lib/labels';
import type { Context, ProjectSummary } from '../shared/exec/schemas';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function NewProject() {
  const create = useCreateProject();
  const report = useReportError();
  const [name, setName] = useState('');
  const [context, setContext] = useState<Context>('work');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) create.mutate({ name: name.trim(), context }, { onSuccess: () => setName(''), onError: report('create the project') });
  };
  return (
    <form aria-label="New project" onSubmit={submit} className="flex flex-wrap items-center gap-2">
      <input aria-label="Project name" value={name} onChange={(e) => setName(e.target.value)} placeholder="New project" className="min-w-0 flex-1 rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink" />
      <ContextToggle value={context} onChange={setContext} />
      <button type="submit" disabled={!name.trim() || create.isPending} className="rounded bg-ink px-3 py-2 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
        Create project
      </button>
    </form>
  );
}

function Group({ label, projects }: { label: 'Work' | 'Build'; projects: ProjectSummary[] }) {
  return (
    <section aria-label={label} className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">{label}</h2>
      {projects.length === 0 && <p className="text-ink-muted">No {label.toLowerCase()} projects yet.</p>}
      <ul className="space-y-1">
        {projects.map((project) => (
          <li key={project.id} className="flex justify-between gap-3 border-t border-line py-2 dark:border-ink-muted">
            <Link to={`/projects/${project.id}`} className="font-medium">{project.name}</Link>
            <span className="text-sm text-ink-muted">
              {project.status !== 'active' && `${PROJECT_STATUS_LABELS[project.status]} · `}
              {plural(project.activeOutcomes, 'outcome')} · {plural(project.openTasks, 'open task')}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Spec C "Projects": a list, never a board, with work and build kept apart (§16). */
export default function Projects() {
  const projects = useProjects().data ?? [];
  return (
    <ScreenShell title="Projects">
      <NewProject />
      <Group label="Work" projects={projects.filter((project) => project.context === 'work')} />
      <Group label="Build" projects={projects.filter((project) => project.context === 'build')} />
    </ScreenShell>
  );
}
```

- [ ] **Step 4: Write the project page and route it**

Create `src/screens/ProjectDetail.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { useProject, useUpdateProject } from '../api/projects';
import { useReportError } from '../api/errors';
import { PROJECT_STATUS_LABELS } from '../lib/labels';
import { weekNumber } from '../shared/exec/week';
import { PROJECT_STATUSES, type ProjectPatch, type ProjectStatus } from '../shared/exec/schemas';

function Notes({ notes, onSave }: { notes: string; onSave: (notes: string) => void }) {
  const [draft, setDraft] = useState(notes);
  useEffect(() => setDraft(notes), [notes]);
  return (
    <label className="block space-y-1 text-sm">
      <span>Notes</span>
      <textarea rows={3} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => draft !== notes && onSave(draft)} className="w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink" />
    </label>
  );
}

/** One project: its outcomes week by week and its open tasks. Must Ship candidates arrive with Must Ships. */
export default function ProjectDetail() {
  const { id = '' } = useParams();
  const detail = useProject(id);
  const update = useUpdateProject();
  const report = useReportError();
  const save = (patch: ProjectPatch) => update.mutate({ id, patch }, { onError: report('update the project') });

  if (detail.isError) {
    return (
      <ScreenShell title="Project">
        <p className="text-ink-muted">That project does not exist.</p>
        <Link to="/projects" className="underline">All projects</Link>
      </ScreenShell>
    );
  }
  if (!detail.data) return <ScreenShell title="Project"><p className="text-ink-muted">Loading…</p></ScreenShell>;
  const { project, outcomes, tasks } = detail.data;
  return (
    <ScreenShell title={project.name}>
      <Link to="/projects" className="text-sm underline">All projects</Link>
      <label className="flex items-center gap-2 text-sm">
        <span>Status</span>
        <select value={project.status} onChange={(e) => save({ status: e.target.value as ProjectStatus })} className="rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink">
          {PROJECT_STATUSES.map((status) => <option key={status} value={status}>{PROJECT_STATUS_LABELS[status]}</option>)}
        </select>
      </label>
      <Notes notes={project.notes} onSave={(notes) => save({ notes })} />
      <section aria-label="Outcomes" className="space-y-1">
        <h2 className="text-xl font-medium">Outcomes</h2>
        {outcomes.length === 0 && <p className="text-ink-muted">No outcomes yet. Link one from the week.</p>}
        <ul>{outcomes.map((outcome) => <li key={outcome.id}>Week {weekNumber(outcome.weekStartDate)} · {outcome.title}</li>)}</ul>
      </section>
      <section aria-label="Open tasks" className="space-y-1">
        <h2 className="text-xl font-medium">Open tasks</h2>
        {tasks.length === 0 && <p className="text-ink-muted">No open tasks.</p>}
        <ul>{tasks.map((task) => <li key={task.id}>{task.title}</li>)}</ul>
      </section>
    </ScreenShell>
  );
}
```

In `src/app/routes.tsx`, add `import ProjectDetail from '../screens/ProjectDetail';` and, in the Shell route's children, insert `{ path: 'projects/:id', element: <ProjectDetail /> },` directly after the `projects` child (before the `*` child).

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project jsdom`
Expected: PASS — 2 Projects and 2 ProjectDetail tests plus every existing client test.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Projects.tsx src/screens/ProjectDetail.tsx src/app/routes.tsx src/screens/Projects.test.tsx src/screens/ProjectDetail.test.tsx
git commit -m "feat: add the projects list with work and build apart, and a project page"
```

---

### Task 11: The plan-a-week journey and README

**Files:**
- Create: `e2e/week.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: the running app (Tasks 7–10): `/plan`'s labels and buttons ("Outcome", "Definition of done", "Category", "Add outcome N", the `note` nudge, "Week N is planned."), `/week`'s articles and "Replace an outcome" flow, Today's "This week" list, `/projects`' form; the API at `/api/exec/weeks`.
- Produces: two desktop journeys in `e2e/week.spec.ts`, which sorts after `smoke.spec.ts` so the first-run assertion there still sees an empty database.

- [ ] **Step 1: Write the journeys**

Create `e2e/week.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// Named to sort after smoke.spec.ts: one worker runs the files in order against one database,
// and smoke asserts the first-run "Plan your first week" link that planning removes.

/** Today's date as the server's settings see it (Asia/Karachi), in YYYY-MM-DD. */
const todayInKarachi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());

test('plans a week: the nudge, three outcomes, a refused fourth, and a replace', async ({ page, request }) => {
  await page.goto('/plan');
  await expect(page.getByRole('heading', { level: 2, name: "This week's outcomes" })).toBeVisible();

  await page.getByLabel('Outcome').fill('Work on supplier meetings');
  await expect(page.getByRole('note')).toHaveText('This sounds like an activity. What will exist when it is finished?');
  await expect(page.getByRole('button', { name: 'Add outcome 1' })).toBeDisabled();

  const choose = async (title: string, definition: string, button: string, category?: string) => {
    await page.getByLabel('Outcome').fill(title);
    await page.getByLabel('Definition of done').fill(definition);
    if (category) await page.getByLabel('Category').selectOption({ label: category });
    await page.getByRole('button', { name: button }).click();
  };
  await choose('Supplier delivery plan confirmed', 'Dates confirmed for the top 20 suppliers', 'Add outcome 1');
  await expect(page.getByRole('button', { name: 'Add outcome 2' })).toBeVisible();
  await choose('Haleon purchase target finalised', 'Signed off by the commercial head', 'Add outcome 2');
  await expect(page.getByRole('button', { name: 'Add outcome 3' })).toBeVisible();
  await choose('Pinkbox P&L dashboard live', 'Shows live franchise data', 'Add outcome 3', 'Business');
  await expect(page.getByRole('heading', { level: 2, name: /^Week \d+ is planned\.$/ })).toBeVisible();

  const lookup = await (await request.get(`/api/exec/weeks?date=${todayInKarachi()}`)).json();
  const fourth = await request.post(`/api/exec/weeks/${lookup.data.current.week.id}/outcomes`, {
    data: { title: 'A fourth outcome', category: 'office' },
  });
  expect(fourth.status()).toBe(409);
  expect((await fourth.json()).code).toBe('WEEK_FULL');

  await page.goto('/week');
  await expect(page.getByRole('article')).toHaveCount(3);
  await page.getByRole('button', { name: 'Replace an outcome' }).click();
  await page.getByLabel('Outcome').fill('Supplier risks identified');
  await page.getByRole('button', { name: 'Choose what it replaces' }).click();
  const picker = page.getByRole('form', { name: 'Replace an outcome' });
  await picker.getByRole('radio', { name: 'Haleon purchase target finalised' }).check();
  await picker.getByRole('button', { name: 'Replace' }).click();
  await expect(page.getByRole('article', { name: 'Supplier risks identified' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Haleon purchase target finalised' })).toHaveCount(0);

  await page.goto('/');
  await expect(page.getByRole('list', { name: 'This week' })).toContainText('Supplier risks identified');
  await expect(page.getByRole('link', { name: /^Plan (your first|this) week$/ })).toHaveCount(0);
});

test('creates a project and opens its page', async ({ page }) => {
  await page.goto('/projects');
  await page.getByRole('textbox', { name: 'Project name' }).fill('September supply plan');
  await page.getByRole('button', { name: 'Create project' }).click();
  await page.getByRole('region', { name: 'Work' }).getByRole('link', { name: 'September supply plan' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'September supply plan' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Outcomes' })).toContainText('No outcomes yet.');
});
```

- [ ] **Step 2: Run the journeys**

Run: `npm run test:e2e`
Expected: 10 passed (8 desktop, 2 phone). Afterwards `ls -d "$(node -p 'require("os").tmpdir()')"/taskflow-e2e-* 2>/dev/null | wc -l` prints `0`.

If the planning journey fails because the date the test computes and the server's week disagree (a run straddling midnight in Karachi), rerun it; do not loosen an assertion. If `smoke.spec.ts`'s first-run assertion fails, check the file order Playwright reported — `week.spec.ts` must run after it.

- [ ] **Step 3: Update the README**

In `README.md`, after the "Capturing" section, add:

```markdown
## Planning the week

Open `/plan` on Sunday (or any day the week has no outcomes). Carry any of
last week's open outcomes that still matter, then choose up to three for this
week — each needs a definition of done, and a title that reads like an
activity ("Work on…", "Look into…") gets a nudge to say what will exist when
it is finished. A fourth is never added: on `/week`, "Replace an outcome"
asks which one gives up its slot, and why. Progress on each outcome is set by
hand on `/week`. Projects live at `/projects`, work and build kept apart.
```

- [ ] **Step 4: Verify and commit**

Run: `npm run lint && npx vitest run`
Expected: clean; all green.

```bash
git add e2e/week.spec.ts README.md
git commit -m "test: add the plan-a-week journey and the project journey"
```

---

### Task 12: Phase 3 verification and report

**Files:** none created; this is the after-every-phase ritual from the spec (section D).

- [ ] **Step 1: Static checks**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 2: Unit and integration coverage**

Run: `npm run test:coverage`
Expected: every project green; the 80% line threshold passes; note the totals and any file under 80% for the report.

- [ ] **Step 3: Journeys**

Run: `npm run test:e2e`
Expected: 10 passed; `ls -d "$(node -p 'require("os").tmpdir()')"/taskflow-e2e-* 2>/dev/null | wc -l` prints `0` (the temp directory lives under `os.tmpdir()`, which is `/mnt/clarus_nvme/tmp` on this machine, not `/tmp`).

- [ ] **Step 4: Manual run against the phase's bar**

The spec's Phase 3 "Done when": *A fourth outcome is refused with the replace prompt; the nudge shows; journey: plan a week.* Start `npm run server` and `npm run dev` (Vite prints 3001) and check, recording what you saw:
- `/` on the development database — the banner reads "Plan your first week" if no week ever held an outcome, else "Plan this week".
- `/plan` — type "Look into POS vendors": the nudge appears and, on leaving the field, focus moves to "Definition of done"; "Add outcome 1" stays disabled until a definition is typed; add three; "Week N is planned." shows them.
- `/week` — "Week N · range" and "Planned"; three cards; drag a slider and release: reload and the value persisted; "Mark done" sets 100%; "Replace an outcome" → form → picker → the replaced card disappears and the new one takes its slot; "Kill" with a reason frees a slot and "Add an outcome" returns.
- `/projects` — create one work and one build project; each lands in its group; open one, change its status and notes, reload, and both persisted.
- `/` — the "This week" list shows the outcomes with their progress; no plan banner.
- Stop both servers (`pgrep -af "tsx.*server/index.ts|node_modules/.bin/vite"` shows nothing), then check the database: `node -e "const D=require('better-sqlite3');const db=new D('data/execution.db');console.log(db.prepare('SELECT w.start_date, o.slot, o.status, o.title FROM outcomes o JOIN weeks w ON w.id=o.week_id ORDER BY w.start_date, o.slot IS NULL, o.slot').all())"` lists the week's slotted outcomes and the killed ones with `slot` null.
- Reserved for the owner: the phone check over the tailnet from Phases 1–2 still stands; nothing new needs the phone in this phase.

- [ ] **Step 5: Report**

Write the phase report where the executing skill keeps it: the commit list (`git log --oneline main..HEAD`), the coverage totals, the e2e result, what was verified by hand, what is reserved for the owner, and anything that did not pass — the spec's Phase 3 row is the reference.

---

## Self-review

**Spec coverage (Phase 3 scope):** B "Tables" `projects`, `weeks`, `outcomes` — written through `insertRow`/`updateRow` against the existing `001_init.sql` columns (Tasks 1, 3, 4). B "The limits" — max three slotted outcomes via `freeSlot` plus `UNIQUE (week_id, slot)`, killed frees the slot, `WEEK_FULL` with the three current outcomes (Task 3), tested at the store (Task 3), the route (Task 5) and end to end (Task 11). B "Routes" — `GET/POST/PATCH /projects[/:id]` (Task 4); `POST /weeks`, `GET /weeks/:id`, `POST /weeks/:id/outcomes` (Task 5); `PATCH /outcomes/:id`, `POST /outcomes/:id/roll` (Task 5); plus the lookup `GET /weeks?date=` recorded in the decisions. B "Pure core" — `isActivityTitle` (Task 2); `weekOf` is covered by Phase 2's `weekStartOf`/`weekEndOf` plus `fridayOf`/`weekNumber` (Task 2). C "Week" items 1, 2 (minus the Must Ship and deep-work figures, deferred with reasons), 3, 5, 6 (Task 8); item 4, the deep-work calendar, is Phase 5. C "Projects" (Task 10), minus Must Ship candidates (Phase 4). C "Sunday planning" steps 1 (outcomes, minus the scoreboard — Phase 6), 2 and 4 (Task 9); step 3 is Phase 5. C "The activity nudge" — shows under the title, moves focus to the definition on blur, never blocks (Tasks 2, 7), required-definition only on `/plan` (Task 9). D Phase 3 "Done when" — refused fourth with the replace prompt (Tasks 5, 8, 11), the nudge (Tasks 7, 9, 11), the journey (Task 11), verified in Task 12. Carried from the Phase 2 final review: week normalisation and the `PLAIN` extraction (Task 1); the code-aware error surface, Inbox selection reset and the shared toast text in tests (Task 6).

**Placeholder scan:** no TBD/TODO; every code step has its code; the deferrals in the decisions name the phase that owns each.

**Type consistency:** `OutcomeCreate` (output, with defaults) is what `addOutcome` takes (Task 3) and what `weeksRouter` passes from `outcomeCreateSchema.parse` (Task 5); `OutcomeInput` (`z.input`) is what `OutcomeForm` emits and `useAddOutcome` sends (Tasks 6–9), and the server fills the defaults. `WeekLookup` (`{ current, previous, hasHistory }`) is produced by `lookupWeek` (Task 3), served by `GET /weeks` (Task 5), fetched by `useWeekLookup` (Task 6) and read by Today, Week and Plan (Tasks 8–9). `weekFullOutcomes` reads `details.outcomes`, which `insertOutcome` sets (Tasks 3, 6, 8). `RollResult.created` decides 201 vs 200 (Tasks 3, 5); `useRollOutcome` ensures the week first like `useAddOutcome` (Task 6), matching the roll test's `{ weekId: WEEK_ID }` body (Tasks 6, 9). `ProjectSummary` from `listProjectSummaries` (Task 4) is what `useProjects` returns (Task 6) and what `OutcomeForm`, `ProjectPicker` and `/projects` read (Tasks 7, 10); `ProjectDetail.outcomes[].weekStartDate` comes from the SQL alias `week_start_date` (Task 4) and feeds `weekNumber` on the project page (Task 10). The fixtures `WEEK_ID`, `makeOutcome`, `makeWeekView`, `makeLookup`, `makeProjectSummary` (Task 6) are used unchanged in Tasks 7–10. The labels "Replace an outcome" (form name and button), "Choose what it replaces", "Add an outcome", "Add outcome", "Add outcome N", "Carry "<title>" into this week", "This week", "Chosen outcomes", "Plan your first week" and "Plan this week" match between components, unit tests and `e2e/week.spec.ts`.
