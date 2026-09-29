# Execution System Phase 4: Must Ship and Today — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the daily loop real. There is one work Must Ship per workday, refused a second time with `DAY_TAKEN`. There are at most two secondaries, refused a third time with `SLOT_LIMIT`. Today shows the one card that fits the moment, the Waiting list is followed up from Today, and a minimal Settings panel edits the schedule that drives it all.

**Architecture:** Two new server resources follow the Phase 3 pattern of zod parse, then a store, then `insertRow`/`updateRow`, all under `/api/exec`:
- `must-ships`: create, list, patch and roll, with the one-per-day rule checked inside an immediate transaction and backed by `UNIQUE (date, context)`.
- `days`: `GET /days/:date` is the Today screen in one read, and `PUT /days/:date/slots` sets the secondaries.

`PUT /settings` replaces the editable schedule. A pure `todayMode` in `src/shared/exec/today.ts` turns the clock, the settings and the day into banners and one primary card, following the spec's table row for row. The client adds query hooks with a shared key module (so every write refreshes Today), a Must Ship picker, a rebuilt Today, a Settings screen, Must Ship counts on the Week cards, and Must Ship candidates on project pages.

**Tech Stack:** React 19, Vite 6.4, TanStack Query 5, react-router 7, Tailwind v4; Express 5, better-sqlite3 (SQLite 3.53); zod 4.6 (`z.iso.datetime()`, `z.uuid()`); vitest 4.1 (node + jsdom projects), Testing Library, user-event; Playwright 1.63 (`page.clock`).

**Spec:** `docs/superpowers/specs/2026-09-22-execution-system-design.md` (Phase 4 row in D "Build sequence"; B "Tables", "The limits", "Routes"; C "Today is time-aware", "Today", "Projects", "Sunday planning" step 4, "The activity nudge").

## Global Constraints

Copied from the spec and the earlier plans; every task's requirements include these.

- `/api/exec/*` responses are `{ success: true, data }` or `{ success: false, error, code }`, where `code` is one of `VALIDATION`, `NOT_FOUND`, `WEEK_FULL`, `DAY_TAKEN`, `SLOT_LIMIT`, `SHUTDOWN_NOT_READY`, `DELETE_NOT_ALLOWED`, `CONSTRAINT` or `INTERNAL`. Error responses never carry a stack, a path, a driver message, or a client-supplied field name or value.
- Every body, query and path parameter is parsed by a zod schema from `src/shared/exec/schemas.ts` (or, for this phase's resources, `src/shared/exec/todaySchemas.ts`) before a store is touched. Every row write to `tasks`, `projects`, `weeks`, `outcomes` or `must_ships` goes through `insertRow`/`updateRow` in `server/exec/rows.ts`. `days`, `day_slots` and `settings` are written only by literal, parameterised statements in their own store. Statements are always parameterised.
- At most one Must Ship per date per context: `UNIQUE (date, context)` on `must_ships`. A second is refused with `409 DAY_TAKEN`, whose `details.mustShip` is the one already holding the day. Undated Must Ships are candidates (§17) and are unlimited.
- At most two secondaries per day: `day_slots.slot IN (1,2)` and `PRIMARY KEY (date, slot)`. A third is refused with `400 SLOT_LIMIT` (`'a day holds at most two secondary tasks'`).
- A blocked Must Ship needs `blockerWhat`, `blockerOwner` and `blockerNextAction` (route check, §8).
- Capture ≠ commitment. Only a day slot or a Must Ship puts a task on Today, and the capture toast stays `Captured. It is in the Inbox, not on Today.`
- The activity nudge (`This sounds like an activity. What will exist when it is finished?`) never blocks saving a Must Ship.
- Time zone Asia/Karachi. All calendar dates are local `YYYY-MM-DD`, timestamps are ISO-8601 UTC set by the server, ids are server-generated UUIDs, and rows are returned camelCase.
- The API always binds `127.0.0.1`. No new environment variables. No new migration: every table this phase uses exists in `001_init.sql`.
- New code compiles under `strict: true` with `noUnusedLocals`/`noUnusedParameters`. `npm run lint` is `tsc --noEmit -p tsconfig.app.json`. Legacy code is not modified: `App.tsx`, the root `components/`, `services/`, `utils/`, `server/routes/*` and `server/db/*`.
- Files stay under 400 lines and functions under 50 lines. No `console.log` in application code. Build new objects rather than mutating.
- TDD: the failing test lands before the code that passes it. Coverage stays at 80% lines. Phase 3's 491 tests keep passing, except for the tests this plan says to change.
- Commit messages follow `<type>: <description>` and contain nothing else: no `Co-Authored-By`, no `Claude-Session`, no trailer of any kind (the user's own git rules disable attribution). Never push.
- Port 3000 on the development machine is held by another project, so `npm run dev` prints another port (3001). The e2e config uses 3100/4150. `os.tmpdir()` is `/mnt/clarus_nvme/tmp`. Manual checks run against a temp copy of `data/`, never the owner's real databases.

## Review Focus

These are the inputs the spec implies but no happy-path test exercises, most likely to bite first. Each has its test in the owning task.

1. **The clock at a boundary.** At exactly `officeStart` (08:15), Today is in the office; at exactly `officeEnd` (18:00) it is Build; at exactly `shutdownTime` (17:00), "Close the day" shows. Boundary cases in Task 2.
2. **Today left open across midnight.** The date, and therefore the day that Today reads, must roll over without a reload. `useNow` ticks, and `useToday` is tested past Karachi midnight (Task 7).
3. **Two tabs racing for today's Must Ship.** The second save gets `DAY_TAKEN`. The picker says "that day already has a Must Ship" and Today then shows the one that won, with no silent overwrite. Store test in Task 4, route test in Task 5, picker test in Task 8.
4. **A secondary picked from the Inbox.** It must leave the Inbox (processed to `this_week`, scheduled today) instead of sitting in both places. Store test in Task 6, component test in Task 11.
5. **Settings with no work days, or office hours reversed.** No work days means every day is a Build day, and `nextWorkDay` must not loop. Office hours that end before they start are refused with a clear message. Tests in Tasks 1, 2 and 12.

## Decisions carried into this plan

- **`GET /must-ships`** takes `date` (a calendar date, or `none` for undated candidates), `week` (any day of a planning week), `status` (comma list), `outcome`, `project` and `context`. A project page reads its candidates with `?date=none&project=…`, which keeps `ProjectDetail` (in `schemas.ts`) free of a Must Ship type and avoids an import cycle. Candidates come first, newest first, then dated ones by date. The spec names the parameters; `none` and `week` are how "candidates" and "Must Ships shipped x of y" read them.
- **The one-per-day rule counts every status.** `UNIQUE (date, context)` holds for a killed Must Ship too, so history is never overwritten. To change today's Must Ship, Today offers **Edit** (same row) or **Put back** (date → `null`, returning it to the candidates), then choose again. Killing a dated Must Ship is a Shutdown/Review disposition (Phase 6).
- **Must Ship transitions.** `closedAt` is set when status leaves `planned` and cleared when it returns. Rolling copies to a new date with `rolledFromId` and `rollCount + 1`; the original keeps its status. Shipped and killed Must Ships are not rolled, and neither is a roll onto the Must Ship's own date. The roll route exists now because it is part of "must ships routes"; Phase 6's Shutdown is its main caller.
- **`GET /days/:date` reads without creating** (like `GET /weeks?date=`). It returns `{ date, day, week, hasHistory, mustShip, buildMustShip, secondaries, waiting, blocks, inboxCount }`. `hasHistory` keeps the "Plan your first week" wording. `waiting` is delegated or waiting tasks with `followUpDate ≤ date`, and `blocks` reads `deep_work_blocks`, which stays empty until Phase 5.
- **`PUT /days/:date/slots` replaces the secondaries** and creates the `days` row if it is missing. An `inbox` task chosen for today is processed to `this_week` with `scheduledDate = date`, because it is now a commitment. Unknown or duplicate ids get `400 VALIDATION`, and more than two get `SLOT_LIMIT`.
- **`PUT /settings` replaces the editable schedule only:** work days, deep-work start and minutes, shutdown time, office start and end, and build blocks. The time zone and week start day stay fixed in the MVP (spec "Assumptions in force" 2 and 5); moving the week start would misalign every existing week. The body is strict, so sending `timezone` is `400 unknown field`.
- **`todayMode(now, settings, day)`** returns `{ clock, banners, primary }`, and its tests cover the spec's tables row for row.
  - `resume` and `grade` exist in the pure core because Phase 5 creates blocks.
  - In this phase both cards link to `/focus`, which is still a placeholder.
  - A Must Ship is graded by focus (Phase 5) or by Shutdown (Phase 6), so Phase 4 has no Shipped/Blocked buttons on Today.
- **Today's header line reads "x of N outcomes done"**, not the spec's example wording "2 of 3 on track". "On track" has no definition in the data, and "done" is a fact.
- **Waiting's "Followed up" moves `followUpDate` to the next work day.** It takes one click, which is the spec's "sets the next date". "Received" marks the task `done`.
- **Sunday planning step 4** ("Monday's Must Ship can be set here too"): the planned view offers the Must Ship for the next work day after today.
- **Carried from the Phase 3 final review:**
  - Error and loading states for Today, Week, Plan and Projects (Tasks 9 and 14).
  - Gating the day lookup on settings, which is already true of the week lookup (Tasks 9 and 14).
  - Invalidation tests for cross-resource writes (Task 7).
  - The outcome form's project list is filtered to the outcome's context (work for Office, build otherwise), keeping a project that is already selected (Task 13). This is a ruling made without the owner's answer; flip it in Task 13 if he prefers the full list.
- **Deferred:**
  - `POST /days/:date/shutdown` goes to Phase 6.
  - The deep-work routes, the focus screen and the Must Ship result buttons go to Phase 5.
  - The Roll action on Week cards goes to Phase 6.
  - Killed status on project pages, `maxLength` on titles, and renaming projects go to Phase 7.
- **The new e2e spec is `e2e/today.spec.ts`.** It fixes the browser clock with `page.clock.setFixedTime` at Tuesday 2 March 2027, 09:00 Karachi (`2027-03-02T04:00:00Z`), so the moments are deterministic and its dates cannot collide with `week.spec.ts`, which plans the real current week. It sorts after `smoke.spec.ts` (first-run banner) and before `week.spec.ts`.

---

## File Structure

**Shared (`src/shared/exec/`)**
- `todaySchemas.ts` (new): the Must Ship, day, day view, deep-work block and settings-update schemas (Task 1). `schemas.ts` gains one line exporting its field primitives; at 261 lines it cannot take ~145 more under the 400-line cap, so the phase's schemas live beside it.
- `today.ts` (new): `todayMode`, `nextWorkDay`, `dayLabel` (Task 2).

**Server (`server/exec/`)**
- `rows.ts`: `ExecTable` gains `'must_ships'` (Task 4).
- `settings/store.ts`: `putSettings` (Task 3). `routes/settings.ts`: `PUT /` (Task 3).
- `mustShips/store.ts` (new, Task 4). `routes/mustShips.ts` (new, Task 5).
- `days/store.ts` (new) and `routes/days.ts` (new) (Task 6).
- `router.ts`: mount `/must-ships` and `/days` (Tasks 5 and 6).
- `projects/store.ts`: candidate counts and candidates (Task 13).

**Client (`src/`)**
- `api/keys.ts` (new); `api/mustShips.ts` and `api/days.ts` (new); `api/tasks.ts`, `api/weeks.ts`, `api/projects.ts`, `api/settings.ts` and `api/errors.ts` changed (Task 7).
- `lib/useNow.ts` (new) and `lib/useToday.ts` changed (Task 7).
- `components/mustShip/MustShipForm.tsx` and `MustShipPicker.tsx` (Task 8).
- `components/LoadError.tsx` and `components/today/*` (Tasks 9–11).
- `screens/Today.tsx` (Task 10), `screens/Settings.tsx` and `components/settings/BuildBlocksField.tsx` (Task 12).
- `app/routes.tsx` and `app/Shell.tsx`: add `/settings` (Task 12).
- `components/week/WeekSlots.tsx`, `components/outcomes/OutcomeCard.tsx`, `components/outcomes/OutcomeForm.tsx`, `screens/Projects.tsx` and `screens/ProjectDetail.tsx` (Task 13).
- `screens/Plan.tsx`, `screens/Week.tsx` and `screens/Projects.tsx` get load errors, and Plan gets its step 4 (Task 14).

**E2E:** `e2e/today.spec.ts` (new) and `e2e/week.spec.ts` (Today assertion, Task 10). README section (Task 15).

---

### Task 1: Must Ship, day and settings-update schemas

**Files:**
- Create: `src/shared/exec/todaySchemas.ts`
- Modify: `src/shared/exec/schemas.ts` (append one export line; nothing existing changes)
- Test: `src/shared/exec/todaySchemas.test.ts`

**Interfaces:**
- Consumes: `calendarDateSchema`, `contextSchema`, `taskSchema`, `weekViewSchema` from `schemas.ts`, plus its private `uuid`, `timestamp`, `hhmm`, `weekday`, `outcomeTitle` and `longText`, which this task exports as `fields`.
- Produces, all exported from `src/shared/exec/todaySchemas.ts` (later tasks import them from there, not from `schemas.ts`):
  - `fields` (from `schemas.ts`): `{ uuid, timestamp, hhmm, weekday, title, longText }`
  - `MUST_SHIP_STATUSES`, `mustShipStatusSchema`, `type MustShipStatus`
  - `mustShipSchema` / `type MustShip`
  - `mustShipCreateSchema` / `type MustShipCreate` (output) / `type MustShipInput` (`z.input`)
  - `mustShipPatchSchema` / `type MustShipPatch`
  - `mustShipRollSchema`
  - `mustShipQuerySchema` / `type MustShipQuery` (`date?: string | 'none'`, `week?`, `status?: MustShipStatus[]`, `outcome?`, `project?`, `context?`)
  - `daySchema` / `type Day`
  - `BLOCK_RESULTS`, `deepWorkBlockSchema` / `type DeepWorkBlock`
  - `secondarySchema` / `type Secondary` (`{ slot: 1 | 2 as number, task: Task }`)
  - `dayViewSchema` / `type DayView`
  - `dayParamsSchema` (`{ date }`), `daySlotsSchema` (`{ taskIds: string[] }`, at most 20 ids)
  - `settingsUpdateSchema` / `type SettingsUpdate`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/exec/todaySchemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { daySlotsSchema, dayViewSchema, mustShipCreateSchema, mustShipPatchSchema, mustShipQuerySchema, settingsUpdateSchema } from './todaySchemas';

describe('Phase 4 schemas', () => {
  const ID = '00000000-0000-4000-8000-000000000001';
  const schedule = {
    workDays: [1, 2, 3, 4, 5],
    deepWorkStart: '08:35',
    deepWorkMinutes: 90,
    shutdownTime: '17:00',
    officeStart: '08:15',
    officeEnd: '18:00',
    buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }],
  };

  it('fills Must Ship defaults: a candidate with no links', () => {
    expect(mustShipCreateSchema.parse({ title: ' Supplier tracker sent ', context: 'work' })).toEqual({
      title: 'Supplier tracker sent',
      context: 'work',
      date: null,
      definitionOfDone: '',
      outcomeId: null,
      projectId: null,
      notes: '',
    });
  });

  it('never lets a client write lineage, counts or timestamps on a Must Ship', () => {
    expect(mustShipPatchSchema.safeParse({ rollCount: 2 }).success).toBe(false);
    expect(mustShipPatchSchema.safeParse({ closedAt: '2026-09-29T10:00:00.000Z' }).success).toBe(false);
    expect(mustShipPatchSchema.safeParse({}).success).toBe(false);
    expect(mustShipPatchSchema.parse({ status: 'blocked', blockerWhat: 'Supplier silent' })).toEqual({ status: 'blocked', blockerWhat: 'Supplier silent' });
  });

  it('reads candidates as date=none and splits a status list', () => {
    expect(mustShipQuerySchema.parse({ date: 'none', status: 'planned,blocked' })).toEqual({ date: 'none', status: ['planned', 'blocked'] });
    expect(mustShipQuerySchema.safeParse({ date: 'tomorrow' }).success).toBe(false);
    expect(mustShipQuerySchema.safeParse({ status: 'shipped,lost' }).success).toBe(false);
  });

  it('accepts up to twenty slot ids so the store can answer SLOT_LIMIT itself', () => {
    expect(daySlotsSchema.parse({ taskIds: [ID, ID, ID] }).taskIds).toHaveLength(3);
    expect(daySlotsSchema.safeParse({ taskIds: Array.from({ length: 21 }, () => ID) }).success).toBe(false);
    expect(daySlotsSchema.safeParse({ taskIds: ['nope'] }).success).toBe(false);
  });

  it('describes an empty day', () => {
    const empty = { date: '2026-09-29', day: null, week: null, hasHistory: false, mustShip: null, buildMustShip: null, secondaries: [], waiting: [], blocks: [], inboxCount: 0 };
    expect(dayViewSchema.safeParse(empty).success).toBe(true);
  });

  it('edits the schedule but never the time zone or the week start', () => {
    expect(settingsUpdateSchema.parse(schedule)).toEqual(schedule);
    expect(settingsUpdateSchema.safeParse({ ...schedule, timezone: 'UTC' }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...schedule, weekStartDay: 1 }).success).toBe(false);
  });

  it('refuses reversed office hours and a repeated work day, and allows no work days at all', () => {
    const reversed = settingsUpdateSchema.safeParse({ ...schedule, officeStart: '18:00', officeEnd: '08:15' });
    expect(reversed.success).toBe(false);
    expect(reversed.error?.issues[0]).toMatchObject({ path: ['officeEnd'], message: 'office hours must start before they end' });
    expect(settingsUpdateSchema.safeParse({ ...schedule, workDays: [1, 1] }).success).toBe(false);
    expect(settingsUpdateSchema.safeParse({ ...schedule, workDays: [] }).success).toBe(true);
    expect(settingsUpdateSchema.safeParse({ ...schedule, deepWorkMinutes: 5 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/exec/todaySchemas.test.ts`
Expected: FAIL, because `./todaySchemas` cannot be resolved.

- [ ] **Step 3: Export the primitives and write the schemas**

Append this line to the end of `src/shared/exec/schemas.ts`:

```ts
/** The field primitives, for schema modules that live beside this one (todaySchemas.ts). */
export const fields = { uuid, timestamp, hhmm, weekday, title: outcomeTitle, longText };
```

Create `src/shared/exec/todaySchemas.ts`:

```ts
import { z } from 'zod';
import { calendarDateSchema, contextSchema, fields, taskSchema, weekViewSchema } from './schemas';

/** Must Ships, days and the schedule (Phase 4). Every body, query and path of those routes is parsed by one of these. */

const { uuid, timestamp, hhmm, weekday, title: outcomeTitle, longText } = fields;

export const MUST_SHIP_STATUSES = ['planned', 'shipped', 'partial', 'missed', 'blocked', 'killed'] as const;
export const mustShipStatusSchema = z.enum(MUST_SHIP_STATUSES);
export type MustShipStatus = z.infer<typeof mustShipStatusSchema>;

export const mustShipSchema = z.object({
  id: uuid,
  title: z.string(),
  definitionOfDone: z.string(),
  context: contextSchema,
  date: calendarDateSchema.nullable(),
  outcomeId: uuid.nullable(),
  projectId: uuid.nullable(),
  status: mustShipStatusSchema,
  blockerWhat: z.string().nullable(),
  blockerOwner: z.string().nullable(),
  blockerNextAction: z.string().nullable(),
  notes: z.string(),
  rolledFromId: uuid.nullable(),
  rollCount: z.number().int().nonnegative(),
  closedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type MustShip = z.infer<typeof mustShipSchema>;

/** A dated Must Ship holds its day; an undated one is a candidate (§17). Context is explicit; the UI defaults it. */
export const mustShipCreateSchema = z.strictObject({
  title: outcomeTitle,
  context: contextSchema,
  date: calendarDateSchema.nullable().default(null),
  definitionOfDone: longText.default(''),
  outcomeId: uuid.nullable().default(null),
  projectId: uuid.nullable().default(null),
  notes: longText.default(''),
});
export type MustShipCreate = z.infer<typeof mustShipCreateSchema>;
export type MustShipInput = z.input<typeof mustShipCreateSchema>;

const blockerText = z.string().trim().min(1, 'required').max(500, 'too long');

/** Lineage, roll counts and timestamps are never client-writable; a status change sets closedAt. */
export const mustShipPatchSchema = z
  .strictObject({
    title: outcomeTitle.optional(),
    definitionOfDone: longText.optional(),
    context: contextSchema.optional(),
    date: calendarDateSchema.nullable().optional(),
    outcomeId: uuid.nullable().optional(),
    projectId: uuid.nullable().optional(),
    status: mustShipStatusSchema.optional(),
    blockerWhat: blockerText.nullable().optional(),
    blockerOwner: blockerText.nullable().optional(),
    blockerNextAction: blockerText.nullable().optional(),
    notes: longText.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type MustShipPatch = z.infer<typeof mustShipPatchSchema>;

export const mustShipRollSchema = z.strictObject({ date: calendarDateSchema });

const mustShipStatusList = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()).filter(Boolean))
  .pipe(z.array(mustShipStatusSchema).min(1));

/** `date=none` selects candidates; `week` is any day of the planning week it names. */
export const mustShipQuerySchema = z.strictObject({
  date: z.union([calendarDateSchema, z.literal('none')]).optional(),
  week: calendarDateSchema.optional(),
  status: mustShipStatusList.optional(),
  outcome: uuid.optional(),
  project: uuid.optional(),
  context: contextSchema.optional(),
});
export type MustShipQuery = z.infer<typeof mustShipQuerySchema>;

export const daySchema = z.object({
  date: calendarDateSchema,
  shutdownAt: timestamp.nullable(),
  notes: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Day = z.infer<typeof daySchema>;

export const BLOCK_RESULTS = ['completed', 'progress', 'blocked', 'abandoned'] as const;

export const deepWorkBlockSchema = z.object({
  id: uuid,
  date: calendarDateSchema,
  context: contextSchema,
  plannedStart: hhmm,
  plannedMinutes: z.number().int().positive(),
  outcomeId: uuid.nullable(),
  mustShipId: uuid.nullable(),
  startedAt: timestamp.nullable(),
  endedAt: timestamp.nullable(),
  pausedSeconds: z.number().int().nonnegative(),
  pauseStartedAt: timestamp.nullable(),
  result: z.enum(BLOCK_RESULTS).nullable(),
  notes: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type DeepWorkBlock = z.infer<typeof deepWorkBlockSchema>;

export const secondarySchema = z.object({ slot: z.number().int().min(1).max(2), task: taskSchema });
export type Secondary = z.infer<typeof secondarySchema>;

/** The Today screen in one read (spec B, GET /days/:date). */
export const dayViewSchema = z.object({
  date: calendarDateSchema,
  day: daySchema.nullable(),
  week: weekViewSchema.nullable(),
  hasHistory: z.boolean(),
  mustShip: mustShipSchema.nullable(),
  buildMustShip: mustShipSchema.nullable(),
  secondaries: z.array(secondarySchema),
  waiting: z.array(taskSchema),
  blocks: z.array(deepWorkBlockSchema),
  inboxCount: z.number().int().nonnegative(),
});
export type DayView = z.infer<typeof dayViewSchema>;

export const dayParamsSchema = z.strictObject({ date: calendarDateSchema });

/** The limit of two is the store's to enforce, so it can answer SLOT_LIMIT; twenty only bounds the body. */
export const daySlotsSchema = z.strictObject({ taskIds: z.array(uuid).max(20) });

/** The editable schedule. The time zone and week start stay fixed in the MVP (spec "Assumptions in force"). */
export const settingsUpdateSchema = z
  .strictObject({
    workDays: z.array(weekday).max(7),
    deepWorkStart: hhmm,
    deepWorkMinutes: z.number().int().min(15).max(240),
    shutdownTime: hhmm,
    officeStart: hhmm,
    officeEnd: hhmm,
    buildBlocks: z.array(z.strictObject({ weekday, start: hhmm, minutes: z.number().int().min(15).max(600) })).max(14),
  })
  .refine((schedule) => new Set(schedule.workDays).size === schedule.workDays.length, { message: 'each work day once', path: ['workDays'] })
  .refine((schedule) => schedule.officeStart < schedule.officeEnd, { message: 'office hours must start before they end', path: ['officeEnd'] });
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
```

`schemas.ts` never imports `todaySchemas.ts`, so there is no cycle.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/shared/exec`
Expected: PASS. That is 7 new tests plus every existing shared test.

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/exec/schemas.ts src/shared/exec/todaySchemas.ts src/shared/exec/todaySchemas.test.ts
git commit -m "feat: add the Must Ship, day and schedule schemas"
```

---

### Task 2: The Today moments as a pure function

**Files:**
- Create: `src/shared/exec/today.ts`
- Test: `src/shared/exec/today.test.ts`

**Interfaces:**
- Consumes: `localClock`, `isWorkDay`, `isOfficeHours`, `hhmmToMinutes`, `type LocalClock` (`time.ts`); `addDays` (`dates.ts`); `type Settings` (`schemas.ts`); `type DayView` (`todaySchemas.ts`, Task 1).
- Produces:
  - `type Banner = 'plan' | 'close'`
  - `type Primary = { kind: 'build' } | { kind: 'tomorrow' } | { kind: 'choose' } | { kind: 'resume'; blockId: string } | { kind: 'grade'; mustShipId: string } | { kind: 'start'; mustShipId: string }`
  - `type TodayMode = { clock: LocalClock; banners: Banner[]; primary: Primary }`
  - `todayMode(now: Date, settings: Settings, view: DayView): TodayMode`
  - `nextWorkDay(date: string, workDays: readonly number[]): string`, the first work day after `date` (or `date + 1` when there are none)
  - `dayLabel(date: string): string`, for example `'Tuesday 29 September'`

- [ ] **Step 1: Write the failing tests**

Create `src/shared/exec/today.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { todayMode, nextWorkDay, dayLabel } from './today';
import type { Outcome, Settings } from './schemas';
import type { DayView, DeepWorkBlock, MustShip } from './todaySchemas';

const SETTINGS: Settings = {
  timezone: 'Asia/Karachi',
  weekStartDay: 0,
  workDays: [1, 2, 3, 4, 5],
  deepWorkStart: '08:35',
  deepWorkMinutes: 90,
  shutdownTime: '17:00',
  officeStart: '08:15',
  officeEnd: '18:00',
  buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }],
};
const STAMP = '2026-09-27T03:00:00.000Z';
const MS_ID = '40000000-0000-4000-8000-000000000001';

/** Karachi is UTC+5 all year: a local HH:MM on a date as a Date. */
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const utc = h * 60 + m - 300;
  return new Date(`${date}T${String(Math.floor(utc / 60)).padStart(2, '0')}:${String(utc % 60).padStart(2, '0')}:00Z`);
};

const mustShip = (overrides: Partial<MustShip> = {}): MustShip => ({
  id: MS_ID, title: 'Supplier tracker sent', definitionOfDone: '', context: 'work', date: '2026-09-29', outcomeId: null, projectId: null,
  status: 'planned', blockerWhat: null, blockerOwner: null, blockerNextAction: null, notes: '', rolledFromId: null, rollCount: 0,
  closedAt: null, createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const block = (overrides: Partial<DeepWorkBlock> = {}): DeepWorkBlock => ({
  id: '50000000-0000-4000-8000-000000000001', date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90,
  outcomeId: null, mustShipId: MS_ID, startedAt: null, endedAt: null, pausedSeconds: 0, pauseStartedAt: null, result: null,
  notes: '', createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const outcome = { slot: 1, status: 'active' } as Outcome;
const planned = { week: { id: 'w', startDate: '2026-09-27', reviewedAt: null, reviewNotes: '', createdAt: STAMP, updatedAt: STAMP }, outcomes: [outcome] };

const view = (overrides: Partial<DayView> = {}): DayView => ({
  date: '2026-09-29', day: null, week: planned, hasHistory: true, mustShip: null, buildMustShip: null,
  secondaries: [], waiting: [], blocks: [], inboxCount: 0, ...overrides,
});
const shutDown = { date: '2026-09-29', shutdownAt: '2026-09-29T12:10:00.000Z', notes: '', createdAt: STAMP, updatedAt: STAMP };

describe('todayMode: the primary card (spec C, first match wins)', () => {
  it.each([
    ['a non-work day', at('2026-10-03', '10:00'), view()],
    ['before office_start', at('2026-09-29', '08:14'), view({ mustShip: mustShip() })],
    ['at office_end exactly', at('2026-09-29', '18:00'), view({ mustShip: mustShip() })],
  ])('is the Build card on %s', (_label, now, day) => {
    expect(todayMode(now, SETTINGS, day).primary).toEqual({ kind: 'build' });
  });

  it('is in the office at office_start exactly', () => {
    expect(todayMode(at('2026-09-29', '08:15'), SETTINGS, view()).primary).toEqual({ kind: 'choose' });
  });

  it('shows tomorrow once today is shut down, even with a Must Ship', () => {
    expect(todayMode(at('2026-09-29', '17:30'), SETTINGS, view({ day: shutDown, mustShip: mustShip() })).primary).toEqual({ kind: 'tomorrow' });
  });

  it('asks for today\'s Must Ship when there is none', () => {
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view()).primary).toEqual({ kind: 'choose' });
  });

  it('resumes a live or paused block', () => {
    const live = block({ startedAt: '2026-09-29T03:40:00.000Z' });
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [live] })).primary).toEqual({ kind: 'resume', blockId: live.id });
  });

  it('asks for the result once the Must Ship\'s block has ended and it is still planned', () => {
    const ended = block({ startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T05:05:00.000Z' });
    expect(todayMode(at('2026-09-29', '11:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [ended] })).primary).toEqual({ kind: 'grade', mustShipId: MS_ID });
  });

  it('falls through to Start deep work otherwise, including after the Must Ship shipped', () => {
    const ended = block({ startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T05:05:00.000Z' });
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view({ mustShip: mustShip() })).primary).toEqual({ kind: 'start', mustShipId: MS_ID });
    expect(todayMode(at('2026-09-29', '11:00'), SETTINGS, view({ mustShip: mustShip({ status: 'shipped' }), blocks: [ended] })).primary).toEqual({ kind: 'start', mustShipId: MS_ID });
  });

  it('treats every day as a Build day when there are no work days', () => {
    expect(todayMode(at('2026-09-29', '10:00'), { ...SETTINGS, workDays: [] }, view()).primary).toEqual({ kind: 'build' });
  });
});

describe('todayMode: banners', () => {
  it('asks for a plan while no outcome holds a slot, killed ones included', () => {
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view({ week: null })).banners).toEqual(['plan']);
    const killedOnly = { ...planned, outcomes: [{ slot: null, status: 'killed' } as Outcome] };
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view({ week: killedOnly })).banners).toEqual(['plan']);
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view()).banners).toEqual([]);
  });

  it('asks to close the day from shutdown_time on a work day until the shutdown is done', () => {
    expect(todayMode(at('2026-09-29', '16:59'), SETTINGS, view()).banners).toEqual([]);
    expect(todayMode(at('2026-09-29', '17:00'), SETTINGS, view()).banners).toEqual(['close']);
    expect(todayMode(at('2026-09-29', '20:00'), SETTINGS, view()).banners).toEqual(['close']);
    expect(todayMode(at('2026-09-29', '17:30'), SETTINGS, view({ day: shutDown })).banners).toEqual([]);
    expect(todayMode(at('2026-10-03', '17:30'), SETTINGS, view()).banners).toEqual([]);
  });

  it('reports the local clock it decided with', () => {
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view()).clock).toEqual({ date: '2026-09-29', weekday: 2, minutes: 540 });
  });
});

describe('nextWorkDay and dayLabel', () => {
  it('skips the weekend and never loops without work days', () => {
    expect(nextWorkDay('2026-10-02', [1, 2, 3, 4, 5])).toBe('2026-10-05');
    expect(nextWorkDay('2026-09-29', [1, 2, 3, 4, 5])).toBe('2026-09-30');
    expect(nextWorkDay('2026-09-29', [])).toBe('2026-09-30');
  });

  it('names a day the way Today shows it', () => {
    expect(dayLabel('2026-09-29')).toBe('Tuesday 29 September');
    expect(dayLabel('2027-03-02')).toBe('Tuesday 2 March');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/exec/today.test.ts`
Expected: FAIL, because `./today` cannot be resolved.

- [ ] **Step 3: Write the core**

Create `src/shared/exec/today.ts`:

```ts
import { addDays } from './dates';
import { hhmmToMinutes, isOfficeHours, isWorkDay, localClock, type LocalClock } from './time';
import type { Settings } from './schemas';
import type { DayView } from './todaySchemas';

export type Banner = 'plan' | 'close';
export type Primary =
  | { kind: 'build' }
  | { kind: 'tomorrow' }
  | { kind: 'choose' }
  | { kind: 'resume'; blockId: string }
  | { kind: 'grade'; mustShipId: string }
  | { kind: 'start'; mustShipId: string };
export type TodayMode = { clock: LocalClock; banners: Banner[]; primary: Primary };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** The first work day after `date`; the next calendar day when no day is a work day. */
export function nextWorkDay(date: string, workDays: readonly number[]): string {
  const offset = [1, 2, 3, 4, 5, 6, 7].find((days) => workDays.includes(weekdayOf(addDays(date, days))));
  return addDays(date, offset ?? 1);
}

/** "Tuesday 29 September". */
export function dayLabel(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${DAY_NAMES[weekdayOf(date)]} ${day} ${MONTH_NAMES[month - 1]}`;
}

function bannersFor(clock: LocalClock, settings: Settings, view: DayView): Banner[] {
  const planned = (view.week?.outcomes ?? []).some((outcome) => outcome.slot !== null);
  const closing = isWorkDay(clock, settings) && clock.minutes >= hhmmToMinutes(settings.shutdownTime) && !view.day?.shutdownAt;
  return [...(planned ? [] : (['plan'] as const)), ...(closing ? (['close'] as const) : [])];
}

/** Spec C "Today is time-aware": the first matching row decides the one primary card. */
function primaryFor(clock: LocalClock, settings: Settings, view: DayView): Primary {
  if (!isOfficeHours(clock, settings)) return { kind: 'build' };
  if (view.day?.shutdownAt) return { kind: 'tomorrow' };
  const mustShip = view.mustShip;
  if (!mustShip) return { kind: 'choose' };
  const live = view.blocks.find((block) => block.startedAt !== null && block.endedAt === null);
  if (live) return { kind: 'resume', blockId: live.id };
  const ended = view.blocks.some((block) => block.mustShipId === mustShip.id && block.endedAt !== null);
  if (ended && mustShip.status === 'planned') return { kind: 'grade', mustShipId: mustShip.id };
  return { kind: 'start', mustShipId: mustShip.id };
}

/** The banners to show and the one primary card, from the clock, the schedule and the day (spec B "Pure core"). */
export function todayMode(now: Date, settings: Settings, view: DayView): TodayMode {
  const clock = localClock(now, settings.timezone);
  return { clock, banners: bannersFor(clock, settings, view), primary: primaryFor(clock, settings, view) };
}
```

`isOfficeHours` is `isWorkDay && officeStart ≤ minutes < officeEnd`, so its negation is exactly the spec's first row: "non-work day, or before `office_start`, or after `office_end`", with `office_end` itself counting as after.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/shared/exec/today.test.ts`
Expected: PASS, 15 tests (the three `it.each` rows count separately).

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/exec/today.ts src/shared/exec/today.test.ts
git commit -m "feat: decide Today's banners and primary card from the clock, the schedule and the day"
```

---

### Task 3: Edit the schedule with PUT /settings

**Files:**
- Modify: `server/exec/settings/store.ts`, `server/exec/routes/settings.ts`
- Test: `server/exec/__tests__/settings-store.test.ts`, `server/exec/__tests__/settings-routes.test.ts` (append)

**Interfaces:**
- Consumes: `getSettings` (Phase 3); `settingsUpdateSchema`, `type SettingsUpdate` (`todaySchemas.ts`, Task 1); `nowIso` (`server/exec/clock.ts`).
- Produces:
  - `putSettings(db, input: SettingsUpdate, now: string): Settings`. It stores work days sorted ascending and build blocks sorted by weekday then start.
  - `settingsRouter(db, clock = nowIso)`, serving `GET /` and `PUT /`.

- [ ] **Step 1: Write the failing tests**

Append to `server/exec/__tests__/settings-store.test.ts`, adding `putSettings` to the import from `'../settings/store'`:

```ts
describe('putSettings', () => {
  it('replaces the editable schedule, sorted, and keeps the time zone and week start', () => {
    const db = prepareExecDb(':memory:');
    const saved = putSettings(
      db,
      {
        workDays: [5, 1, 2],
        deepWorkStart: '09:00',
        deepWorkMinutes: 60,
        shutdownTime: '17:30',
        officeStart: '08:30',
        officeEnd: '18:30',
        buildBlocks: [{ weekday: 6, start: '10:00', minutes: 120 }, { weekday: 2, start: '06:30', minutes: 50 }],
      },
      '2026-09-29T04:00:00.000Z'
    );
    expect(saved).toEqual({
      timezone: 'Asia/Karachi',
      weekStartDay: 0,
      workDays: [1, 2, 5],
      deepWorkStart: '09:00',
      deepWorkMinutes: 60,
      shutdownTime: '17:30',
      officeStart: '08:30',
      officeEnd: '18:30',
      buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }, { weekday: 6, start: '10:00', minutes: 120 }],
    });
    expect(getSettings(db)).toEqual(saved);
    expect(db.prepare('SELECT updated_at FROM settings WHERE id = 1').pluck().get()).toBe('2026-09-29T04:00:00.000Z');
  });
});
```

Append to `server/exec/__tests__/settings-routes.test.ts`:

```ts
describe('PUT /api/exec/settings', () => {
  const schedule = {
    workDays: [1, 2, 3, 4],
    deepWorkStart: '08:35',
    deepWorkMinutes: 90,
    shutdownTime: '17:00',
    officeStart: '08:15',
    officeEnd: '18:00',
    buildBlocks: [],
  };

  it('saves the schedule and serves it back', async () => {
    const res = await request(app).put('/api/exec/settings').send(schedule);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ workDays: [1, 2, 3, 4], buildBlocks: [], timezone: 'Asia/Karachi' });
    expect((await request(app).get('/api/exec/settings')).body.data.workDays).toEqual([1, 2, 3, 4]);
  });

  it('refuses reversed office hours with a message and path, and a time zone as an unknown field', async () => {
    const reversed = await request(app).put('/api/exec/settings').send({ ...schedule, officeStart: '18:00', officeEnd: '08:00' });
    expect(reversed.status).toBe(400);
    expect(reversed.body).toMatchObject({ code: 'VALIDATION', details: [{ path: 'officeEnd', message: 'office hours must start before they end' }] });
    const zone = await request(app).put('/api/exec/settings').send({ ...schedule, timezone: 'UTC' });
    expect(zone.status).toBe(400);
    expect(JSON.stringify(zone.body)).not.toContain('timezone');
    expect(zone.body.details).toEqual([{ path: '', message: 'unknown field' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/settings-store.test.ts server/exec/__tests__/settings-routes.test.ts`
Expected: FAIL. `putSettings` is not exported, and `PUT /api/exec/settings` is a 404 (`no such endpoint`).

- [ ] **Step 3: Write the store function and the route**

Append to `server/exec/settings/store.ts`, and add the import `import type { SettingsUpdate } from '../../../src/shared/exec/todaySchemas';`:

```ts
/** Replaces the editable schedule (spec B, PUT /settings); the time zone and week start stay as seeded. */
export function putSettings(db: Database.Database, input: SettingsUpdate, now: string): Settings {
  const workDays = [...input.workDays].sort((a, b) => a - b);
  const buildBlocks = [...input.buildBlocks].sort((a, b) => a.weekday - b.weekday || a.start.localeCompare(b.start));
  db.prepare(
    `UPDATE settings SET work_days = ?, deep_work_start = ?, deep_work_minutes = ?, shutdown_time = ?,
       office_start = ?, office_end = ?, build_blocks = ?, updated_at = ? WHERE id = 1`
  ).run(
    JSON.stringify(workDays),
    input.deepWorkStart,
    input.deepWorkMinutes,
    input.shutdownTime,
    input.officeStart,
    input.officeEnd,
    JSON.stringify(buildBlocks),
    now
  );
  return getSettings(db);
}
```

Overwrite `server/exec/routes/settings.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok } from '../http';
import { nowIso } from '../clock';
import { getSettings, putSettings } from '../settings/store';
import { settingsUpdateSchema } from '../../../src/shared/exec/todaySchemas';

export function settingsRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  router.get('/', (_req, res) => ok(res, getSettings(db)));
  router.put('/', (req, res) => ok(res, putSettings(db, settingsUpdateSchema.parse(req.body), clock())));
  return router;
}
```

`createExecRouter` already calls `settingsRouter(db)`, and the default clock covers it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/exec`
Expected: PASS. That is 1 new store test, 2 new route tests, and every existing server test.

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add server/exec/settings/store.ts server/exec/routes/settings.ts server/exec/__tests__/settings-store.test.ts server/exec/__tests__/settings-routes.test.ts
git commit -m "feat: edit the schedule with PUT /api/exec/settings"
```

---

### Task 4: The Must Ships data module

**Files:**
- Create: `server/exec/mustShips/store.ts`
- Modify: `server/exec/rows.ts` (`ExecTable` gains `'must_ships'`)
- Test: `server/exec/__tests__/must-ships-store.test.ts`

**Interfaces:**
- Consumes: `toEntity`, `insertRow`, `updateRow`, `placeholders`, `type Bindable` (`rows.ts`); `ApiError` (`http.ts`); `addDays` (`dates.ts`); `weekStartOf` (`time.ts`); `type Context` (`schemas.ts`); `type MustShip`, `MustShipCreate`, `MustShipPatch`, `MustShipQuery`, `MustShipStatus` (`todaySchemas.ts`, Task 1). The tests also use `ensureWeek` (`weeks/store.ts`), `addOutcome` (`outcomes/store.ts`) and `createProject` (`projects/store.ts`).
- Produces:
  - `getMustShip(db, id): MustShip | null`
  - `listMustShips(db, query: MustShipQuery, weekStartDay = 0): MustShip[]`
  - `createMustShip(db, input: MustShipCreate, now): MustShip`, which throws `409 DAY_TAKEN` with `details.mustShip`
  - `patchMustShip(db, id, patch: MustShipPatch, now): MustShip | null`
  - `rollMustShip(db, id, date, now): MustShip | null`

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/must-ships-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { createProject } from '../projects/store';
import { createMustShip, getMustShip, listMustShips, patchMustShip, rollMustShip } from '../mustShips/store';
import { ApiError } from '../http';
import type { MustShipCreate } from '../../../src/shared/exec/todaySchemas';

const T0 = '2026-09-29T03:00:00.000Z';
const T1 = '2026-09-29T03:05:00.000Z';
let db: Database.Database;

const input = (title: string, overrides: Partial<MustShipCreate> = {}): MustShipCreate => ({
  title,
  context: 'work',
  date: '2026-09-29',
  definitionOfDone: '',
  outcomeId: null,
  projectId: null,
  notes: '',
  ...overrides,
});

function refusal(run: () => unknown): ApiError {
  try {
    run();
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected a refusal');
}

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('createMustShip', () => {
  it('creates a planned Must Ship with server-set fields', () => {
    const made = createMustShip(db, input('Supplier tracker sent'), T0);
    expect(made).toMatchObject({ title: 'Supplier tracker sent', context: 'work', date: '2026-09-29', status: 'planned', rollCount: 0, rolledFromId: null, closedAt: null, createdAt: T0 });
    expect(getMustShip(db, made.id)).toEqual(made);
  });

  it('refuses a second Must Ship for the same day and context with DAY_TAKEN naming the first', () => {
    createMustShip(db, input('First'), T0);
    const error = refusal(() => createMustShip(db, input('Second'), T0));
    expect(error).toMatchObject({ status: 409, code: 'DAY_TAKEN', message: 'that day already has a must ship' });
    expect(error.details).toMatchObject({ mustShip: { title: 'First' } });
    expect(createMustShip(db, input('Build it', { context: 'build' }), T0).context).toBe('build');
  });

  it('keeps any number of undated candidates', () => {
    createMustShip(db, input('A', { date: null }), T0);
    createMustShip(db, input('B', { date: null }), T0);
    expect(listMustShips(db, { date: 'none' })).toHaveLength(2);
  });
});

describe('listMustShips', () => {
  it('filters by candidates, date, week, status, outcome, project and context', () => {
    const weekId = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
    const outcome = addOutcome(db, weekId, { title: 'Supplier plan confirmed', category: 'office', description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, T0);
    const project = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    createMustShip(db, input('Old candidate', { date: null, projectId: project.id }), T0);
    createMustShip(db, input('New candidate', { date: null }), T1);
    createMustShip(db, input('Tuesday', { outcomeId: outcome.id }), T0);
    createMustShip(db, input('Monday', { date: '2026-09-28' }), T0);
    createMustShip(db, input('Next week', { date: '2026-10-05' }), T0);
    createMustShip(db, input('Build Tuesday', { context: 'build' }), T0);
    const titles = (query: Parameters<typeof listMustShips>[1]) => listMustShips(db, query).map((mustShip) => mustShip.title);
    expect(titles({ date: 'none' })).toEqual(['New candidate', 'Old candidate']);
    expect(titles({ date: '2026-09-29' })).toEqual(['Tuesday', 'Build Tuesday']);
    expect(titles({ week: '2026-10-01' })).toEqual(['Monday', 'Tuesday', 'Build Tuesday']);
    expect(titles({ outcome: outcome.id })).toEqual(['Tuesday']);
    expect(titles({ date: 'none', project: project.id })).toEqual(['Old candidate']);
    expect(titles({ context: 'build' })).toEqual(['Build Tuesday']);
    expect(titles({ status: ['shipped'] })).toEqual([]);
  });
});

describe('patchMustShip', () => {
  it('refuses moving onto a taken day but lets a Must Ship keep its own', () => {
    createMustShip(db, input('Monday', { date: '2026-09-28' }), T0);
    const tuesday = createMustShip(db, input('Tuesday'), T0);
    expect(refusal(() => patchMustShip(db, tuesday.id, { date: '2026-09-28' }, T1))).toMatchObject({ code: 'DAY_TAKEN' });
    expect(patchMustShip(db, tuesday.id, { date: '2026-09-29', title: 'Tuesday, renamed' }, T1)?.title).toBe('Tuesday, renamed');
    expect(patchMustShip(db, tuesday.id, { date: null }, T1)?.date).toBeNull();
  });

  it('closes on leaving planned and reopens on returning', () => {
    const made = createMustShip(db, input('Ship it'), T0);
    expect(patchMustShip(db, made.id, { status: 'shipped' }, T1)).toMatchObject({ status: 'shipped', closedAt: T1 });
    expect(patchMustShip(db, made.id, { status: 'partial' }, T0)?.closedAt).toBe(T1);
    expect(patchMustShip(db, made.id, { status: 'planned' }, T1)).toMatchObject({ status: 'planned', closedAt: null });
  });

  it('needs all three blocker fields to block', () => {
    const made = createMustShip(db, input('Ship it'), T0);
    expect(refusal(() => patchMustShip(db, made.id, { status: 'blocked', blockerWhat: 'Supplier silent' }, T1))).toMatchObject({
      status: 400,
      code: 'VALIDATION',
      message: 'a blocked must ship needs what blocks it, who owns it and the next action',
    });
    expect(getMustShip(db, made.id)?.status).toBe('planned');
    const blocked = patchMustShip(db, made.id, { status: 'blocked', blockerWhat: 'Supplier silent', blockerOwner: 'Bilal', blockerNextAction: 'Call the supplier' }, T1);
    expect(blocked).toMatchObject({ status: 'blocked', blockerOwner: 'Bilal' });
  });

  it('returns null for an unknown id', () => {
    expect(patchMustShip(db, '40000000-0000-4000-8000-000000000999', { title: 'x' }, T1)).toBeNull();
  });
});

describe('rollMustShip', () => {
  it('copies to the new date with lineage and one more roll; the original keeps its status', () => {
    const made = createMustShip(db, input('Tracker sent', { definitionOfDone: 'Sent to all 20' }), T0);
    patchMustShip(db, made.id, { status: 'partial' }, T0);
    const copy = rollMustShip(db, made.id, '2026-09-30', T1);
    expect(copy).toMatchObject({ title: 'Tracker sent', definitionOfDone: 'Sent to all 20', date: '2026-09-30', status: 'planned', rolledFromId: made.id, rollCount: 1, createdAt: T1 });
    expect(getMustShip(db, made.id)?.status).toBe('partial');
    expect(rollMustShip(db, copy!.id, '2026-10-01', T1)?.rollCount).toBe(2);
  });

  it('refuses shipped and killed Must Ships, its own day, and a taken day', () => {
    const shipped = createMustShip(db, input('Done', { date: '2026-09-28' }), T0);
    patchMustShip(db, shipped.id, { status: 'shipped' }, T0);
    expect(refusal(() => rollMustShip(db, shipped.id, '2026-09-30', T1))).toMatchObject({ code: 'VALIDATION', message: 'a shipped or killed must ship is not rolled forward' });
    const today = createMustShip(db, input('Today'), T0);
    expect(refusal(() => rollMustShip(db, today.id, '2026-09-29', T1))).toMatchObject({ code: 'VALIDATION', message: 'a must ship cannot be rolled onto its own day' });
    createMustShip(db, input('Tomorrow', { date: '2026-09-30' }), T0);
    expect(refusal(() => rollMustShip(db, today.id, '2026-09-30', T1))).toMatchObject({ code: 'DAY_TAKEN' });
    expect(rollMustShip(db, '40000000-0000-4000-8000-000000000999', '2026-09-30', T1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/must-ships-store.test.ts`
Expected: FAIL, because `../mustShips/store` cannot be resolved.

- [ ] **Step 3: Allow the table and write the store**

In `server/exec/rows.ts`, change the `ExecTable` line to:

```ts
export type ExecTable = 'tasks' | 'projects' | 'weeks' | 'outcomes' | 'must_ships';
```

Create `server/exec/mustShips/store.ts`:

```ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../http';
import { toEntity, insertRow, updateRow, placeholders, type Bindable } from '../rows';
import { addDays } from '../../../src/shared/exec/dates';
import { weekStartOf } from '../../../src/shared/exec/time';
import type { Context } from '../../../src/shared/exec/schemas';
import type { MustShip, MustShipCreate, MustShipPatch, MustShipQuery, MustShipStatus } from '../../../src/shared/exec/todaySchemas';

const BLOCKER_FIELDS = ['blockerWhat', 'blockerOwner', 'blockerNextAction'] as const;
const UNROLLABLE: readonly MustShipStatus[] = ['shipped', 'killed'];

export function getMustShip(db: Database.Database, id: string): MustShip | null {
  const row = db.prepare('SELECT * FROM must_ships WHERE id = ?').get(id);
  return row ? toEntity<MustShip>(row) : null;
}

/** Candidates first, newest first; then dated Must Ships by date and context. Filters combine with AND. */
export function listMustShips(db: Database.Database, query: MustShipQuery, weekStartDay = 0): MustShip[] {
  const clauses: string[] = [];
  const params: Bindable[] = [];
  if (query.date === 'none') clauses.push('date IS NULL');
  else if (query.date) {
    clauses.push('date = ?');
    params.push(query.date);
  }
  if (query.week) {
    const start = weekStartOf(query.week, weekStartDay);
    clauses.push('date BETWEEN ? AND ?');
    params.push(start, addDays(start, 6));
  }
  if (query.status) {
    clauses.push(`status IN (${placeholders(query.status.length)})`);
    params.push(...query.status);
  }
  if (query.outcome) {
    clauses.push('outcome_id = ?');
    params.push(query.outcome);
  }
  if (query.project) {
    clauses.push('project_id = ?');
    params.push(query.project);
  }
  if (query.context) {
    clauses.push('context = ?');
    params.push(query.context);
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  return db
    .prepare(`SELECT * FROM must_ships ${where} ORDER BY date IS NOT NULL, date, context DESC, created_at DESC, id`)
    .all(...params)
    .map((row) => toEntity<MustShip>(row));
}

/** One Must Ship per day per context (spec B): refuse with the one already holding the day. */
function assertDayFree(db: Database.Database, date: string | null, context: Context, exceptId: string | null): void {
  if (date === null) return;
  const row = db.prepare('SELECT * FROM must_ships WHERE date = ? AND context = ? AND id IS NOT ?').get(date, context, exceptId);
  if (row) throw new ApiError(409, 'DAY_TAKEN', 'that day already has a must ship', { mustShip: toEntity<MustShip>(row) });
}

export function createMustShip(db: Database.Database, input: MustShipCreate, now: string): MustShip {
  return db
    .transaction((): MustShip => {
      assertDayFree(db, input.date, input.context, null);
      const id = randomUUID();
      insertRow(db, 'must_ships', { ...input, id, createdAt: now, updatedAt: now });
      return getMustShip(db, id) as MustShip;
    })
    .immediate();
}

/** closedAt marks leaving `planned`; returning to it clears the mark. */
function closedAtFor(from: MustShipStatus, to: MustShipStatus, now: string): { closedAt?: string | null } {
  if (from === to) return {};
  if (to === 'planned') return { closedAt: null };
  return from === 'planned' ? { closedAt: now } : {};
}

/** Edits a Must Ship; moving it onto a taken day is DAY_TAKEN, and blocking needs all three blocker fields (§8). */
export function patchMustShip(db: Database.Database, id: string, patch: MustShipPatch, now: string): MustShip | null {
  return db
    .transaction((): MustShip | null => {
      const current = getMustShip(db, id);
      if (!current) return null;
      const next = { ...current, ...patch };
      if (next.status === 'blocked' && BLOCKER_FIELDS.some((field) => !next[field])) {
        throw new ApiError(400, 'VALIDATION', 'a blocked must ship needs what blocks it, who owns it and the next action');
      }
      if (patch.date !== undefined || patch.context !== undefined) assertDayFree(db, next.date, next.context, id);
      updateRow(db, 'must_ships', id, { ...patch, ...closedAtFor(current.status, next.status, now), updatedAt: now });
      return getMustShip(db, id);
    })
    .immediate();
}

/** Copies to `date` with lineage and one more roll; the original keeps its status (spec B, POST /must-ships/:id/roll). */
export function rollMustShip(db: Database.Database, id: string, date: string, now: string): MustShip | null {
  return db
    .transaction((): MustShip | null => {
      const source = getMustShip(db, id);
      if (!source) return null;
      if (UNROLLABLE.includes(source.status)) throw new ApiError(400, 'VALIDATION', 'a shipped or killed must ship is not rolled forward');
      if (source.date === date) throw new ApiError(400, 'VALIDATION', 'a must ship cannot be rolled onto its own day');
      assertDayFree(db, date, source.context, null);
      const copyId = randomUUID();
      insertRow(db, 'must_ships', {
        id: copyId,
        title: source.title,
        definitionOfDone: source.definitionOfDone,
        context: source.context,
        date,
        outcomeId: source.outcomeId,
        projectId: source.projectId,
        notes: source.notes,
        rolledFromId: source.id,
        rollCount: source.rollCount + 1,
        createdAt: now,
        updatedAt: now,
      });
      return getMustShip(db, copyId);
    })
    .immediate();
}
```

The list orders dated rows `context DESC` so that `work` sorts before `build` on the same date, which is why the test expects `['Tuesday', 'Build Tuesday']`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/must-ships-store.test.ts`
Expected: PASS, 10 tests.

Run: `npx vitest run server/exec && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 5: Commit**

```bash
git add server/exec/rows.ts server/exec/mustShips/store.ts server/exec/__tests__/must-ships-store.test.ts
git commit -m "feat: add the Must Ships data module with one per day, candidates, blockers and roll"
```

---

### Task 5: Serve Must Ships under /api/exec

**Files:**
- Create: `server/exec/routes/mustShips.ts`
- Modify: `server/exec/router.ts`
- Test: `server/exec/__tests__/must-ships-routes.test.ts`

**Interfaces:**
- Consumes: the Task 4 store; `getSettings` (`settings/store.ts`); `mustShipCreateSchema`, `mustShipPatchSchema`, `mustShipQuerySchema`, `mustShipRollSchema`, `mustShipSchema` (`todaySchemas.ts`); `ok`, `ApiError` (`http.ts`); `nowIso`.
- Produces: `mustShipsRouter(db, clock = nowIso)`, mounted at `/must-ships` after `/outcomes`. Its routes:
  - `GET /` returns `MustShip[]`.
  - `POST /` returns 201, or `409 DAY_TAKEN` with `details.mustShip`.
  - `PATCH /:id` updates a Must Ship.
  - `POST /:id/roll` returns 201.
  - An unknown id gets `404 NOT_FOUND 'no such must ship'`.

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/must-ships-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { mustShipSchema } from '../../../src/shared/exec/todaySchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const create = (body: Record<string, unknown>) => request(app).post('/api/exec/must-ships').send(body);
const today = { title: 'Supplier tracker sent', context: 'work', date: '2026-09-29' };
const missing = { success: false, error: 'no such must ship', code: 'NOT_FOUND' };

describe('/api/exec/must-ships', () => {
  it('creates a Must Ship (201) and refuses a second for the day with DAY_TAKEN and the first', async () => {
    const first = await create(today);
    expect(first.status).toBe(201);
    expect(mustShipSchema.safeParse(first.body.data).success).toBe(true);
    const second = await create({ ...today, title: 'Something else' });
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ success: false, code: 'DAY_TAKEN', error: 'that day already has a must ship', details: { mustShip: { title: 'Supplier tracker sent' } } });
  });

  it('lists candidates with date=none and a day with its date', async () => {
    await create({ title: 'Candidate', context: 'work' });
    await create(today);
    expect((await request(app).get('/api/exec/must-ships?date=none')).body.data.map((m: { title: string }) => m.title)).toEqual(['Candidate']);
    expect((await request(app).get('/api/exec/must-ships?date=2026-09-29&status=planned')).body.data.map((m: { title: string }) => m.title)).toEqual(['Supplier tracker sent']);
    const bad = await request(app).get('/api/exec/must-ships?date=tomorrow');
    expect(bad.status).toBe(400);
  });

  it('patches, refuses a half-filled blocker, and 404s an unknown id', async () => {
    const id = (await create(today)).body.data.id as string;
    expect((await request(app).patch(`/api/exec/must-ships/${id}`).send({ status: 'shipped' })).body.data).toMatchObject({ status: 'shipped' });
    const half = await request(app).patch(`/api/exec/must-ships/${id}`).send({ status: 'blocked', blockerWhat: 'Supplier silent' });
    expect(half.status).toBe(400);
    expect(half.body.code).toBe('VALIDATION');
    const unknown = await request(app).patch('/api/exec/must-ships/40000000-0000-4000-8000-000000000999').send({ title: 'x' });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual(missing);
  });

  it('rolls to a new day (201) with lineage', async () => {
    const id = (await create(today)).body.data.id as string;
    const copy = await request(app).post(`/api/exec/must-ships/${id}/roll`).send({ date: '2026-09-30' });
    expect(copy.status).toBe(201);
    expect(copy.body.data).toMatchObject({ date: '2026-09-30', rolledFromId: id, rollCount: 1 });
    expect((await request(app).post('/api/exec/must-ships/40000000-0000-4000-8000-000000000999/roll').send({ date: '2026-09-30' })).body).toEqual(missing);
  });

  it('never echoes an unknown field', async () => {
    const res = await create({ ...today, status: 'shipped' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ path: '', message: 'unknown field' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/must-ships-routes.test.ts`
Expected: FAIL. Every call answers `404 no such endpoint`.

- [ ] **Step 3: Write the router and mount it**

Create `server/exec/routes/mustShips.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { createMustShip, listMustShips, patchMustShip, rollMustShip } from '../mustShips/store';
import { mustShipCreateSchema, mustShipPatchSchema, mustShipQuerySchema, mustShipRollSchema } from '../../../src/shared/exec/todaySchemas';

export function mustShipsRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such must ship');

  router.get('/', (req, res) => {
    const query = mustShipQuerySchema.parse(req.query);
    ok(res, listMustShips(db, query, getSettings(db).weekStartDay));
  });

  router.post('/', (req, res) => {
    const input = mustShipCreateSchema.parse(req.body);
    ok(res, createMustShip(db, input, clock()), 201);
  });

  router.patch('/:id', (req, res) => {
    const patch = mustShipPatchSchema.parse(req.body);
    const mustShip = patchMustShip(db, req.params.id, patch, clock());
    if (!mustShip) throw notFound();
    ok(res, mustShip);
  });

  router.post('/:id/roll', (req, res) => {
    const { date } = mustShipRollSchema.parse(req.body);
    const copy = rollMustShip(db, req.params.id, date, clock());
    if (!copy) throw notFound();
    ok(res, copy, 201);
  });

  return router;
}
```

In `server/exec/router.ts`, add `import { mustShipsRouter } from './routes/mustShips';` beside the other route imports, and after `router.use('/outcomes', outcomesRouter(db));` add:

```ts
  router.use('/must-ships', mustShipsRouter(db));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/must-ships-routes.test.ts`
Expected: PASS, 5 tests.

Run: `npx vitest run server/exec && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 5: Commit**

```bash
git add server/exec/routes/mustShips.ts server/exec/router.ts server/exec/__tests__/must-ships-routes.test.ts
git commit -m "feat: serve Must Ships under /api/exec with DAY_TAKEN and roll"
```

---

### Task 6: The day in one read, and the two secondaries

**Files:**
- Create: `server/exec/days/store.ts`, `server/exec/routes/days.ts`
- Modify: `server/exec/router.ts`
- Test: `server/exec/__tests__/days-store.test.ts`, `server/exec/__tests__/days-routes.test.ts`

**Interfaces:**
- Consumes:
  - `toEntity` (`rows.ts`); `ApiError`, `ok` (`http.ts`)
  - `lookupWeek` (`weeks/store.ts`); `getTask`, `listTasks`, `patchTask` (`tasks/store.ts`); `getSettings`
  - `type Task` (`schemas.ts`); `type Day`, `DayView`, `DeepWorkBlock`, `MustShip`, `Secondary`, `dayParamsSchema`, `daySlotsSchema`, `dayViewSchema` (`todaySchemas.ts`)
  - The tests also use `createTask`, `patchTask`, `ensureWeek`, `addOutcome` and `createMustShip`.
- Produces:
  - `getDayView(db, date, weekStartDay): DayView`, which never creates rows
  - `setDaySlots(db, date, taskIds, now, weekStartDay): DayView`, which throws `400 SLOT_LIMIT` beyond two and `400 VALIDATION` for a duplicate or unknown id
  - `daysRouter(db, clock = nowIso)`, mounted at `/days`: `GET /:date` returns a `DayView`, and `PUT /:date/slots` takes `{ taskIds }` and returns a `DayView`

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/days-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { createTask, getTask, patchTask } from '../tasks/store';
import { ensureWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { createMustShip } from '../mustShips/store';
import { getDayView, setDaySlots } from '../days/store';
import { ApiError } from '../http';

const T0 = '2026-09-29T03:00:00.000Z';
const T1 = '2026-09-29T03:05:00.000Z';
const DATE = '2026-09-29';
let db: Database.Database;

const capture = (title: string) => createTask(db, { title, context: 'work', notes: '' }, T0);
const mustShip = (title: string, context: 'work' | 'build', date: string | null = DATE) =>
  createMustShip(db, { title, context, date, definitionOfDone: '', outcomeId: null, projectId: null, notes: '' }, T0);

beforeEach(() => {
  db = prepareExecDb(':memory:');
});

describe('getDayView', () => {
  it('describes an empty day without creating anything', () => {
    expect(getDayView(db, DATE, 0)).toEqual({
      date: DATE, day: null, week: null, hasHistory: false, mustShip: null, buildMustShip: null,
      secondaries: [], waiting: [], blocks: [], inboxCount: 0,
    });
    expect(db.prepare('SELECT COUNT(*) FROM days').pluck().get()).toBe(0);
  });

  it('gathers the week, both Must Ships, the waiting items due, the blocks and the inbox count', () => {
    const weekId = ensureWeek(db, DATE, 0, T0).view.week.id;
    addOutcome(db, weekId, { title: 'Supplier plan confirmed', category: 'office', description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, T0);
    mustShip('Tracker sent', 'work');
    mustShip('Landing page live', 'build');
    mustShip('Someday', 'work', null);
    capture('Still in the inbox');
    const due = capture('Chase Bilal');
    patchTask(db, due.id, { status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-28' }, T1);
    const later = capture('Not yet');
    patchTask(db, later.id, { status: 'waiting', ownerName: 'Sara', followUpDate: '2026-10-02' }, T1);
    db.prepare(
      `INSERT INTO deep_work_blocks (id, date, context, planned_start, planned_minutes, created_at, updated_at)
       VALUES ('50000000-0000-4000-8000-000000000001', ?, 'work', '08:35', 90, ?, ?)`
    ).run(DATE, T0, T0);
    const view = getDayView(db, DATE, 0);
    expect(view.week?.outcomes.map((outcome) => outcome.title)).toEqual(['Supplier plan confirmed']);
    expect(view.mustShip?.title).toBe('Tracker sent');
    expect(view.buildMustShip?.title).toBe('Landing page live');
    expect(view.waiting.map((task) => task.title)).toEqual(['Chase Bilal']);
    expect(view.blocks).toMatchObject([{ plannedStart: '08:35', plannedMinutes: 90, mustShipId: null }]);
    expect(view.inboxCount).toBe(1);
  });
});

describe('setDaySlots', () => {
  it('fills the two slots in order, creates the day, and processes an inbox task onto today', () => {
    const inbox = capture('Send the price list');
    const committed = capture('Review the dashboard');
    patchTask(db, committed.id, { status: 'this_week' }, T0);
    const view = setDaySlots(db, DATE, [committed.id, inbox.id], T1, 0);
    expect(view.secondaries.map((secondary) => [secondary.slot, secondary.task.title])).toEqual([[1, 'Review the dashboard'], [2, 'Send the price list']]);
    expect(view.day).toMatchObject({ date: DATE, shutdownAt: null });
    expect(getTask(db, inbox.id)).toMatchObject({ status: 'this_week', scheduledDate: DATE, processedAt: T1 });
    expect(getTask(db, committed.id)?.scheduledDate).toBeNull();
  });

  it('replaces the slots rather than adding to them', () => {
    const a = capture('A');
    const b = capture('B');
    setDaySlots(db, DATE, [a.id, b.id], T0, 0);
    expect(setDaySlots(db, DATE, [b.id], T1, 0).secondaries.map((secondary) => [secondary.slot, secondary.task.title])).toEqual([[1, 'B']]);
    expect(setDaySlots(db, DATE, [], T1, 0).secondaries).toEqual([]);
  });

  it('refuses a third secondary, a repeat and an unknown task, changing nothing', () => {
    const [a, b, c] = ['A', 'B', 'C'].map(capture);
    setDaySlots(db, DATE, [a.id], T0, 0);
    const attempt = (ids: string[]) => {
      try {
        setDaySlots(db, DATE, ids, T1, 0);
      } catch (error) {
        return error as ApiError;
      }
      throw new Error('expected a refusal');
    };
    expect(attempt([a.id, b.id, c.id])).toMatchObject({ status: 400, code: 'SLOT_LIMIT', message: 'a day holds at most two secondary tasks' });
    expect(attempt([b.id, b.id])).toMatchObject({ status: 400, code: 'VALIDATION', message: 'a task can fill only one slot' });
    expect(attempt([b.id, '00000000-0000-4000-8000-000000000999'])).toMatchObject({ status: 400, code: 'VALIDATION', message: 'no such task' });
    expect(getDayView(db, DATE, 0).secondaries.map((secondary) => secondary.task.title)).toEqual(['A']);
    expect(getTask(db, b.id)?.status).toBe('inbox');
  });
});
```

Create `server/exec/__tests__/days-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { dayViewSchema } from '../../../src/shared/exec/todaySchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const capture = async (title: string) => (await request(app).post('/api/exec/tasks').send({ title, context: 'work' })).body.data.id as string;

describe('/api/exec/days', () => {
  it('reads a day as the Today screen needs it', async () => {
    const res = await request(app).get('/api/exec/days/2026-09-29');
    expect(res.status).toBe(200);
    expect(dayViewSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toMatchObject({ date: '2026-09-29', day: null, mustShip: null, secondaries: [] });
  });

  it('refuses a date that is not a calendar date', async () => {
    const res = await request(app).get('/api/exec/days/2026-02-30');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('sets two secondaries and refuses a third with SLOT_LIMIT', async () => {
    const ids = [await capture('A'), await capture('B'), await capture('C')];
    const two = await request(app).put('/api/exec/days/2026-09-29/slots').send({ taskIds: ids.slice(0, 2) });
    expect(two.status).toBe(200);
    expect(two.body.data.secondaries).toHaveLength(2);
    const three = await request(app).put('/api/exec/days/2026-09-29/slots').send({ taskIds: ids });
    expect(three.status).toBe(400);
    expect(three.body).toEqual({ success: false, error: 'a day holds at most two secondary tasks', code: 'SLOT_LIMIT' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/days-store.test.ts server/exec/__tests__/days-routes.test.ts`
Expected: FAIL. `../days/store` cannot be resolved, and `/api/exec/days/*` is `404 no such endpoint`.

- [ ] **Step 3: Write the store**

Create `server/exec/days/store.ts`:

```ts
import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { toEntity } from '../rows';
import { lookupWeek } from '../weeks/store';
import { getTask, listTasks, patchTask } from '../tasks/store';
import type { Context, Task } from '../../../src/shared/exec/schemas';
import type { Day, DayView, DeepWorkBlock, MustShip, Secondary } from '../../../src/shared/exec/todaySchemas';

const MAX_SECONDARIES = 2;

function mustShipFor(db: Database.Database, date: string, context: Context): MustShip | null {
  const row = db.prepare('SELECT * FROM must_ships WHERE date = ? AND context = ?').get(date, context);
  return row ? toEntity<MustShip>(row) : null;
}

function secondariesFor(db: Database.Database, date: string): Secondary[] {
  return db
    .prepare('SELECT ds.slot AS slot_number, t.* FROM day_slots ds JOIN tasks t ON t.id = ds.task_id WHERE ds.date = ? ORDER BY ds.slot')
    .all(date)
    .map((row) => {
      const { slotNumber, ...task } = toEntity<Task & { slotNumber: number }>(row);
      return { slot: slotNumber, task };
    });
}

/** The Today screen in one read (spec B, GET /days/:date). Reading never creates a row. */
export function getDayView(db: Database.Database, date: string, weekStartDay: number): DayView {
  const { current, hasHistory } = lookupWeek(db, date, weekStartDay);
  const day = db.prepare('SELECT * FROM days WHERE date = ?').get(date);
  return {
    date,
    day: day ? toEntity<Day>(day) : null,
    week: current,
    hasHistory,
    mustShip: mustShipFor(db, date, 'work'),
    buildMustShip: mustShipFor(db, date, 'build'),
    secondaries: secondariesFor(db, date),
    waiting: listTasks(db, { followUpBy: date }),
    blocks: db
      .prepare('SELECT * FROM deep_work_blocks WHERE date = ? ORDER BY planned_start, id')
      .all(date)
      .map((row) => toEntity<DeepWorkBlock>(row)),
    inboxCount: db.prepare("SELECT COUNT(*) FROM tasks WHERE status = 'inbox'").pluck().get() as number,
  };
}

function checkedTasks(db: Database.Database, taskIds: string[]): Task[] {
  if (taskIds.length > MAX_SECONDARIES) throw new ApiError(400, 'SLOT_LIMIT', 'a day holds at most two secondary tasks');
  if (new Set(taskIds).size !== taskIds.length) throw new ApiError(400, 'VALIDATION', 'a task can fill only one slot');
  return taskIds.map((id) => {
    const task = getTask(db, id);
    if (!task) throw new ApiError(400, 'VALIDATION', 'no such task');
    return task;
  });
}

/** Replaces the day's secondaries (spec B, PUT /days/:date/slots). An inbox task chosen for today is processed onto it. */
export function setDaySlots(db: Database.Database, date: string, taskIds: string[], now: string, weekStartDay: number): DayView {
  db.transaction(() => {
    const tasks = checkedTasks(db, taskIds);
    db.prepare('INSERT INTO days (date, created_at, updated_at) VALUES (?, ?, ?) ON CONFLICT (date) DO NOTHING').run(date, now, now);
    db.prepare('DELETE FROM day_slots WHERE date = ?').run(date);
    const insert = db.prepare('INSERT INTO day_slots (date, slot, task_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    tasks.forEach((task, index) => {
      insert.run(date, index + 1, task.id, now, now);
      if (task.status === 'inbox') patchTask(db, task.id, { status: 'this_week', scheduledDate: date }, now);
    });
  }).immediate();
  return getDayView(db, date, weekStartDay);
}
```

- [ ] **Step 4: Write the router and mount it**

Create `server/exec/routes/days.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { getDayView, setDaySlots } from '../days/store';
import { dayParamsSchema, daySlotsSchema } from '../../../src/shared/exec/todaySchemas';

export function daysRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const weekStartDay = () => getSettings(db).weekStartDay;

  router.get('/:date', (req, res) => {
    const { date } = dayParamsSchema.parse(req.params);
    ok(res, getDayView(db, date, weekStartDay()));
  });

  router.put('/:date/slots', (req, res) => {
    const { date } = dayParamsSchema.parse(req.params);
    const { taskIds } = daySlotsSchema.parse(req.body);
    ok(res, setDaySlots(db, date, taskIds, clock(), weekStartDay()));
  });

  return router;
}
```

In `server/exec/router.ts`, add `import { daysRouter } from './routes/days';`, and after the `/must-ships` mount add:

```ts
  router.use('/days', daysRouter(db));
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/days-store.test.ts server/exec/__tests__/days-routes.test.ts`
Expected: PASS, 5 store tests and 3 route tests.

Run: `npx vitest run server/exec && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 6: Commit**

```bash
git add server/exec/days/store.ts server/exec/routes/days.ts server/exec/router.ts server/exec/__tests__/days-store.test.ts server/exec/__tests__/days-routes.test.ts
git commit -m "feat: read the day in one call and set its two secondaries under /api/exec"
```

---

### Task 7: Client hooks for Must Ships, days and the schedule

**Files:**
- Create: `src/api/keys.ts`, `src/api/mustShips.ts`, `src/api/days.ts`, `src/lib/useNow.ts`
- Modify: `src/api/tasks.ts`, `src/api/weeks.ts`, `src/api/projects.ts`, `src/api/settings.ts`, `src/api/errors.ts`, `src/lib/useToday.ts`
- Test: `src/api/mustShips.test.tsx`, `src/api/days.test.tsx`, `src/api/settings.test.tsx`, `src/lib/useToday.test.tsx`, `src/api/errors.test.tsx` (append)

**Interfaces:**
- Consumes:
  - `api`, `ApiError` (`client.ts`); `toQueryString`; `useToast`
  - `type Settings`, `Context` (`schemas.ts`)
  - `type MustShip`, `MustShipInput`, `MustShipPatch`, `MustShipStatus`, `DayView`, `SettingsUpdate` (`todaySchemas.ts`)
  - `localClock`, `toCalendarDate`
- Produces:
  - `keys.ts`: `tasksKey`, `settingsKey`, `projectsKey`, `weeksKey`, `mustShipsKey`, `daysKey`. The existing modules re-export their own key, so imports of `tasksKey` from `./tasks` keep working.
  - `mustShips.ts`: `type MustShipFilters`, `useMustShips(filters, { enabled? })`, `useCreateMustShip()`, `useUpdateMustShip()` (variables `{ id, patch }`) and `useRollMustShip()` (variables `{ id, date }`).
    - Every Must Ship write invalidates must ships, days and projects.
    - A `DAY_TAKEN` failure invalidates days and must ships too, so the Must Ship that won shows.
  - `days.ts`: `useDay(date, { enabled? })` and `useSetSecondaries()` (variables `{ date, taskIds }`), which invalidates days and tasks.
  - `settings.ts`: `useUpdateSettings()`, which writes the saved settings into the cache and invalidates days.
  - `tasks.ts`: every task write now also invalidates days. `weeks.ts`: every outcome write now also invalidates days.
  - `errors.ts`: friendly text for `DAY_TAKEN` (`'that day already has a Must Ship'`) and `SLOT_LIMIT` (`'a day holds at most two secondary tasks'`), plus `dayTakenMustShip(error): MustShip | null`.
  - `useNow(intervalMs = 60_000): Date`.
  - `useToday()` now returns `{ today, weekStartDay, ready, now, settings }`, and `today` rolls over at local midnight without a reload.

- [ ] **Step 1: Write the failing tests**

Create `src/api/mustShips.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useMustShips, useCreateMustShip, useUpdateMustShip, useRollMustShip } from './mustShips';
import { useDay } from './days';
import { stubFetch, json } from '../test/fetch';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);
const dayTaken = () =>
  new Response(JSON.stringify({ success: false, error: 'that day already has a must ship', code: 'DAY_TAKEN', details: { mustShip: { title: 'First' } } }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

afterEach(() => vi.unstubAllGlobals());

describe('Must Ship hooks', () => {
  it('lists candidates with date=none and a status list', async () => {
    const calls = stubFetch(() => json([]));
    const { result } = renderHook(() => useMustShips({ date: 'none', context: 'work', status: ['planned'] }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0].url).toBe('/api/exec/must-ships?date=none&status=planned&context=work');
  });

  it('creates, patches and rolls, and every write refreshes the open day', async () => {
    const calls = stubFetch((url) => (url.startsWith('/api/exec/days/') ? json({}) : json({ id: 'm1' })));
    const { result } = renderHook(() => ({ day: useDay('2026-09-29'), create: useCreateMustShip(), update: useUpdateMustShip(), roll: useRollMustShip() }), { wrapper });
    await waitFor(() => expect(result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({ title: 'Tracker sent', context: 'work', date: '2026-09-29' });
      await result.current.update.mutateAsync({ id: 'm1', patch: { title: 'Tracker sent to all' } });
      await result.current.roll.mutateAsync({ id: 'm1', date: '2026-09-30' });
    });
    expect(calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', '/api/exec/must-ships', { title: 'Tracker sent', context: 'work', date: '2026-09-29' }],
      ['PATCH', '/api/exec/must-ships/m1', { title: 'Tracker sent to all' }],
      ['POST', '/api/exec/must-ships/m1/roll', { date: '2026-09-30' }],
    ]);
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29').length).toBeGreaterThanOrEqual(4));
  });

  it('refreshes the day after DAY_TAKEN so the Must Ship that won shows', async () => {
    const calls = stubFetch((url, init) => (init?.method === 'POST' ? dayTaken() : json({})));
    const { result } = renderHook(() => ({ day: useDay('2026-09-29'), create: useCreateMustShip() }), { wrapper });
    await waitFor(() => expect(result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({ title: 'Second', context: 'work', date: '2026-09-29' }).catch(() => undefined);
    });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29')).toHaveLength(2));
  });
});
```

Create `src/api/days.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useDay, useSetSecondaries } from './days';
import { useTasks, useUpdateTask } from './tasks';
import { stubFetch, json } from '../test/fetch';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('day hooks', () => {
  it('does not read the day until it is enabled', async () => {
    const calls = stubFetch(() => json({}));
    const { rerender } = renderHook(({ enabled }) => useDay('2026-09-29', { enabled }), { wrapper, initialProps: { enabled: false } });
    expect(calls).toHaveLength(0);
    rerender({ enabled: true });
    await waitFor(() => expect(calls.map((c) => c.url)).toEqual(['/api/exec/days/2026-09-29']));
  });

  it('puts the secondaries and refreshes the day and the task lists', async () => {
    const calls = stubFetch((url) => (url.startsWith('/api/exec/tasks') ? json([]) : json({})));
    const { result } = renderHook(() => ({ day: useDay('2026-09-29'), tasks: useTasks({ status: ['inbox'] }), set: useSetSecondaries() }), { wrapper });
    await waitFor(() => expect(result.current.tasks.isSuccess && result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.set.mutateAsync({ date: '2026-09-29', taskIds: ['t1'] });
    });
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ url: '/api/exec/days/2026-09-29/slots', body: { taskIds: ['t1'] } });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/tasks?status=inbox')).toHaveLength(2));
    expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29')).toHaveLength(2);
  });

  it('refreshes the day after any task write, so Waiting and secondaries stay current', async () => {
    const calls = stubFetch(() => json({}));
    const { result } = renderHook(() => ({ day: useDay('2026-09-29'), update: useUpdateTask() }), { wrapper });
    await waitFor(() => expect(result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.update.mutateAsync({ id: 't1', patch: { status: 'done' } });
    });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29')).toHaveLength(2));
  });
});
```

Create `src/api/settings.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useSettings, useUpdateSettings } from './settings';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('useUpdateSettings', () => {
  it('puts the schedule and serves the saved settings from the cache at once', async () => {
    const saved = { ...SETTINGS, workDays: [1, 2, 3, 4] };
    const calls = stubFetch((_url, init) => json(init?.method === 'PUT' ? saved : SETTINGS));
    const { result } = renderHook(() => ({ read: useSettings(), write: useUpdateSettings() }), { wrapper });
    await waitFor(() => expect(result.current.read.data?.workDays).toEqual([1, 2, 3, 4, 5]));
    const schedule = { workDays: [1, 2, 3, 4], deepWorkStart: '08:35', deepWorkMinutes: 90, shutdownTime: '17:00', officeStart: '08:15', officeEnd: '18:00', buildBlocks: SETTINGS.buildBlocks };
    await act(async () => {
      await result.current.write.mutateAsync(schedule);
    });
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ url: '/api/exec/settings', body: schedule });
    expect(result.current.read.data?.workDays).toEqual([1, 2, 3, 4]);
  });
});
```

Create `src/lib/useToday.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from '../api/queryClient';
import { useToday } from './useToday';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useToday', () => {
  it('rolls over at Karachi midnight without a reload', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T18:59:30Z') });
    stubFetch(() => json(SETTINGS));
    const { result } = renderHook(() => useToday(), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.today).toBe('2026-09-29');
    expect(result.current.settings?.workDays).toEqual([1, 2, 3, 4, 5]);
    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.today).toBe('2026-09-30');
  });
});
```

`2026-09-29T18:59:30Z` is 23:59:30 in Karachi, and one minute later it is 00:00:30 on the 30th.

Append to `src/api/errors.test.tsx`, adding `dayTakenMustShip` to its existing import from `./errors` (it already imports `ApiError` from `./client`):

```ts
describe('DAY_TAKEN and SLOT_LIMIT', () => {
  it('speaks plainly and hands back the Must Ship holding the day', () => {
    const taken = new ApiError(409, 'DAY_TAKEN', 'that day already has a must ship', { mustShip: { title: 'First' } });
    expect(errorMessage(taken)).toBe('that day already has a Must Ship');
    expect(errorMessage(new ApiError(400, 'SLOT_LIMIT', 'x'))).toBe('a day holds at most two secondary tasks');
    expect(dayTakenMustShip(taken)).toEqual({ title: 'First' });
    expect(dayTakenMustShip(new ApiError(409, 'WEEK_FULL', 'x'))).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/api src/lib/useToday.test.tsx`
Expected: FAIL. `./mustShips` and `./days` cannot be resolved, `useUpdateSettings` and `dayTakenMustShip` are not exported, and `useToday` has no `settings` and never rolls over.

- [ ] **Step 3: Add the key module and switch the existing hooks to it**

Create `src/api/keys.ts`:

```ts
/** Every query key prefix in one place, so hooks can refresh each other without import cycles. */
export const tasksKey = ['exec', 'tasks'] as const;
export const settingsKey = ['exec', 'settings'] as const;
export const projectsKey = ['exec', 'projects'] as const;
export const weeksKey = ['exec', 'weeks'] as const;
export const mustShipsKey = ['exec', 'mustShips'] as const;
export const daysKey = ['exec', 'days'] as const;
```

In `src/api/tasks.ts`:
- Replace `export const tasksKey = ['exec', 'tasks'] as const;` with:

```ts
import { daysKey, tasksKey } from './keys';

export { tasksKey };
```

- Replace the body of `useTasksMutation`'s `onSuccess` so it refreshes the day too:

```ts
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: tasksKey }), queryClient.invalidateQueries({ queryKey: daysKey })]),
```

- Update its doc comment to: `/** Every write invalidates every tasks query and the day, so lists and Today refresh without bookkeeping. */`

In `src/api/projects.ts`, delete the `export const projectsKey = …` line, the comment line `// Kept literal here: …`, and the local `const weeksKey = …` line, then add below the other imports:

```ts
import { projectsKey, weeksKey } from './keys';

export { projectsKey };
```

In `src/api/weeks.ts`:
- Delete `import { projectsKey } from './projects';` and `export const weeksKey = ['exec', 'weeks'] as const;`.
- Add:

```ts
import { daysKey, projectsKey, weeksKey } from './keys';

export { weeksKey };
```

- Change `useOutcomeMutation`'s `onSuccess` to:

```ts
    onSuccess: () => Promise.all([weeksKey, projectsKey, daysKey].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
```

- Change its doc comment to `/** Weeks, projects and Today all show outcomes, so every outcome write refreshes all three. */`.

- [ ] **Step 4: Write the new hooks**

Overwrite `src/api/settings.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Settings } from '../shared/exec/schemas';
import type { SettingsUpdate } from '../shared/exec/todaySchemas';
import { api, ApiError } from './client';
import { daysKey, settingsKey } from './keys';

export { settingsKey };

export function useSettings() {
  return useQuery<Settings, ApiError>({ queryKey: settingsKey, queryFn: () => api.get<Settings>('/settings') });
}

/** The schedule decides Today's moment, so the saved settings go straight into the cache and the day refreshes. */
export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation<Settings, ApiError, SettingsUpdate>({
    mutationFn: (input) => api.put<Settings>('/settings', input),
    onSuccess: (saved) => {
      queryClient.setQueryData(settingsKey, saved);
      return queryClient.invalidateQueries({ queryKey: daysKey });
    },
  });
}
```

Create `src/api/days.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayView } from '../shared/exec/todaySchemas';
import { api, ApiError } from './client';
import { daysKey, tasksKey } from './keys';

export { daysKey };

/** The Today screen in one read. Pass `enabled: false` until the date is trustworthy (settings loaded). */
export function useDay(date: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<DayView, ApiError>({ queryKey: [...daysKey, date], queryFn: () => api.get<DayView>(`/days/${date}`), enabled });
}

/** Setting the secondaries can process an inbox task, so the day and every task list refresh. */
export function useSetSecondaries() {
  const queryClient = useQueryClient();
  return useMutation<DayView, ApiError, { date: string; taskIds: string[] }>({
    mutationFn: ({ date, taskIds }) => api.put<DayView>(`/days/${date}/slots`, { taskIds }),
    onSuccess: () => Promise.all([daysKey, tasksKey].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
```

Create `src/api/mustShips.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Context } from '../shared/exec/schemas';
import type { MustShip, MustShipInput, MustShipPatch, MustShipStatus } from '../shared/exec/todaySchemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { daysKey, mustShipsKey, projectsKey } from './keys';

export { mustShipsKey };

/** `date: 'none'` lists candidates; `week` is any day of a planning week. */
export type MustShipFilters = { date?: string; week?: string; status?: MustShipStatus[]; outcome?: string; project?: string; context?: Context };

const listPath = (filters: MustShipFilters): string =>
  `/must-ships${toQueryString({ date: filters.date, week: filters.week, status: filters.status, outcome: filters.outcome, project: filters.project, context: filters.context })}`;

export function useMustShips(filters: MustShipFilters, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<MustShip[], ApiError>({ queryKey: [...mustShipsKey, filters], queryFn: () => api.get<MustShip[]>(listPath(filters)), enabled });
}

/**
 * Today, the week's counts and project candidates all show Must Ships, so every write refreshes them.
 * A DAY_TAKEN refusal refreshes too: another tab won the day, and Today should show the winner.
 */
function useMustShipMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<MustShip>) {
  const queryClient = useQueryClient();
  const refresh = (keys: readonly (readonly string[])[]) => Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  return useMutation<MustShip, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => refresh([mustShipsKey, daysKey, projectsKey]),
    onError: (error) => (error.code === 'DAY_TAKEN' ? refresh([mustShipsKey, daysKey]) : undefined),
  });
}

export const useCreateMustShip = () => useMustShipMutation((input: MustShipInput) => api.post<MustShip>('/must-ships', input));

export const useUpdateMustShip = () =>
  useMustShipMutation(({ id, patch }: { id: string; patch: MustShipPatch }) => api.patch<MustShip>(`/must-ships/${id}`, patch));

export const useRollMustShip = () =>
  useMustShipMutation(({ id, date }: { id: string; date: string }) => api.post<MustShip>(`/must-ships/${id}/roll`, { date }));
```

In `src/api/errors.ts`, add two entries to `FRIENDLY`:

```ts
  DAY_TAKEN: 'that day already has a Must Ship',
  SLOT_LIMIT: 'a day holds at most two secondary tasks',
```

Then add `import type { MustShip } from '../shared/exec/todaySchemas';` and append:

```ts
/** The Must Ship already holding the day that a DAY_TAKEN refusal names; null for any other error. */
export function dayTakenMustShip(error: unknown): MustShip | null {
  if (!(error instanceof ApiError) || error.code !== 'DAY_TAKEN') return null;
  return (error.details as { mustShip?: MustShip } | undefined)?.mustShip ?? null;
}
```

Create `src/lib/useNow.ts`:

```ts
import { useEffect, useState } from 'react';

/** The current time, refreshed every `intervalMs`, so time-aware screens move on without a reload. */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
```

Overwrite `src/lib/useToday.ts`:

```ts
import { useSettings } from '../api/settings';
import { toCalendarDate } from '../shared/exec/dates';
import { localClock } from '../shared/exec/time';
import type { Settings } from '../shared/exec/schemas';
import { useNow } from './useNow';

type TodayContext = { today: string; weekStartDay: number; ready: boolean; now: Date; settings: Settings | undefined };

/**
 * Today's calendar date in the settings time zone, ticking each minute so it rolls over at local midnight.
 * Until settings arrive `ready` is false and the date is the UTC one; callers wait for `ready` before reading data by date.
 */
export function useToday(): TodayContext {
  const settings = useSettings();
  const now = useNow();
  const zone = settings.data?.timezone;
  return {
    today: zone ? localClock(now, zone).date : toCalendarDate(now),
    weekStartDay: settings.data?.weekStartDay ?? 0,
    ready: settings.data !== undefined,
    now,
    settings: settings.data,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project jsdom`
Expected: PASS. That is 3 Must Ship hook tests, 3 day hook tests, 1 settings hook test, 1 `useToday` test, 1 errors test, and every existing client test. The Week, Plan and Today screen tests keep passing because their fetch stubs answer every URL.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/api/keys.ts src/api/mustShips.ts src/api/days.ts src/api/tasks.ts src/api/weeks.ts src/api/projects.ts src/api/settings.ts src/api/errors.ts src/lib/useNow.ts src/lib/useToday.ts src/api/mustShips.test.tsx src/api/days.test.tsx src/api/settings.test.tsx src/lib/useToday.test.tsx src/api/errors.test.tsx
git commit -m "feat: add the Must Ship, day and schedule hooks with shared keys and a ticking clock"
```

---

### Task 8: The Must Ship form and picker

**Files:**
- Create: `src/components/mustShip/MustShipForm.tsx`, `src/components/mustShip/MustShipPicker.tsx`
- Modify: `src/test/fixtures.ts` (add `makeMustShip`, `makeDayView`), `src/lib/labels.ts` (add `MUST_SHIP_STATUS_LABELS`)
- Test: `src/components/mustShip/MustShipForm.test.tsx`, `src/components/mustShip/MustShipPicker.test.tsx`

**Interfaces:**
- Consumes: `NudgeLine` (Phase 3); `isActivityTitle`, `needsNudge` (`nudge.ts`); `useMustShips`, `useCreateMustShip`, `useUpdateMustShip` and `useReportError` (Task 7); `type Outcome`, `Context` (`schemas.ts`); `type MustShip`, `MustShipStatus`, `DayView` (`todaySchemas.ts`).
- Produces:
  - `type MustShipFields = { title: string; definitionOfDone: string; outcomeId: string | null }`
  - `MustShipForm({ outcomes, submitLabel, initial?, pending?, onSubmit, onCancel? })`. It is a form named by `submitLabel`, with the labels "Must Ship", "Definition of done" and "Serves outcome" ("No outcome" option). It shows the nudge, moves focus to the definition when an activity title loses focus, and disables submit only while the title is empty.
  - `MustShipPicker({ date, context, outcomes, onDone? })`. It lists "Candidates" with a `Use "<title>"` button that moves the candidate to `date`, and "Write one" through `MustShipForm` with the submit button "Set Must Ship". Failures, `DAY_TAKEN` included, show as `Could not set the Must Ship: <reason>`.
  - Fixtures `makeMustShip(overrides?)` (work, planned, dated `2026-09-29`) and `makeDayView(overrides?)` (an empty `2026-09-29`).
  - `MUST_SHIP_STATUS_LABELS: Record<MustShipStatus, string>`.

- [ ] **Step 1: Add the fixtures and labels the tests need**

In `src/test/fixtures.ts`, add `import type { DayView, MustShip } from '../shared/exec/todaySchemas';` beside the existing type import, and append:

```ts
/** A work Must Ship for Tuesday 29 Sep 2026, planned, unless overridden. */
export function makeMustShip(overrides: Partial<MustShip> = {}): MustShip {
  counter += 1;
  return {
    id: `40000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    title: `Must Ship ${counter}`,
    definitionOfDone: '',
    context: 'work',
    date: '2026-09-29',
    outcomeId: null,
    projectId: null,
    status: 'planned',
    blockerWhat: null,
    blockerOwner: null,
    blockerNextAction: null,
    notes: '',
    rolledFromId: null,
    rollCount: 0,
    closedAt: null,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

/** An empty Tuesday 29 Sep 2026 as GET /days/:date returns it. */
export const makeDayView = (overrides: Partial<DayView> = {}): DayView => ({
  date: '2026-09-29',
  day: null,
  week: null,
  hasHistory: false,
  mustShip: null,
  buildMustShip: null,
  secondaries: [],
  waiting: [],
  blocks: [],
  inboxCount: 0,
  ...overrides,
});
```

In `src/lib/labels.ts`, add `import type { MustShipStatus } from '../shared/exec/todaySchemas';` and append:

```ts
export const MUST_SHIP_STATUS_LABELS: Record<MustShipStatus, string> = {
  planned: 'Planned',
  shipped: 'Shipped',
  partial: 'Partial',
  missed: 'Missed',
  blocked: 'Blocked',
  killed: 'Killed',
};
```

- [ ] **Step 2: Write the failing tests**

Create `src/components/mustShip/MustShipForm.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MustShipForm } from './MustShipForm';
import { renderWithProviders } from '../../test/render';
import { makeOutcome } from '../../test/fixtures';
import { NUDGE_MESSAGE } from '../../shared/exec/nudge';

const outcome = makeOutcome({ title: 'Supplier plan confirmed' });

function renderForm() {
  const onSubmit = vi.fn();
  renderWithProviders(<MustShipForm outcomes={[outcome]} submitLabel="Set Must Ship" onSubmit={onSubmit} />);
  return onSubmit;
}

describe('MustShipForm', () => {
  it('submits the trimmed title, definition and the outcome it serves', async () => {
    const onSubmit = renderForm();
    expect(screen.getByRole('button', { name: 'Set Must Ship' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Must Ship'), '  Delivery tracker sent ');
    await userEvent.type(screen.getByLabelText('Definition of done'), 'Sent to all 20 suppliers');
    await userEvent.selectOptions(screen.getByLabelText('Serves outcome'), 'Supplier plan confirmed');
    await userEvent.click(screen.getByRole('button', { name: 'Set Must Ship' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20 suppliers', outcomeId: outcome.id });
  });

  it('nudges an activity, moves to the definition, and still saves', async () => {
    const onSubmit = renderForm();
    await userEvent.type(screen.getByLabelText('Must Ship'), 'Follow up with suppliers');
    expect(screen.getByRole('note')).toHaveTextContent(NUDGE_MESSAGE);
    fireEvent.blur(screen.getByLabelText('Must Ship'));
    expect(screen.getByLabelText('Definition of done')).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Set Must Ship' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Follow up with suppliers', definitionOfDone: '', outcomeId: null });
  });
});
```

Create `src/components/mustShip/MustShipPicker.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MustShipPicker } from './MustShipPicker';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { makeMustShip } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const candidate = makeMustShip({ title: 'Price list approved', date: null });
const dayTaken = () =>
  new Response(JSON.stringify({ success: false, error: 'that day already has a must ship', code: 'DAY_TAKEN', details: { mustShip: makeMustShip() } }), {
    status: 409,
    headers: { 'content-type': 'application/json' },
  });

describe('MustShipPicker', () => {
  it('uses a candidate by giving it the date', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'PATCH' ? json(candidate) : json([candidate])));
    const onDone = vi.fn();
    renderWithProviders(<MustShipPicker date="2026-09-29" context="work" outcomes={[]} onDone={onDone} />);
    const list = await screen.findByRole('list', { name: 'Candidates' });
    await userEvent.click(within(list).getByRole('button', { name: 'Use "Price list approved"' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: `/api/exec/must-ships/${candidate.id}`, body: { date: '2026-09-29' } }));
    expect(calls[0].url).toBe('/api/exec/must-ships?date=none&status=planned&context=work');
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it('writes a new one for the date and context', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'POST' ? json(makeMustShip(), 201) : json([])));
    renderWithProviders(<MustShipPicker date="2026-09-29" context="work" outcomes={[]} />);
    await userEvent.type(await screen.findByLabelText('Must Ship'), 'Delivery tracker sent');
    await userEvent.click(screen.getByRole('button', { name: 'Set Must Ship' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Delivery tracker sent', definitionOfDone: '', outcomeId: null, context: 'work', date: '2026-09-29' })
    );
    expect(screen.queryByRole('list', { name: 'Candidates' })).toBeNull();
  });

  it('says so plainly when another tab already set the day', async () => {
    stubFetch((_url, init) => (init?.method === 'POST' ? dayTaken() : json([])));
    renderWithProviders(<MustShipPicker date="2026-09-29" context="work" outcomes={[]} />);
    await userEvent.type(await screen.findByLabelText('Must Ship'), 'Second one');
    await userEvent.click(screen.getByRole('button', { name: 'Set Must Ship' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Could not set the Must Ship: that day already has a Must Ship');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/components/mustShip`
Expected: FAIL, because `./MustShipForm` and `./MustShipPicker` cannot be resolved.

- [ ] **Step 4: Write the form**

Create `src/components/mustShip/MustShipForm.tsx`:

```tsx
import { useId, useRef, useState, type FormEvent } from 'react';
import type { Outcome } from '../../shared/exec/schemas';
import { isActivityTitle, needsNudge } from '../../shared/exec/nudge';
import { NudgeLine } from '../outcomes/NudgeLine';

export type MustShipFields = { title: string; definitionOfDone: string; outcomeId: string | null };

type Props = {
  outcomes: Outcome[];
  submitLabel: string;
  initial?: Partial<MustShipFields>;
  pending?: boolean;
  onSubmit: (fields: MustShipFields) => void;
  onCancel?: () => void;
};

const FIELD = 'w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink';

/** One output that must exist by the end of the day (§6). The nudge coaches an activity title (§9); it never blocks. */
export function MustShipForm({ outcomes, submitLabel, initial = {}, pending = false, onSubmit, onCancel }: Props) {
  const id = useId();
  const [title, setTitle] = useState(initial.title ?? '');
  const [definition, setDefinition] = useState(initial.definitionOfDone ?? '');
  const [outcomeId, setOutcomeId] = useState(initial.outcomeId ?? '');
  const definitionRef = useRef<HTMLTextAreaElement>(null);
  const trimmed = title.trim();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed && !pending) onSubmit({ title: trimmed, definitionOfDone: definition.trim(), outcomeId: outcomeId || null });
  };
  return (
    <form aria-label={submitLabel} onSubmit={submit} className="space-y-2">
      <label htmlFor={`${id}-title`} className="block text-sm">Must Ship</label>
      <input id={`${id}-title`} value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => isActivityTitle(title) && definitionRef.current?.focus()} placeholder="What will exist by the end of today?" className={FIELD} />
      <NudgeLine show={needsNudge(title, definition)} />
      <label htmlFor={`${id}-definition`} className="block text-sm">Definition of done</label>
      <textarea id={`${id}-definition`} ref={definitionRef} rows={2} value={definition} onChange={(e) => setDefinition(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-outcome`} className="block text-sm">Serves outcome</label>
      <select id={`${id}-outcome`} value={outcomeId} onChange={(e) => setOutcomeId(e.target.value)} className={FIELD}>
        <option value="">No outcome</option>
        {outcomes.map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.title}</option>)}
      </select>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!trimmed || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">{submitLabel}</button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>}
      </div>
    </form>
  );
}
```

- [ ] **Step 5: Write the picker**

Create `src/components/mustShip/MustShipPicker.tsx`:

```tsx
import { useCreateMustShip, useMustShips, useUpdateMustShip } from '../../api/mustShips';
import { useReportError } from '../../api/errors';
import type { Context, Outcome } from '../../shared/exec/schemas';
import { MustShipForm } from './MustShipForm';

type Props = { date: string; context: Context; outcomes: Outcome[]; onDone?: () => void };

/** Pick a candidate (§17) or write one; either way it becomes the Must Ship for `date`. */
export function MustShipPicker({ date, context, outcomes, onDone }: Props) {
  const candidates = useMustShips({ date: 'none', context, status: ['planned'] });
  const create = useCreateMustShip();
  const update = useUpdateMustShip();
  const report = useReportError();
  const settle = { onSuccess: () => onDone?.(), onError: report('set the Must Ship') };
  const list = candidates.data ?? [];
  return (
    <div className="space-y-4">
      {list.length > 0 && (
        <ul aria-label="Candidates" className="space-y-1">
          {list.map((candidate) => (
            <li key={candidate.id} className="flex items-center justify-between gap-3 border-t border-line py-2 dark:border-ink-muted">
              <span>{candidate.title}</span>
              <button
                type="button"
                aria-label={`Use "${candidate.title}"`}
                disabled={update.isPending}
                onClick={() => update.mutate({ id: candidate.id, patch: { date } }, settle)}
                className="rounded border border-line px-2 py-1 text-sm dark:border-ink-muted"
              >
                Use this
              </button>
            </li>
          ))}
        </ul>
      )}
      <MustShipForm outcomes={outcomes} submitLabel="Set Must Ship" pending={create.isPending} onSubmit={(fields) => create.mutate({ ...fields, context, date }, settle)} />
    </div>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/components/mustShip`
Expected: PASS, 2 form tests and 3 picker tests.

Run: `npx vitest run && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/mustShip src/test/fixtures.ts src/lib/labels.ts
git commit -m "feat: add the Must Ship form with the nudge and the picker for candidates"
```

---

### Task 9: The Today cards

**Files:**
- Create: `src/components/LoadError.tsx`, `src/components/today/TodayHeader.tsx`, `src/components/today/Banners.tsx`, `src/components/today/MustShipCard.tsx`, `src/components/today/BuildCard.tsx`, `src/components/today/TomorrowCard.tsx`
- Test: `src/components/today/TodayCards.test.tsx`, `src/components/LoadError.test.tsx`

**Interfaces:**
- Consumes: `dayLabel`, `type Banner` (Task 2); `weekNumber` (`week.ts`); `weekStartOf`, `hhmmToMinutes` (`time.ts`); `useUpdateMustShip`, `useReportError`, `errorMessage` (Task 7); `MustShipForm` (Task 8); `MUST_SHIP_STATUS_LABELS` (Task 8); `type ApiError` (`client.ts`); `type Outcome`, `Settings`, `WeekView` (`schemas.ts`); `type MustShip` (`todaySchemas.ts`).
- Produces:
  - `LoadError({ what, error, onRetry })`: an alert reading `Could not load <what>: <errorMessage>` with a "Try again" button.
  - `TodayHeader({ date, weekStartDay, week })`: `<dayLabel> · Week N`, plus a link to `/week` reading `x of N outcomes done`, or "No outcomes yet".
  - `Banners({ banners, firstWeek })`: the links "Plan your first week" / "Plan this week" (to `/plan`) and "Close the day" (to `/shutdown`).
  - `MustShipCard({ mustShip, outcome, outcomes, settings, mode })`: a region "Must Ship" with the title, the definition, `For: <outcome>` and `Deep work 08:35–10:05`.
    - A status label appears when the Must Ship is not planned.
    - `mode: 'start' | 'grade'` gives the link "Start deep work" or "Record the result", both to `/focus`.
    - While planned it also offers "Edit" (form "Save Must Ship") and "Put back" (date → `null`).
  - `BuildCard({ mustShip, outcome, block, tomorrow })`: a region "Build".
    - It shows the build Must Ship or outcome, `Build block HH:MM · N min` or "No build block today", and "Start" to `/focus`.
    - With nothing planned it shows "Nothing planned for Build" and "Open the week".
    - With a `tomorrow` title it adds `Tomorrow: <title>`.
  - `TomorrowCard({ date, mustShip })`: a region "Tomorrow" with "Tomorrow is ready" and `<dayLabel>: <title>`, or `No Must Ship for <dayLabel> yet`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/LoadError.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoadError } from './LoadError';
import { ApiError } from '../api/client';

describe('LoadError', () => {
  it('says what failed in plain words and offers to try again', async () => {
    const onRetry = vi.fn();
    render(<LoadError what="today" error={new ApiError(0, 'NETWORK', 'x')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load today: the local API is not reachable');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
```

Create `src/components/today/TodayCards.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import type { ReactElement } from 'react';
import { TodayHeader } from './TodayHeader';
import { Banners } from './Banners';
import { MustShipCard } from './MustShipCard';
import { BuildCard } from './BuildCard';
import { TomorrowCard } from './TomorrowCard';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { SETTINGS, makeMustShip, makeOutcome, makeWeekView } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

/** The cards hold links, so they render inside a router. */
const show = (ui: ReactElement) => renderWithProviders(<RouterProvider router={createMemoryRouter([{ path: '/', element: ui }])} />);

describe('TodayHeader', () => {
  it('names the day and the week and links the outcomes done', () => {
    const week = makeWeekView([makeOutcome({ status: 'done', slot: 1 }), makeOutcome({ slot: 2 }), makeOutcome({ slot: null, status: 'killed' })]);
    show(<TodayHeader date="2026-09-22" weekStartDay={0} week={week} />);
    expect(screen.getByText('Tuesday 22 September · Week 39')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '1 of 2 outcomes done' })).toHaveAttribute('href', '/week');
  });

  it('says there are no outcomes yet without a week', () => {
    show(<TodayHeader date="2026-09-29" weekStartDay={0} week={null} />);
    expect(screen.getByRole('link', { name: 'No outcomes yet' })).toHaveAttribute('href', '/week');
  });
});

describe('Banners', () => {
  it('links the first plan, or this week\'s, and closing the day', () => {
    show(<Banners banners={['plan', 'close']} firstWeek />);
    expect(screen.getByRole('link', { name: 'Plan your first week' })).toHaveAttribute('href', '/plan');
    expect(screen.getByRole('link', { name: 'Close the day' })).toHaveAttribute('href', '/shutdown');
  });

  it('asks for this week once there is history, and shows nothing without banners', () => {
    const { unmount } = show(<Banners banners={['plan']} firstWeek={false} />);
    expect(screen.getByRole('link', { name: 'Plan this week' })).toBeInTheDocument();
    unmount();
    show(<Banners banners={[]} firstWeek={false} />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('MustShipCard', () => {
  const outcome = makeOutcome({ title: 'Supplier plan confirmed' });

  it('shows the Must Ship, what it serves, the window and Start deep work', () => {
    const mustShip = makeMustShip({ title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20', outcomeId: outcome.id });
    show(<MustShipCard mustShip={mustShip} outcome={outcome} outcomes={[outcome]} settings={SETTINGS} mode="start" />);
    const card = screen.getByRole('region', { name: 'Must Ship' });
    expect(within(card).getByRole('heading', { level: 2, name: 'Delivery tracker sent' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Sent to all 20');
    expect(card).toHaveTextContent('For: Supplier plan confirmed');
    expect(card).toHaveTextContent('Deep work 08:35–10:05');
    expect(within(card).getByRole('link', { name: 'Start deep work' })).toHaveAttribute('href', '/focus');
  });

  it('asks for the result once its block has ended, and shows a closed status without edits', () => {
    const { unmount } = show(<MustShipCard mustShip={makeMustShip()} outcome={null} outcomes={[]} settings={SETTINGS} mode="grade" />);
    expect(screen.getByRole('link', { name: 'Record the result' })).toHaveAttribute('href', '/focus');
    unmount();
    show(<MustShipCard mustShip={makeMustShip({ status: 'shipped' })} outcome={null} outcomes={[]} settings={SETTINGS} mode="start" />);
    expect(screen.getByText('Shipped')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Put back' })).toBeNull();
  });

  it('puts a planned Must Ship back among the candidates, and edits it in place', async () => {
    const mustShip = makeMustShip({ title: 'Delivery tracker sent' });
    const calls = stubFetch(() => json(mustShip));
    show(<MustShipCard mustShip={mustShip} outcome={null} outcomes={[]} settings={SETTINGS} mode="start" />);
    await userEvent.click(screen.getByRole('button', { name: 'Put back' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: `/api/exec/must-ships/${mustShip.id}`, body: { date: null } }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const title = screen.getByLabelText('Must Ship');
    await userEvent.clear(title);
    await userEvent.type(title, 'Delivery tracker sent to all');
    await userEvent.click(screen.getByRole('button', { name: 'Save Must Ship' }));
    await waitFor(() => expect(calls.filter((c) => c.method === 'PATCH').at(-1)?.body).toEqual({ title: 'Delivery tracker sent to all', definitionOfDone: '', outcomeId: null }));
  });
});

describe('BuildCard and TomorrowCard', () => {
  it('shows the build Must Ship with its block and Start', () => {
    show(<BuildCard mustShip={makeMustShip({ title: 'Landing page live', context: 'build' })} outcome={null} block={{ weekday: 2, start: '06:30', minutes: 50 }} tomorrow={null} />);
    const card = screen.getByRole('region', { name: 'Build' });
    expect(card).toHaveTextContent('Landing page live');
    expect(card).toHaveTextContent('Build block 06:30 · 50 min');
    expect(within(card).getByRole('link', { name: 'Start' })).toHaveAttribute('href', '/focus');
  });

  it('falls back to a build outcome, then to nothing planned with a way to the week', () => {
    const { unmount } = show(<BuildCard mustShip={null} outcome={makeOutcome({ title: 'Healify beta', category: 'business' })} block={null} tomorrow="Price list approved" />);
    expect(screen.getByRole('region', { name: 'Build' })).toHaveTextContent('Healify beta');
    expect(screen.getByText('No build block today')).toBeInTheDocument();
    expect(screen.getByText('Tomorrow: Price list approved')).toBeInTheDocument();
    unmount();
    show(<BuildCard mustShip={null} outcome={null} block={null} tomorrow={null} />);
    expect(screen.getByText('Nothing planned for Build')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the week' })).toHaveAttribute('href', '/week');
    expect(screen.queryByRole('link', { name: 'Start' })).toBeNull();
  });

  it('says tomorrow is ready, with its Must Ship or without', () => {
    const { unmount } = show(<TomorrowCard date="2026-09-30" mustShip={makeMustShip({ title: 'Price list approved' })} />);
    const card = screen.getByRole('region', { name: 'Tomorrow' });
    expect(within(card).getByRole('heading', { level: 2, name: 'Tomorrow is ready' })).toBeInTheDocument();
    expect(card).toHaveTextContent('Wednesday 30 September: Price list approved');
    unmount();
    show(<TomorrowCard date="2026-09-30" mustShip={null} />);
    expect(screen.getByText('No Must Ship for Wednesday 30 September yet')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/today src/components/LoadError.test.tsx`
Expected: FAIL, because the components do not exist.

- [ ] **Step 3: Write `LoadError`, the header and the banners**

Create `src/components/LoadError.tsx`:

```tsx
import type { ApiError } from '../api/client';
import { errorMessage } from '../api/errors';

type Props = { what: string; error: ApiError; onRetry: () => void };

/** A read failed: say what, in plain words, and offer to try again instead of showing an empty screen. */
export function LoadError({ what, error, onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-4 dark:border-ink-muted">
      <p className="flex-1">Could not load {what}: {errorMessage(error)}</p>
      <button type="button" onClick={onRetry} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">Try again</button>
    </div>
  );
}
```

Create `src/components/today/TodayHeader.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { dayLabel } from '../../shared/exec/today';
import { weekNumber } from '../../shared/exec/week';
import { weekStartOf } from '../../shared/exec/time';
import type { WeekView } from '../../shared/exec/schemas';

type Props = { date: string; weekStartDay: number; week: WeekView | null };

/** Spec C "Today" item 1: the date, the week number and one line for the week, linking to it. */
export function TodayHeader({ date, weekStartDay, week }: Props) {
  const slotted = (week?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  const done = slotted.filter((outcome) => outcome.status === 'done').length;
  const startDate = week?.week.startDate ?? weekStartOf(date, weekStartDay);
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 text-ink-muted">
      <p>{dayLabel(date)} · Week {weekNumber(startDate)}</p>
      <Link to="/week" className="text-sm underline">
        {slotted.length > 0 ? `${done} of ${slotted.length} outcomes done` : 'No outcomes yet'}
      </Link>
    </div>
  );
}
```

Create `src/components/today/Banners.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { Banner } from '../../shared/exec/today';

type Props = { banners: Banner[]; firstWeek: boolean };

const BANNER = 'block rounded-lg border border-line bg-paper-raised px-4 py-3 text-lg font-medium hover:border-ink dark:border-ink-muted dark:bg-ink';

/** Spec C "Today is time-aware": banners sit above the primary card whenever their condition holds. */
export function Banners({ banners, firstWeek }: Props) {
  return (
    <>
      {banners.includes('plan') && (
        <Link to="/plan" className={BANNER}>
          {firstWeek ? 'Plan your first week' : 'Plan this week'}
        </Link>
      )}
      {banners.includes('close') && (
        <Link to="/shutdown" className={BANNER}>
          Close the day
        </Link>
      )}
    </>
  );
}
```

- [ ] **Step 4: Write the three cards**

Create `src/components/today/MustShipCard.tsx`:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUpdateMustShip } from '../../api/mustShips';
import { useReportError } from '../../api/errors';
import { MUST_SHIP_STATUS_LABELS } from '../../lib/labels';
import { hhmmToMinutes } from '../../shared/exec/time';
import type { Outcome, Settings } from '../../shared/exec/schemas';
import type { MustShip, MustShipPatch } from '../../shared/exec/todaySchemas';
import { MustShipForm } from '../mustShip/MustShipForm';

type Props = { mustShip: MustShip; outcome: Outcome | null; outcomes: Outcome[]; settings: Settings; mode: 'start' | 'grade' };

const BUTTON = 'rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink dark:border-ink-muted dark:hover:text-paper';

/** "08:35–10:05" from the settings' start and length. */
function windowLabel(start: string, minutes: number): string {
  const end = hhmmToMinutes(start) + minutes;
  return `${start}–${String(Math.floor(end / 60) % 24).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`;
}

/** Spec C "Today" item 2: title large, definition in one line, the outcome it serves, the window, the primary action. */
export function MustShipCard({ mustShip, outcome, outcomes, settings, mode }: Props) {
  const update = useUpdateMustShip();
  const report = useReportError();
  const [editing, setEditing] = useState(false);
  const planned = mustShip.status === 'planned';
  const save = (patch: MustShipPatch, onSuccess?: () => void) => update.mutate({ id: mustShip.id, patch }, { onSuccess, onError: report('update the Must Ship') });

  if (editing) {
    return (
      <section aria-label="Must Ship" className="rounded-lg border border-line p-4 dark:border-ink-muted">
        <MustShipForm outcomes={outcomes} initial={mustShip} submitLabel="Save Must Ship" pending={update.isPending} onCancel={() => setEditing(false)} onSubmit={(fields) => save(fields, () => setEditing(false))} />
      </section>
    );
  }
  return (
    <section aria-label="Must Ship" className="space-y-2 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <p className="text-xs uppercase tracking-wide text-ink-muted">
        Must Ship{!planned && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-paper dark:bg-paper dark:text-ink">{MUST_SHIP_STATUS_LABELS[mustShip.status]}</span>}
      </p>
      <h2 className="text-2xl font-semibold">{mustShip.title}</h2>
      {mustShip.definitionOfDone && <p className="truncate text-ink-muted">{mustShip.definitionOfDone}</p>}
      {outcome && <p className="text-sm">For: {outcome.title}</p>}
      <p className="text-sm text-ink-muted">Deep work {windowLabel(settings.deepWorkStart, settings.deepWorkMinutes)}</p>
      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Link to="/focus" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">
          {mode === 'grade' ? 'Record the result' : 'Start deep work'}
        </Link>
        {planned && <button type="button" className={BUTTON} onClick={() => setEditing(true)}>Edit</button>}
        {planned && <button type="button" className={BUTTON} onClick={() => save({ date: null })}>Put back</button>}
      </div>
    </section>
  );
}
```

`initial={mustShip}` works because `MustShip` has `title`, `definitionOfDone` and `outcomeId`, which is everything `Partial<MustShipFields>` reads. The edit PATCH sends exactly the three fields the form returns.

Create `src/components/today/BuildCard.tsx`:

```tsx
import { Link } from 'react-router-dom';
import type { Outcome, Settings } from '../../shared/exec/schemas';
import type { MustShip } from '../../shared/exec/todaySchemas';

type Block = Settings['buildBlocks'][number];
type Props = { mustShip: MustShip | null; outcome: Outcome | null; block: Block | null; tomorrow: string | null };

/** Outside office hours and on non-work days: the build Must Ship or outcome and its block (§16). Never beside the office Must Ship. */
export function BuildCard({ mustShip, outcome, block, tomorrow }: Props) {
  const title = mustShip?.title ?? outcome?.title ?? null;
  return (
    <section aria-label="Build" className="space-y-2 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <p className="text-xs uppercase tracking-wide text-ink-muted">Build{mustShip ? ' · Must Ship' : outcome ? ' · Outcome' : ''}</p>
      {title ? <h2 className="text-2xl font-semibold">{title}</h2> : <h2 className="text-xl">Nothing planned for Build</h2>}
      <p className="text-sm text-ink-muted">{block ? `Build block ${block.start} · ${block.minutes} min` : 'No build block today'}</p>
      <div className="pt-1">
        {title ? (
          <Link to="/focus" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Start</Link>
        ) : (
          <Link to="/week" className="underline">Open the week</Link>
        )}
      </div>
      {tomorrow && <p className="text-sm text-ink-muted">Tomorrow: {tomorrow}</p>}
    </section>
  );
}
```

Create `src/components/today/TomorrowCard.tsx`:

```tsx
import { dayLabel } from '../../shared/exec/today';
import type { MustShip } from '../../shared/exec/todaySchemas';

type Props = { date: string; mustShip: MustShip | null };

/** After the shutdown: tomorrow's Must Ship and "Tomorrow is ready" (spec C, §12). */
export function TomorrowCard({ date, mustShip }: Props) {
  return (
    <section aria-label="Tomorrow" className="space-y-2 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <h2 className="text-2xl font-semibold">Tomorrow is ready</h2>
      <p>{mustShip ? `${dayLabel(date)}: ${mustShip.title}` : `No Must Ship for ${dayLabel(date)} yet`}</p>
    </section>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/today src/components/LoadError.test.tsx`
Expected: PASS, 10 card tests and 1 LoadError test.

Run: `npx vitest run && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/LoadError.tsx src/components/LoadError.test.tsx src/components/today
git commit -m "feat: add the Today header, banners and the Must Ship, Build and Tomorrow cards"
```

---

### Task 10: Today, time-aware

**Files:**
- Create: `src/components/today/PrimaryCard.tsx`, `src/components/today/ChooseMustShip.tsx`
- Modify: `src/screens/Today.tsx` (overwrite), `src/app/App.test.tsx` (fetch stub only), `e2e/week.spec.ts` (Today assertion only)
- Test: `src/screens/Today.test.tsx` (overwrite)

**Interfaces:**
- Consumes: `todayMode`, `nextWorkDay`, `type TodayMode` (Task 2); `useDay`, `useSettings`, `useToday` (Task 7); `MustShipPicker` (Task 8); `LoadError`, `TodayHeader`, `Banners`, `MustShipCard`, `BuildCard`, `TomorrowCard` (Task 9); `contextOf` (`week.ts`); `CaptureBar`, `ScreenShell`; fixtures `SETTINGS`, `makeDayView`, `makeMustShip`, `makeOutcome`, `makeWeekView`.
- Produces:
  - `/` renders the header, the banners and the one primary card chosen by `todayMode`, with capture pinned below.
  - `ChooseMustShip({ date, outcomes })` is a region named "Choose today's Must Ship".
  - `PrimaryCard({ mode, view, settings, tomorrow })`, where `tomorrow` is `{ date, mustShip } | null`.
  - The day is not read until settings have loaded.
  - A failed read of the schedule or the day shows `LoadError`.

- [ ] **Step 1: Write the failing tests**

Overwrite `src/screens/Today.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeDayView, makeMustShip, makeOutcome, makeWeekView } from '../test/fixtures';
import type { DayView } from '../shared/exec/todaySchemas';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Karachi is UTC+5: 2026-09-29T04:00:00Z is Tuesday 09:00 there. */
const at = (iso: string) => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date(iso) });

function api(days: Record<string, DayView | (() => Response)>) {
  return stubFetch((url) => {
    if (url.endsWith('/settings')) return json(SETTINGS);
    const date = url.match(/\/days\/(\d{4}-\d{2}-\d{2})$/)?.[1];
    if (date) {
      const answer = days[date] ?? makeDayView({ date });
      return typeof answer === 'function' ? answer() : json(answer);
    }
    return json([]);
  });
}

const outcome = makeOutcome({ title: 'Supplier plan confirmed' });
const planned = makeWeekView([outcome], { startDate: '2026-09-27' });

describe('Today, by the moment', () => {
  it('asks for today\'s Must Ship at 09:00 on a Tuesday, under the first-plan banner', async () => {
    at('2026-09-29T04:00:00Z');
    api({});
    renderRoute('/');
    expect(await screen.findByRole('region', { name: "Choose today's Must Ship" })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plan your first week' })).toHaveAttribute('href', '/plan');
    expect(screen.getByText('Tuesday 29 September · Week 40')).toBeInTheDocument();
  });

  it('shows the Must Ship with Start deep work once it is set', async () => {
    at('2026-09-29T04:00:00Z');
    api({ '2026-09-29': makeDayView({ week: planned, hasHistory: true, mustShip: makeMustShip({ title: 'Delivery tracker sent', outcomeId: outcome.id }) }) });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Must Ship' });
    expect(card).toHaveTextContent('For: Supplier plan confirmed');
    expect(within(card).getByRole('link', { name: 'Start deep work' })).toHaveAttribute('href', '/focus');
    expect(screen.getByRole('link', { name: '0 of 1 outcomes done' })).toHaveAttribute('href', '/week');
    expect(screen.queryByRole('link', { name: /^Plan/ })).toBeNull();
  });

  it('is the Build card at 20:00, with Close the day', async () => {
    at('2026-09-29T15:00:00Z');
    api({ '2026-09-29': makeDayView({ week: planned, mustShip: makeMustShip() }) });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Build' });
    expect(card).toHaveTextContent('Nothing planned for Build');
    expect(card).toHaveTextContent('Build block 06:30 · 50 min');
    expect(screen.getByRole('link', { name: 'Close the day' })).toHaveAttribute('href', '/shutdown');
    expect(screen.queryByRole('region', { name: 'Must Ship' })).toBeNull();
  });

  it('shows tomorrow once the day is shut down', async () => {
    at('2026-09-29T12:30:00Z');
    const shutDown = { date: '2026-09-29', shutdownAt: '2026-09-29T12:10:00.000Z', notes: '', createdAt: '2026-09-29T12:10:00.000Z', updatedAt: '2026-09-29T12:10:00.000Z' };
    api({
      '2026-09-29': makeDayView({ week: planned, day: shutDown, mustShip: makeMustShip() }),
      '2026-09-30': makeDayView({ date: '2026-09-30', mustShip: makeMustShip({ title: 'Price list approved', date: '2026-09-30' }) }),
    });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Tomorrow' });
    expect(await within(card).findByText('Wednesday 30 September: Price list approved')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Close the day' })).toBeNull();
  });

  it('never reads the day before the schedule, and says so when the day fails, then retries', async () => {
    at('2026-09-29T04:00:00Z');
    let fail = true;
    const calls = api({ '2026-09-29': () => (fail ? failure(500, 'INTERNAL', 'internal server error') : json(makeDayView())) });
    renderRoute('/');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load today: internal server error');
    const settingsAt = calls.findIndex((c) => c.url.endsWith('/settings'));
    const dayAt = calls.findIndex((c) => c.url.includes('/days/'));
    expect(settingsAt).toBeLessThan(dayAt);
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: "Choose today's Must Ship" })).toBeInTheDocument();
  });
});
```

In `src/app/App.test.tsx`, replace the `beforeEach(...)` line with the lines below, and add `makeDayView` to its import from `'../test/fixtures'`. Today now reads the day, and a list endpoint answering the health payload would crash a list.

```ts
const answer = (url: string) =>
  url.endsWith('/settings')
    ? json(SETTINGS)
    : url.includes('/days/')
      ? json(makeDayView())
      : /\/(must-ships|tasks|projects)/.test(url)
        ? json([])
        : healthOk();

beforeEach(() => vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => answer(String(input)))));
```

In `e2e/week.spec.ts`, replace the line

```ts
  await expect(page.getByRole('list', { name: 'This week' })).toContainText('Supplier risks identified');
```

with

```ts
  await expect(page.getByRole('link', { name: '0 of 3 outcomes done' })).toBeVisible();
```

Today's header now carries the week as one line (spec C "Today" item 1), and the replace leaves three active outcomes, none done.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/screens/Today.test.tsx`
Expected: FAIL. Today still renders the Phase 3 plan banner and week list, with no Must Ship regions.

- [ ] **Step 3: Write the choose card and the primary card**

Create `src/components/today/ChooseMustShip.tsx`:

```tsx
import type { Outcome } from '../../shared/exec/schemas';
import { MustShipPicker } from '../mustShip/MustShipPicker';

type Props = { date: string; outcomes: Outcome[] };

/** No work Must Ship yet: pick a candidate or write one (spec C "Today is time-aware"). */
export function ChooseMustShip({ date, outcomes }: Props) {
  return (
    <section aria-label="Choose today's Must Ship" className="space-y-3 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <h2 className="text-2xl font-semibold">Choose today's Must Ship</h2>
      <p className="text-ink-muted">One output that must exist by the end of today.</p>
      <MustShipPicker date={date} context="work" outcomes={outcomes} />
    </section>
  );
}
```

Create `src/components/today/PrimaryCard.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { contextOf } from '../../shared/exec/week';
import type { TodayMode } from '../../shared/exec/today';
import type { Settings } from '../../shared/exec/schemas';
import type { DayView, MustShip } from '../../shared/exec/todaySchemas';
import { BuildCard } from './BuildCard';
import { ChooseMustShip } from './ChooseMustShip';
import { MustShipCard } from './MustShipCard';
import { TomorrowCard } from './TomorrowCard';

type Props = { mode: TodayMode; view: DayView; settings: Settings; tomorrow: { date: string; mustShip: MustShip | null } | null };

/** The one card this moment needs (spec C "Today is time-aware", first matching row). */
export function PrimaryCard({ mode, view, settings, tomorrow }: Props) {
  const active = (view.week?.outcomes ?? []).filter((outcome) => outcome.slot !== null && outcome.status === 'active');
  const work = active.filter((outcome) => contextOf(outcome.category) === 'work');
  const primary = mode.primary;
  if (primary.kind === 'build') {
    return (
      <BuildCard
        mustShip={view.buildMustShip}
        outcome={active.find((outcome) => contextOf(outcome.category) === 'build') ?? null}
        block={settings.buildBlocks.find((block) => block.weekday === mode.clock.weekday) ?? null}
        tomorrow={view.day?.shutdownAt ? tomorrow?.mustShip?.title ?? null : null}
      />
    );
  }
  if (primary.kind === 'tomorrow') return tomorrow ? <TomorrowCard date={tomorrow.date} mustShip={tomorrow.mustShip} /> : null;
  if (primary.kind === 'choose') return <ChooseMustShip date={view.date} outcomes={work} />;
  if (primary.kind === 'resume') {
    return (
      <section aria-label="Focus" className="rounded-lg border border-line p-5 dark:border-ink-muted">
        <Link to="/focus" className="text-lg underline">Resume focus</Link>
      </section>
    );
  }
  if (!view.mustShip) return null;
  const outcome = (view.week?.outcomes ?? []).find((candidate) => candidate.id === view.mustShip?.outcomeId) ?? null;
  return <MustShipCard mustShip={view.mustShip} outcome={outcome} outcomes={work} settings={settings} mode={primary.kind} />;
}
```

After the four earlier checks, `primary.kind` can only be `'start'` or `'grade'`, which is exactly `MustShipCard`'s `mode`. TypeScript narrows it.

- [ ] **Step 4: Write the screen**

Overwrite `src/screens/Today.tsx`:

```tsx
import { ScreenShell } from '../components/ScreenShell';
import { CaptureBar } from '../components/CaptureBar';
import { LoadError } from '../components/LoadError';
import { TodayHeader } from '../components/today/TodayHeader';
import { Banners } from '../components/today/Banners';
import { PrimaryCard } from '../components/today/PrimaryCard';
import { useDay } from '../api/days';
import { useSettings } from '../api/settings';
import { useToday } from '../lib/useToday';
import { nextWorkDay, todayMode } from '../shared/exec/today';

/** What must I ship today, and what am I working on right now? (spec C "Today") */
export default function Today() {
  const { today, now, ready } = useToday();
  const settings = useSettings();
  const day = useDay(today, { enabled: ready });
  const next = settings.data ? nextWorkDay(today, settings.data.workDays) : today;
  const tomorrow = useDay(next, { enabled: ready && Boolean(day.data?.day?.shutdownAt) });
  const loaded = settings.data && day.data ? { settings: settings.data, view: day.data } : null;
  const mode = loaded ? todayMode(now, loaded.settings, loaded.view) : null;
  return (
    <ScreenShell title="Today">
      {settings.isError && <LoadError what="the schedule" error={settings.error} onRetry={() => void settings.refetch()} />}
      {day.isError && <LoadError what="today" error={day.error} onRetry={() => void day.refetch()} />}
      {!loaded && !settings.isError && !day.isError && <p className="text-ink-muted">Loading today…</p>}
      {loaded && mode && (
        <>
          <TodayHeader date={today} weekStartDay={loaded.settings.weekStartDay} week={loaded.view.week} />
          <Banners banners={mode.banners} firstWeek={!loaded.view.hasHistory} />
          <PrimaryCard mode={mode} view={loaded.view} settings={loaded.settings} tomorrow={{ date: next, mustShip: tomorrow.data?.mustShip ?? null }} />
        </>
      )}
      <div className="sticky bottom-20 pt-6 md:bottom-6">
        <CaptureBar />
      </div>
    </ScreenShell>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/screens/Today.test.tsx src/app/App.test.tsx`
Expected: PASS: 5 Today tests, and every App test, including "opens on Today with the first-week banner" (the empty day has no outcomes and no history).

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/today/PrimaryCard.tsx src/components/today/ChooseMustShip.tsx src/screens/Today.tsx src/screens/Today.test.tsx src/app/App.test.tsx e2e/week.spec.ts
git commit -m "feat: make Today time-aware with one primary card per moment"
```

---

### Task 11: Secondaries and Waiting on Today

**Files:**
- Create: `src/components/today/Secondaries.tsx`, `src/components/today/Waiting.tsx`
- Modify: `src/screens/Today.tsx`
- Test: `src/components/today/Secondaries.test.tsx`, `src/components/today/Waiting.test.tsx`

**Interfaces:**
- Consumes: `useSetSecondaries` (Task 7); `useTasks`, `useUpdateTask` (Phase 2, now also refreshing days); `useReportError`; `nextWorkDay` (Task 2); `type Task`, `TaskPatch` (`schemas.ts`); `type Secondary` (`todaySchemas.ts`); fixtures `makeTask`.
- Produces:
  - `Secondaries({ date, secondaries })`: a region "Secondary".
    - Each row has a checkbox named by the task title that toggles `done` and `this_week`, plus `Remove "<title>"`.
    - Below two rows it offers "Add a secondary", which opens a list "Choose a secondary" of this week's and the Inbox's open tasks. Picking one PUTs the new id list.
    - There is never a third row.
  - `Waiting({ today, workDays, waiting })`: a region "Waiting".
    - A toggle reads `N delegated items need follow-up` (`1 delegated item needs follow-up`).
    - Expanded, each row reads `<title> — <owner>` with `Followed up on "<title>"`, which sets `followUpDate` to the next work day, and `Received "<title>"`, which marks it `done`.
    - With nothing due it reads "Nothing to follow up today."
  - Today renders both below the primary card, in every moment.

- [ ] **Step 1: Write the failing tests**

Create `src/components/today/Secondaries.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Secondaries } from './Secondaries';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { makeTask } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('Secondaries', () => {
  it('adds an inbox task as a secondary by putting the new list', async () => {
    const kept = makeTask({ title: 'Review the dashboard', status: 'this_week' });
    const inbox = makeTask({ title: 'Send the price list' });
    const calls = stubFetch((url, init) => (init?.method === 'PUT' ? json({}) : url.includes('status=inbox') ? json([inbox]) : json([kept])));
    renderWithProviders(<Secondaries date="2026-09-29" secondaries={[{ slot: 1, task: kept }]} />);
    await userEvent.click(screen.getByRole('button', { name: 'Add a secondary' }));
    const choices = await screen.findByRole('list', { name: 'Choose a secondary' });
    expect(within(choices).queryByRole('button', { name: 'Review the dashboard' })).toBeNull();
    await userEvent.click(within(choices).getByRole('button', { name: 'Send the price list' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ url: '/api/exec/days/2026-09-29/slots', body: { taskIds: [kept.id, inbox.id] } }));
  });

  it('checks a secondary off and removes one; two rows leave no way to add a third', async () => {
    const a = makeTask({ title: 'A', status: 'this_week' });
    const b = makeTask({ title: 'B', status: 'done' });
    const calls = stubFetch(() => json({}));
    renderWithProviders(<Secondaries date="2026-09-29" secondaries={[{ slot: 1, task: a }, { slot: 2, task: b }]} />);
    expect(screen.queryByRole('button', { name: 'Add a secondary' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'B' })).toBeChecked();
    await userEvent.click(screen.getByRole('checkbox', { name: 'A' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PATCH')).toMatchObject({ url: `/api/exec/tasks/${a.id}`, body: { status: 'done' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove "A"' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ taskIds: [b.id] }));
  });
});
```

Create `src/components/today/Waiting.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Waiting } from './Waiting';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { makeTask } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

describe('Waiting', () => {
  it('counts what needs follow-up and expands to act on it', async () => {
    const task = makeTask({ title: 'Delivery tracker', status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-10-02' });
    const calls = stubFetch(() => json({}));
    renderWithProviders(<Waiting today="2026-10-02" workDays={[1, 2, 3, 4, 5]} waiting={[task]} />);
    await userEvent.click(screen.getByRole('button', { name: '1 delegated item needs follow-up' }));
    expect(screen.getByText('Delivery tracker — Bilal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Followed up on "Delivery tracker"' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ method: 'PATCH', url: `/api/exec/tasks/${task.id}`, body: { followUpDate: '2026-10-05' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Received "Delivery tracker"' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ method: 'PATCH', body: { status: 'done' } }));
  });

  it('says when nothing is due and pluralises the count', () => {
    const { unmount } = renderWithProviders(<Waiting today="2026-10-02" workDays={[1, 2, 3, 4, 5]} waiting={[]} />);
    expect(screen.getByText('Nothing to follow up today.')).toBeInTheDocument();
    unmount();
    renderWithProviders(<Waiting today="2026-10-02" workDays={[1, 2, 3, 4, 5]} waiting={[makeTask({ ownerName: 'A' }), makeTask({ ownerName: 'B' })]} />);
    expect(screen.getByRole('button', { name: '2 delegated items need follow-up' })).toHaveAttribute('aria-expanded', 'false');
  });
});
```

`2026-10-02` is a Friday, so the next work day is Monday `2026-10-05`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/today/Secondaries.test.tsx src/components/today/Waiting.test.tsx`
Expected: FAIL, because the components do not exist.

- [ ] **Step 3: Write the two sections**

Create `src/components/today/Secondaries.tsx`:

```tsx
import { useState } from 'react';
import { useSetSecondaries } from '../../api/days';
import { useTasks, useUpdateTask } from '../../api/tasks';
import { useReportError } from '../../api/errors';
import type { Task, TaskStatus } from '../../shared/exec/schemas';
import type { Secondary } from '../../shared/exec/todaySchemas';

type Props = { date: string; secondaries: Secondary[] };

const CHOOSABLE: readonly TaskStatus[] = ['inbox', 'this_week', 'later'];
const SMALL = 'rounded border border-line px-2 py-1 text-xs text-ink-muted dark:border-ink-muted';

function Chooser({ date, taken, onPick, onClose }: { date: string; taken: string[]; onPick: (task: Task) => void; onClose: () => void }) {
  const committed = useTasks({ week: date });
  const inbox = useTasks({ status: ['inbox'] });
  const all = [...(committed.data ?? []), ...(inbox.data ?? [])];
  const choices = all.filter((task, index) => CHOOSABLE.includes(task.status) && !taken.includes(task.id) && all.findIndex((other) => other.id === task.id) === index);
  return (
    <div className="space-y-2 rounded-lg border border-line p-3 dark:border-ink-muted">
      {choices.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing to choose. Capture it, or commit it on the Week.</p>
      ) : (
        <ul aria-label="Choose a secondary" className="space-y-1">
          {choices.map((task) => (
            <li key={task.id}>
              <button type="button" onClick={() => onPick(task)} className="text-left hover:underline">{task.title}</button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onClose} className="text-sm text-ink-muted">Cancel</button>
    </div>
  );
}

/** Spec C "Today" item 3: at most two rows with a checkbox; an empty slot offers "add". There is no third row. */
export function Secondaries({ date, secondaries }: Props) {
  const set = useSetSecondaries();
  const update = useUpdateTask();
  const report = useReportError();
  const [choosing, setChoosing] = useState(false);
  const ids = secondaries.map((secondary) => secondary.task.id);
  const save = (taskIds: string[]) => set.mutate({ date, taskIds }, { onSuccess: () => setChoosing(false), onError: report('set the secondaries') });
  const toggle = (task: Task, done: boolean) => update.mutate({ id: task.id, patch: { status: done ? 'done' : 'this_week' } }, { onError: report('update the task') });
  return (
    <section aria-label="Secondary" className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Secondary</h2>
      <ul className="space-y-1">
        {secondaries.map(({ task }) => (
          <li key={task.id} className="flex items-center gap-2">
            <input type="checkbox" aria-label={task.title} checked={task.status === 'done'} onChange={(e) => toggle(task, e.target.checked)} />
            <span className={task.status === 'done' ? 'flex-1 text-ink-muted line-through' : 'flex-1'}>{task.title}</span>
            <button type="button" aria-label={`Remove "${task.title}"`} onClick={() => save(ids.filter((id) => id !== task.id))} className={SMALL}>Remove</button>
          </li>
        ))}
      </ul>
      {secondaries.length < 2 &&
        (choosing ? (
          <Chooser date={date} taken={ids} onPick={(task) => save([...ids, task.id])} onClose={() => setChoosing(false)} />
        ) : (
          <button type="button" onClick={() => setChoosing(true)} className={SMALL}>Add a secondary</button>
        ))}
    </section>
  );
}
```

Create `src/components/today/Waiting.tsx`:

```tsx
import { useState } from 'react';
import { useUpdateTask } from '../../api/tasks';
import { useReportError } from '../../api/errors';
import { nextWorkDay } from '../../shared/exec/today';
import type { Task, TaskPatch } from '../../shared/exec/schemas';

type Props = { today: string; workDays: readonly number[]; waiting: Task[] };

const SMALL = 'rounded border border-line px-2 py-1 text-xs text-ink-muted dark:border-ink-muted';

/** Spec C "Today" item 4: delegated and waiting items due for follow-up; "Followed up" moves the date on, "Received" closes it. */
export function Waiting({ today, workDays, waiting }: Props) {
  const update = useUpdateTask();
  const report = useReportError();
  const [open, setOpen] = useState(false);
  const act = (task: Task, patch: TaskPatch, verb: string) => update.mutate({ id: task.id, patch }, { onError: report(verb) });
  const summary = waiting.length === 1 ? '1 delegated item needs follow-up' : `${waiting.length} delegated items need follow-up`;
  return (
    <section aria-label="Waiting" className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">Waiting</h2>
      {waiting.length === 0 ? (
        <p className="text-sm text-ink-muted">Nothing to follow up today.</p>
      ) : (
        <>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="text-left hover:underline">{summary}</button>
          {open && (
            <ul className="space-y-2">
              {waiting.map((task) => (
                <li key={task.id} className="flex flex-wrap items-center gap-2">
                  <span className="flex-1">{task.title} — {task.ownerName}</span>
                  <button type="button" aria-label={`Followed up on "${task.title}"`} onClick={() => act(task, { followUpDate: nextWorkDay(today, workDays) }, 'record the follow-up')} className={SMALL}>Followed up</button>
                  <button type="button" aria-label={`Received "${task.title}"`} onClick={() => act(task, { status: 'done' }, 'mark it received')} className={SMALL}>Received</button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Put them on Today**

In `src/screens/Today.tsx`, add the imports:

```tsx
import { Secondaries } from '../components/today/Secondaries';
import { Waiting } from '../components/today/Waiting';
```

and, inside the `{loaded && mode && (<> … </>)}` fragment, directly after `<PrimaryCard … />`, add:

```tsx
          <Secondaries date={loaded.view.date} secondaries={loaded.view.secondaries} />
          <Waiting today={loaded.view.date} workDays={loaded.settings.workDays} waiting={loaded.view.waiting} />
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/today src/screens/Today.test.tsx src/app/App.test.tsx`
Expected: PASS: 2 Secondaries tests, 2 Waiting tests, and the Today and App tests (their empty days render "Nothing to follow up today." and "Add a secondary").

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/today/Secondaries.tsx src/components/today/Waiting.tsx src/components/today/Secondaries.test.tsx src/components/today/Waiting.test.tsx src/screens/Today.tsx
git commit -m "feat: add the two secondaries and the Waiting follow-ups to Today"
```

---

### Task 12: The Settings panel

**Files:**
- Create: `src/screens/Settings.tsx`, `src/components/settings/BuildBlocksField.tsx`
- Modify: `src/lib/labels.ts` (add `WEEKDAY_NAMES`), `src/app/routes.tsx`, `src/app/Shell.tsx`
- Test: `src/screens/Settings.test.tsx`

**Interfaces:**
- Consumes: `useSettings`, `useUpdateSettings`, `useReportError` (Task 7); `useToast`; `LoadError` (Task 9); `type Settings` (`schemas.ts`); `type SettingsUpdate` (`todaySchemas.ts`).
- Produces:
  - `/settings`, inside the shell but not in the five-entry navigation. A "Settings" link sits above each shell screen.
  - The form "Schedule":
    - Checkboxes named by weekday (Sunday…Saturday).
    - Time fields "Deep work starts", "Shutdown", "Office opens", "Office closes", and a number field "Deep work minutes".
    - `BuildBlocksField`, with `Build block N day|start|minutes`, `Remove build block N` and "Add a build block".
    - "Save settings", which PUTs the schedule and toasts "Settings saved.". Reversed office hours show "Office hours must start before they end." and disable saving.
  - `WEEKDAY_NAMES: readonly string[]`.

- [ ] **Step 1: Write the failing tests**

Create `src/screens/Settings.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeDayView } from '../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const api = () => stubFetch((url, init) => (init?.method === 'PUT' ? json(SETTINGS) : url.includes('/days/') ? json(makeDayView()) : url.endsWith('/settings') ? json(SETTINGS) : json([])));

describe('/settings', () => {
  it('shows the schedule and saves the edits', async () => {
    const calls = api();
    renderRoute('/settings');
    const friday = await screen.findByRole('checkbox', { name: 'Friday' });
    expect(friday).toBeChecked();
    await userEvent.click(friday);
    fireEvent.change(screen.getByLabelText('Deep work starts'), { target: { value: '09:00' } });
    await userEvent.click(screen.getByRole('button', { name: 'Add a build block' }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove build block 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({
        workDays: [1, 2, 3, 4],
        deepWorkStart: '09:00',
        deepWorkMinutes: 90,
        shutdownTime: '17:00',
        officeStart: '08:15',
        officeEnd: '18:00',
        buildBlocks: [
          { weekday: 4, start: '06:30', minutes: 50 },
          { weekday: 6, start: '09:00', minutes: 180 },
          { weekday: 6, start: '09:00', minutes: 120 },
        ],
      })
    );
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
  });

  it('refuses reversed office hours before sending them', async () => {
    api();
    renderRoute('/settings');
    fireEvent.change(await screen.findByLabelText('Office opens'), { target: { value: '19:00' } });
    expect(screen.getByText('Office hours must start before they end.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  });

  it('allows a week with no work days', async () => {
    const calls = api();
    renderRoute('/settings');
    await screen.findByRole('checkbox', { name: 'Monday' });
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) await userEvent.click(screen.getByRole('checkbox', { name: day }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ workDays: [] }));
  });

  it('is reachable from the shell without joining the five-entry navigation', async () => {
    api();
    renderRoute('/');
    expect(await screen.findByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('navigation', { name: 'Primary' })).not.toHaveTextContent('Settings');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/screens/Settings.test.tsx`
Expected: FAIL. `/settings` renders "Nothing here", and there is no Settings link.

- [ ] **Step 3: Write the build-blocks field and the screen**

In `src/lib/labels.ts`, append:

```ts
export const WEEKDAY_NAMES: readonly string[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
```

Create `src/components/settings/BuildBlocksField.tsx`:

```tsx
import type { Settings } from '../../shared/exec/schemas';
import { WEEKDAY_NAMES } from '../../lib/labels';

type Block = Settings['buildBlocks'][number];
type Props = { value: Block[]; onChange: (blocks: Block[]) => void };

const FIELD = 'rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink';

/** The build blocks (§16): a weekday, a start and a length each. Saturday 09:00 for two hours is the default for a new one. */
export function BuildBlocksField({ value, onChange }: Props) {
  const set = (index: number, patch: Partial<Block>) => onChange(value.map((block, at) => (at === index ? { ...block, ...patch } : block)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm">Build blocks</legend>
      {value.length === 0 && <p className="text-sm text-ink-muted">No build blocks.</p>}
      {value.map((block, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <select aria-label={`Build block ${index + 1} day`} value={block.weekday} onChange={(e) => set(index, { weekday: Number(e.target.value) })} className={FIELD}>
            {WEEKDAY_NAMES.map((name, day) => <option key={name} value={day}>{name}</option>)}
          </select>
          <input type="time" aria-label={`Build block ${index + 1} start`} value={block.start} onChange={(e) => set(index, { start: e.target.value })} className={FIELD} />
          <input type="number" min={15} max={600} aria-label={`Build block ${index + 1} minutes`} value={block.minutes} onChange={(e) => set(index, { minutes: Number(e.target.value) })} className={`${FIELD} w-24`} />
          <button type="button" aria-label={`Remove build block ${index + 1}`} onClick={() => onChange(value.filter((_, at) => at !== index))} className="text-sm text-ink-muted">Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { weekday: 6, start: '09:00', minutes: 120 }])} className="rounded border border-line px-2 py-1 text-sm dark:border-ink-muted">
        Add a build block
      </button>
    </fieldset>
  );
}
```

Create `src/screens/Settings.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { LoadError } from '../components/LoadError';
import { BuildBlocksField } from '../components/settings/BuildBlocksField';
import { useToast } from '../components/Toast';
import { useSettings, useUpdateSettings } from '../api/settings';
import { useReportError } from '../api/errors';
import { WEEKDAY_NAMES } from '../lib/labels';
import type { Settings } from '../shared/exec/schemas';
import type { SettingsUpdate } from '../shared/exec/todaySchemas';

const FIELD = 'rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink';

const scheduleOf = (settings: Settings): SettingsUpdate => ({
  workDays: settings.workDays,
  deepWorkStart: settings.deepWorkStart,
  deepWorkMinutes: settings.deepWorkMinutes,
  shutdownTime: settings.shutdownTime,
  officeStart: settings.officeStart,
  officeEnd: settings.officeEnd,
  buildBlocks: settings.buildBlocks,
});

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className={FIELD} />
    </label>
  );
}

function ScheduleForm({ initial, pending, onSave }: { initial: SettingsUpdate; pending: boolean; onSave: (schedule: SettingsUpdate) => void }) {
  const [schedule, setSchedule] = useState(initial);
  const set = (patch: Partial<SettingsUpdate>) => setSchedule((current) => ({ ...current, ...patch }));
  const toggleDay = (day: number, on: boolean) =>
    set({ workDays: on ? [...schedule.workDays, day].sort((a, b) => a - b) : schedule.workDays.filter((other) => other !== day) });
  const reversed = schedule.officeStart >= schedule.officeEnd;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reversed && !pending) onSave(schedule);
  };
  return (
    <form aria-label="Schedule" onSubmit={submit} className="space-y-5">
      <fieldset className="space-y-1">
        <legend className="text-sm">Work days</legend>
        <div className="flex flex-wrap gap-3">
          {WEEKDAY_NAMES.map((name, day) => (
            <label key={name} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={schedule.workDays.includes(day)} onChange={(e) => toggleDay(day, e.target.checked)} />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <TimeField label="Deep work starts" value={schedule.deepWorkStart} onChange={(deepWorkStart) => set({ deepWorkStart })} />
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Deep work minutes</span>
        <input type="number" min={15} max={240} value={schedule.deepWorkMinutes} onChange={(e) => set({ deepWorkMinutes: Number(e.target.value) })} className={`${FIELD} w-24`} />
      </label>
      <TimeField label="Shutdown" value={schedule.shutdownTime} onChange={(shutdownTime) => set({ shutdownTime })} />
      <TimeField label="Office opens" value={schedule.officeStart} onChange={(officeStart) => set({ officeStart })} />
      <TimeField label="Office closes" value={schedule.officeEnd} onChange={(officeEnd) => set({ officeEnd })} />
      {reversed && <p className="text-sm">Office hours must start before they end.</p>}
      <BuildBlocksField value={schedule.buildBlocks} onChange={(buildBlocks) => set({ buildBlocks })} />
      <button type="submit" disabled={reversed || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
        Save settings
      </button>
    </form>
  );
}

/** Spec D Phase 4: a minimal panel for the times, the work days and the build blocks. The time zone and week start are fixed. */
export default function SettingsScreen() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const report = useReportError();
  const toast = useToast();
  return (
    <ScreenShell title="Settings">
      {settings.isError && <LoadError what="the schedule" error={settings.error} onRetry={() => void settings.refetch()} />}
      {settings.data && (
        <ScheduleForm
          initial={scheduleOf(settings.data)}
          pending={update.isPending}
          onSave={(schedule) => update.mutate(schedule, { onSuccess: () => toast.show('Settings saved.'), onError: report('save the settings') })}
        />
      )}
    </ScreenShell>
  );
}
```

The component is named `SettingsScreen` because a `Settings` function would clash with the imported `Settings` type.

- [ ] **Step 4: Route it and link it**

In `src/app/routes.tsx`, add `import SettingsScreen from '../screens/Settings';`, and in the Shell route's children add `{ path: 'settings', element: <SettingsScreen /> },` directly before the `*` child.

In `src/app/Shell.tsx`, change the import to `import { Link, NavLink, Outlet } from 'react-router-dom';`, and inside `<main>`, before `<ApiStatus />`, add:

```tsx
        <div className="flex justify-end">
          <Link to="/settings" className="text-sm text-ink-muted hover:text-ink dark:hover:text-paper">Settings</Link>
        </div>
```

The link sits outside `<nav aria-label="Primary">`, so the five-entry navigation (and `smoke.spec.ts`'s check of it) is unchanged.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/screens/Settings.test.tsx src/app/App.test.tsx`
Expected: PASS, 4 Settings tests plus every App test ("exactly the five primary destinations" included).

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Settings.tsx src/screens/Settings.test.tsx src/components/settings src/lib/labels.ts src/app/routes.tsx src/app/Shell.tsx
git commit -m "feat: add a minimal Settings panel for times, work days and build blocks"
```

---

### Task 13: Must Ships on the Week and on projects

**Files:**
- Modify: `src/shared/exec/schemas.ts` (`projectSummarySchema` gains `mustShipCandidates`), `server/exec/projects/store.ts`, `src/test/fixtures.ts` (`makeProjectSummary`), `src/components/outcomes/OutcomeCard.tsx`, `src/components/outcomes/OutcomeForm.tsx`, `src/components/week/WeekSlots.tsx`, `src/screens/Projects.tsx`, `src/screens/ProjectDetail.tsx`
- Test: `server/exec/__tests__/projects-store.test.ts` (append), `src/components/outcomes/OutcomeCard.test.tsx` (append), `src/components/outcomes/OutcomeForm.test.tsx` (append), `src/screens/Projects.test.tsx` (append), `src/screens/ProjectDetail.test.tsx` (fetch stub plus one test)

**Interfaces:**
- Consumes: `useMustShips`, `useCreateMustShip`, `useReportError` (Task 7); `MustShipForm` (Task 8); `createMustShip` (Task 4, for the server test); `contextOf` (`week.ts`).
- Produces:
  - `ProjectSummary.mustShipCandidates: number` counts planned, undated Must Ships linked to the project. The projects list shows `· N candidate(s)` when it is above zero.
  - The project page gets a region "Must Ship candidates": the list, plus a `MustShipForm` whose submit is "Add candidate". It creates an undated Must Ship in the project's context and linked to the project.
  - `OutcomeCard` gets the optional prop `mustShipCount?: { shipped: number; total: number }` and shows `Must Ships shipped x of y` when the total is above zero. `WeekSlots` feeds it from `useMustShips({ week })`.
  - `OutcomeForm`'s project list shows only projects in the outcome's context (Office → work, anything else → build), plus the one already selected. **This is a ruling made without the owner's answer.** To show every active project instead, drop the context clause in Step 4; nothing else depends on it.

- [ ] **Step 1: Write the failing tests**

Append to `server/exec/__tests__/projects-store.test.ts`, adding `import { createMustShip } from '../mustShips/store';` to its imports:

```ts
describe('Must Ship candidates on projects', () => {
  it('counts planned, undated Must Ships linked to each project', () => {
    const project = createProject(db, { name: 'Supply plan', context: 'work', notes: '' }, T0);
    const base = { context: 'work' as const, definitionOfDone: '', outcomeId: null, projectId: project.id, notes: '' };
    createMustShip(db, { ...base, title: 'Candidate', date: null }, T0);
    createMustShip(db, { ...base, title: 'Dated', date: '2026-09-29' }, T0);
    const shipped = createMustShip(db, { ...base, title: 'Old', date: null }, T0);
    db.prepare("UPDATE must_ships SET status = 'shipped' WHERE id = ?").run(shipped.id);
    expect(listProjectSummaries(db).find((summary) => summary.id === project.id)?.mustShipCandidates).toBe(1);
  });
});
```

(`projects-store.test.ts` already has `db`, `T0` and `createProject` in scope. If its `beforeEach` names the database differently, use that name.)

Append to `src/components/outcomes/OutcomeCard.test.tsx`:

```tsx
describe('OutcomeCard Must Ship count', () => {
  it('shows how many of its Must Ships shipped, and nothing without any', () => {
    const outcome = makeOutcome({ title: 'Supplier plan confirmed' });
    const { unmount } = renderWithProviders(<OutcomeCard outcome={outcome} onUpdate={vi.fn()} onKill={vi.fn()} mustShipCount={{ shipped: 1, total: 2 }} />);
    expect(screen.getByText('Must Ships shipped 1 of 2')).toBeInTheDocument();
    unmount();
    renderWithProviders(<OutcomeCard outcome={outcome} onUpdate={vi.fn()} onKill={vi.fn()} />);
    expect(screen.queryByText(/Must Ships shipped/)).toBeNull();
  });
});
```

(Reuse the file's existing imports of `renderWithProviders`, `makeOutcome`, `screen` and `vi`, and add any that are missing.)

Append to `src/components/outcomes/OutcomeForm.test.tsx`:

```tsx
describe('OutcomeForm project context', () => {
  it('offers projects of the outcome\'s context and follows a category change', async () => {
    stubFetch(() => json([makeProjectSummary({ name: 'Supply plan', context: 'work' }), makeProjectSummary({ name: 'Pinkbox', context: 'build' })]));
    renderWithProviders(<OutcomeForm defaultTargetDate="2026-09-25" submitLabel="Add outcome" onSubmit={vi.fn()} />);
    expect(await screen.findByRole('option', { name: 'Supply plan' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Pinkbox' })).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Business');
    expect(screen.getByRole('option', { name: 'Pinkbox' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Supply plan' })).toBeNull();
  });
});
```

Append to `src/screens/Projects.test.tsx`, inside the existing `describe('/projects', …)`:

```tsx
  it('counts Must Ship candidates beside a project', async () => {
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : json([makeProjectSummary({ name: 'Supply plan', mustShipCandidates: 2 })])));
    renderRoute('/projects');
    expect(await screen.findByRole('region', { name: 'Work' })).toHaveTextContent('0 outcomes · 0 open tasks · 2 candidates');
  });
```

In `src/screens/ProjectDetail.test.tsx`:
- Change the first test's `stubFetch` line to answer the candidates list:

```tsx
    const calls = stubFetch((url, init) =>
      url.endsWith('/settings') ? json(SETTINGS) : url.includes('/must-ships') ? json([]) : init?.method === 'PATCH' ? json(project) : json(detail)
    );
```

- Append this test inside its `describe`, adding `makeMustShip` to the fixtures import:

```tsx
  it('lists Must Ship candidates and adds one to the project', async () => {
    const project = makeProjectSummary({ name: 'Supply plan' });
    const detail = { project, outcomes: [], tasks: [] };
    const calls = stubFetch((url, init) =>
      url.endsWith('/settings')
        ? json(SETTINGS)
        : init?.method === 'POST'
          ? json(makeMustShip(), 201)
          : url.includes('/must-ships')
            ? json([makeMustShip({ title: 'Price list approved', date: null, projectId: project.id })])
            : json(detail)
    );
    renderRoute(`/projects/${project.id}`);
    const region = await screen.findByRole('region', { name: 'Must Ship candidates' });
    expect(await within(region).findByText('Price list approved')).toBeInTheDocument();
    expect(calls.find((c) => c.url.includes('/must-ships'))?.url).toBe(`/api/exec/must-ships?date=none&status=planned&project=${project.id}`);
    await userEvent.type(within(region).getByLabelText('Must Ship'), 'Delivery tracker sent');
    await userEvent.click(within(region).getByRole('button', { name: 'Add candidate' }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')?.body).toEqual({ title: 'Delivery tracker sent', definitionOfDone: '', outcomeId: null, context: 'work', date: null, projectId: project.id })
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/projects-store.test.ts src/components/outcomes src/screens/Projects.test.tsx src/screens/ProjectDetail.test.tsx`
Expected: FAIL, because there is no `mustShipCandidates`, no Must Ship count on the card, no context filter, and no candidates region.

- [ ] **Step 3: Count candidates on the server**

In `src/shared/exec/schemas.ts`, extend `projectSummarySchema`:

```ts
export const projectSummarySchema = projectSchema.extend({
  activeOutcomes: z.number().int().nonnegative(),
  openTasks: z.number().int().nonnegative(),
  mustShipCandidates: z.number().int().nonnegative(),
});
```

In `server/exec/projects/store.ts`, add a third subquery to `listProjectSummaries`'s `SELECT`, after the `open_tasks` line (put a comma after `AS open_tasks`):

```sql
         (SELECT COUNT(*) FROM must_ships m WHERE m.project_id = p.id AND m.date IS NULL AND m.status = 'planned') AS must_ship_candidates
```

Update its doc comment to `/** Active projects first, then done, then archived; each with its active outcomes, open tasks and Must Ship candidates. */`.

In `src/test/fixtures.ts`, add `mustShipCandidates: 0,` to `makeProjectSummary`'s returned object, after `openTasks: 0,`.

- [ ] **Step 4: Show the counts, the candidates and the context filter**

In `src/components/outcomes/OutcomeCard.tsx`:
- Change `Props` to `type Props = { outcome: Outcome; onUpdate: (patch: OutcomePatch, options?: UpdateOptions) => void; onKill: (reason: ReviewReason) => void; mustShipCount?: { shipped: number; total: number } };`.
- Destructure `mustShipCount` in `OutcomeCard({ outcome, onUpdate, onKill, mustShipCount })`.
- Directly after the `{outcome.targetDate && …}` line, add:

```tsx
      {mustShipCount && mustShipCount.total > 0 && <p className="text-sm text-ink-muted">Must Ships shipped {mustShipCount.shipped} of {mustShipCount.total}</p>}
```

In `src/components/week/WeekSlots.tsx`:
- Add `import { useMustShips } from '../../api/mustShips';` and `import type { MustShip } from '../../shared/exec/todaySchemas';`.
- Change `Slots` to take the week's Must Ships: its signature becomes `function Slots({ outcomes, mustShips }: { outcomes: Outcome[]; mustShips: MustShip[] })`, and add to its `OutcomeCard` element:

```tsx
            mustShipCount={countFor(mustShips, outcome.id)}
```

- Add this helper above `Slots`:

```tsx
/** Spec C "Week" item 2: Must Ships shipped x of y, over the week's dated Must Ships linked to the outcome. */
function countFor(mustShips: MustShip[], outcomeId: string): { shipped: number; total: number } {
  const linked = mustShips.filter((mustShip) => mustShip.outcomeId === outcomeId);
  return { shipped: linked.filter((mustShip) => mustShip.status === 'shipped').length, total: linked.length };
}
```

- In `WeekSlots`, add `const mustShips = useMustShips({ week: weekStartDate }, { enabled: view !== null }).data ?? [];` (there is nothing to count until the week has loaded, and waiting keeps the read on the settings-derived week), and render `<Slots outcomes={slotted} mustShips={mustShips} />`.

In `src/components/outcomes/OutcomeForm.tsx`, add `import { contextOf } from '../../shared/exec/week';` and change the `projects` line to:

```tsx
  const projects = (useProjects().data ?? []).filter(
    (project) => project.status === 'active' && (project.context === contextOf(f.category) || project.id === f.projectId)
  );
```

In `src/screens/Projects.tsx`, change the counts span's last line so candidates follow when there are any:

```tsx
              {plural(project.activeOutcomes, 'outcome')} · {plural(project.openTasks, 'open task')}
              {project.mustShipCandidates > 0 && ` · ${plural(project.mustShipCandidates, 'candidate')}`}
```

In `src/screens/ProjectDetail.tsx`:
- Add the imports:

```tsx
import { useCreateMustShip, useMustShips } from '../api/mustShips';
import { MustShipForm } from '../components/mustShip/MustShipForm';
import type { Outcome, Project } from '../shared/exec/schemas';
```

- Add the `Candidates` component above the default export:

```tsx
/** Spec C "Projects" (§17): planned outputs with no date yet, waiting to become a day's Must Ship. */
function Candidates({ project, outcomes }: { project: Project; outcomes: Outcome[] }) {
  const candidates = useMustShips({ date: 'none', project: project.id, status: ['planned'] });
  const create = useCreateMustShip();
  const report = useReportError();
  const [formKey, setFormKey] = useState(0);
  const list = candidates.data ?? [];
  return (
    <section aria-label="Must Ship candidates" className="space-y-2">
      <h2 className="text-xl font-medium">Must Ship candidates</h2>
      {list.length === 0 && <p className="text-ink-muted">No candidates yet. Planned outputs with no date wait here.</p>}
      <ul>{list.map((candidate) => <li key={candidate.id}>{candidate.title}</li>)}</ul>
      <MustShipForm
        key={formKey}
        outcomes={outcomes}
        submitLabel="Add candidate"
        pending={create.isPending}
        onSubmit={(fields) =>
          create.mutate({ ...fields, context: project.context, date: null, projectId: project.id }, { onSuccess: () => setFormKey((key) => key + 1), onError: report('add the candidate') })
        }
      />
    </section>
  );
}
```

- Render it directly after the Outcomes section:

```tsx
      <Candidates project={project} outcomes={outcomes.filter((outcome) => outcome.status === 'active' && outcome.slot !== null)} />
```

`ProjectDetail.tsx` already imports `useState` and `useReportError`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/projects-store.test.ts src/components/outcomes src/screens/Projects.test.tsx src/screens/ProjectDetail.test.tsx src/screens/Week.test.tsx`
Expected: PASS: the new tests plus every existing one in those files. The Week tests stub unknown URLs, and the Must Ships they get back carry no `outcomeId`, so no count shows.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/exec/schemas.ts server/exec/projects/store.ts src/test/fixtures.ts src/components/outcomes src/components/week/WeekSlots.tsx src/screens/Projects.tsx src/screens/ProjectDetail.tsx server/exec/__tests__/projects-store.test.ts src/screens/Projects.test.tsx src/screens/ProjectDetail.test.tsx
git commit -m "feat: show Must Ships shipped on outcome cards and Must Ship candidates on projects"
```

---

### Task 14: Monday's Must Ship on the plan, and load errors everywhere

**Files:**
- Modify: `src/screens/Plan.tsx`, `src/screens/Week.tsx`, `src/screens/Projects.tsx`
- Test: `src/screens/Plan.test.tsx`, `src/screens/Week.test.tsx`, `src/screens/Projects.test.tsx` (append)

**Interfaces:**
- Consumes: `useDay` (Task 7); `MustShipPicker` (Task 8); `LoadError` (Task 9); `nextWorkDay`, `dayLabel` (Task 2); `contextOf`; `useToday().settings`.
- Produces:
  - `/plan`'s planned view gets a region "Next Must Ship" headed `Must Ship for <dayLabel(next work day)>`. It shows that day's Must Ship, or the picker for it (spec C "Sunday planning" step 4).
  - `/week`, `/plan` and `/projects` show `LoadError` when their read fails: "the week", "the week" and "projects".

- [ ] **Step 1: Write the failing tests**

Append to `src/screens/Plan.test.tsx`, inside `describe('/plan', …)`:

```tsx
  it('offers the next work day\'s Must Ship once the week is planned', async () => {
    const calls = fakePlanApi(makeLookup({ current: makeWeekView([makeOutcome({ slot: 1 }), makeOutcome({ slot: 2 }), makeOutcome({ slot: 3 })]) }));
    renderRoute('/plan');
    const next = await screen.findByRole('region', { name: 'Next Must Ship' });
    expect(within(next).getByRole('heading', { name: 'Must Ship for Wednesday 23 September' })).toBeInTheDocument();
    await userEvent.type(await within(next).findByLabelText('Must Ship'), 'Price list approved');
    await userEvent.click(within(next).getByRole('button', { name: 'Set Must Ship' }));
    await waitFor(() => expect(calls.find((c) => c.url === '/api/exec/must-ships' && c.method === 'POST')?.body).toMatchObject({ title: 'Price list approved', date: '2026-09-23', context: 'work' }));
  });

  it('says so when the week cannot be read', async () => {
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    renderRoute('/plan');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the week: internal server error');
  });
```

Add `failure` to its import from `'../test/fetch'` (`stubFetch` and `json` are already there). The file's fake clock is Tuesday 22 September 09:00, so the next work day is Wednesday the 23rd.

Append to `src/screens/Week.test.tsx`, inside `describe('/week', …)`:

```tsx
  it('says so when the week cannot be read', async () => {
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    renderRoute('/week');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the week: internal server error');
  });
```

Add `failure` to its import from `'../test/fetch'`.

Append to `src/screens/Projects.test.tsx`, inside `describe('/projects', …)`:

```tsx
  it('says so when the projects cannot be read', async () => {
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    renderRoute('/projects');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load projects: internal server error');
  });
```

Add `failure` to its import from `'../test/fetch'`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/screens/Plan.test.tsx src/screens/Week.test.tsx src/screens/Projects.test.tsx`
Expected: FAIL. There is no "Next Must Ship" region and no alerts.

- [ ] **Step 3: Add step 4 to the plan and the load errors**

In `src/screens/Plan.tsx`:
- Add the imports:

```tsx
import { useDay } from '../api/days';
import { LoadError } from '../components/LoadError';
import { MustShipPicker } from '../components/mustShip/MustShipPicker';
import { dayLabel, nextWorkDay } from '../shared/exec/today';
import { contextOf } from '../shared/exec/week';
import type { Settings } from '../shared/exec/schemas';
```

(merge `contextOf` into the existing `'../shared/exec/week'` import and `Settings` into the existing schemas type import rather than duplicating them).

- Add above `Planned`:

```tsx
/** Step 4 (spec C "Sunday planning"): the next work day's Must Ship can be set here too. */
function NextMustShip({ today, settings, outcomes }: { today: string; settings: Settings; outcomes: Outcome[] }) {
  const next = nextWorkDay(today, settings.workDays);
  const day = useDay(next);
  const work = outcomes.filter((outcome) => outcome.status === 'active' && contextOf(outcome.category) === 'work');
  return (
    <section aria-label="Next Must Ship" className="space-y-2 border-t border-line pt-4 dark:border-ink-muted">
      <h3 className="text-lg font-medium">Must Ship for {dayLabel(next)}</h3>
      {day.data?.mustShip ? <p>{day.data.mustShip.title}</p> : day.data ? <MustShipPicker date={next} context="work" outcomes={work} /> : null}
    </section>
  );
}
```

- Change `Planned` to take and render it:

```tsx
function Planned({ startDate, outcomes, today, settings }: { startDate: string; outcomes: Outcome[]; today: string; settings: Settings | undefined }) {
```

and, after the links `<div>`, inside its `<section>`:

```tsx
      {settings && <NextMustShip today={today} settings={settings} outcomes={outcomes} />}
```

- In `Plan`, take `settings` from `useToday()` (`const { today, weekStartDay, ready, settings } = useToday();`), pass `today={today} settings={settings}` to `<Planned … />`, and replace the loading line `{!lookup.isSuccess && <p className="text-ink-muted">Loading the week…</p>}` with:

```tsx
      {lookup.isError && <LoadError what="the week" error={lookup.error} onRetry={() => void lookup.refetch()} />}
      {!lookup.isSuccess && !lookup.isError && <p className="text-ink-muted">Loading the week…</p>}
```

In `src/screens/Week.tsx`, import `LoadError` and add, directly after the header `<div>`:

```tsx
      {lookup.isError && <LoadError what="the week" error={lookup.error} onRetry={() => void lookup.refetch()} />}
```

In `src/screens/Projects.tsx`, import `LoadError`, change `const projects = useProjects().data;` to `const query = useProjects(); const projects = query.data;`, and add directly after `<NewProject />`:

```tsx
      {query.isError && <LoadError what="projects" error={query.error} onRetry={() => void query.refetch()} />}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/screens`
Expected: PASS, the 4 new tests and every existing screen test.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Plan.tsx src/screens/Week.tsx src/screens/Projects.tsx src/screens/Plan.test.tsx src/screens/Week.test.tsx src/screens/Projects.test.tsx
git commit -m "feat: set the next work day's Must Ship from the plan and show load errors on Week, Plan and Projects"
```

---

### Task 15: The day journey and README

**Files:**
- Create: `e2e/today.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes the running app: Today's regions and labels (Tasks 9–11), `/settings` (Task 12), and `/api/exec/must-ships`, `/api/exec/days`, `/api/exec/tasks` and `/api/exec/settings`.
- Produces three desktop journeys in `e2e/today.spec.ts`, which sorts after `smoke.spec.ts` and before `week.spec.ts`.

- [ ] **Step 1: Write the journeys**

Create `e2e/today.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// A fixed browser clock makes Today's moment deterministic: Tuesday 2 March 2027, 09:00 in Karachi.
// The date is far from any week week.spec.ts plans, and one worker runs the files in order on one database.
// Playwright matches role names by substring unless told otherwise, so "Must Ship" is exact where other regions share the words.
const TUESDAY_0900 = new Date('2027-03-02T04:00:00Z');
const DATE = '2027-03-02';
const NUDGE = 'This sounds like an activity. What will exist when it is finished?';
const SECONDARIES = ['Price list sent to Hilal', 'Dashboard numbers checked', 'Venue booked for the offsite'];
const DEFAULT_SCHEDULE = {
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

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(TUESDAY_0900);
});

test('chooses the Must Ship, refuses a second, and holds two secondaries', async ({ page, request }) => {
  for (const title of SECONDARIES) await request.post('/api/exec/tasks', { data: { title, context: 'work' } });

  await page.goto('/');
  const choose = page.getByRole('region', { name: "Choose today's Must Ship" });
  await expect(choose).toBeVisible();
  const title = choose.getByLabel('Must Ship', { exact: true });
  await title.fill('Follow up with suppliers');
  await expect(choose.getByRole('note')).toHaveText(NUDGE);
  await title.fill('Delivery tracker sent to the top 20');
  await choose.getByLabel('Definition of done').fill('Sent and acknowledged by all 20');
  await choose.getByRole('button', { name: 'Set Must Ship' }).click();

  const card = page.getByRole('region', { name: 'Must Ship', exact: true });
  await expect(card.getByRole('heading', { level: 2, name: 'Delivery tracker sent to the top 20' })).toBeVisible();
  await expect(card.getByRole('link', { name: 'Start deep work' })).toHaveAttribute('href', '/focus');

  const second = await request.post('/api/exec/must-ships', { data: { title: 'Another one', context: 'work', date: DATE } });
  expect(second.status()).toBe(409);
  expect((await second.json()).code).toBe('DAY_TAKEN');

  const secondary = page.getByRole('region', { name: 'Secondary' });
  for (const name of SECONDARIES.slice(0, 2)) {
    await secondary.getByRole('button', { name: 'Add a secondary' }).click();
    await secondary.getByRole('list', { name: 'Choose a secondary' }).getByRole('button', { name }).click();
    await expect(secondary.getByRole('checkbox', { name })).toBeVisible();
  }
  await expect(secondary.getByRole('button', { name: 'Add a secondary' })).toHaveCount(0);

  const tasks = (await (await request.get('/api/exec/tasks')).json()).data as { id: string; title: string }[];
  const ids = SECONDARIES.map((name) => tasks.find((task) => task.title === name)?.id);
  const third = await request.put(`/api/exec/days/${DATE}/slots`, { data: { taskIds: ids } });
  expect(third.status()).toBe(400);
  expect((await third.json()).code).toBe('SLOT_LIMIT');
});

test('moves through the day: Build before the office, Close the day after shutdown time', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-03-02T01:00:00Z'));
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Build' })).toContainText('Build block 06:30 · 50 min');

  await page.clock.setFixedTime(new Date('2027-03-02T12:30:00Z'));
  await page.reload();
  await expect(page.getByRole('link', { name: 'Close the day' })).toHaveAttribute('href', '/shutdown');
  await expect(page.getByRole('region', { name: 'Must Ship', exact: true })).toContainText('Delivery tracker sent to the top 20');
});

test('edits the schedule and Today follows it', async ({ page, request }) => {
  await page.goto('/settings');
  await page.getByRole('checkbox', { name: 'Tuesday' }).uncheck();
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByText('Settings saved.')).toBeVisible();

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Build' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Must Ship', exact: true })).toHaveCount(0);

  const restored = await request.put('/api/exec/settings', { data: DEFAULT_SCHEDULE });
  expect(restored.status()).toBe(200);
});
```

- [ ] **Step 2: Run the journeys**

Run: `npm run test:e2e`
Expected: 13 passed (11 desktop, 2 phone). Afterwards `ls -d "$(node -p 'require("os").tmpdir()')"/taskflow-e2e-* 2>/dev/null | wc -l` prints `0`.

If a journey fails, read the Playwright error and trace before changing anything, and never loosen an assertion. If `smoke.spec.ts`'s first-run assertion fails, check the file order in the report. If `week.spec.ts` fails on Today's "outcomes done" line, check that the settings restore at the end of the third journey returned 200.

- [ ] **Step 3: Update the README**

In `README.md`, after the "Planning the week" section, add:

```markdown
## Today and the Must Ship

Today shows one card for the moment. In office hours on a work day it asks
for today's Must Ship — one output that must exist by the end of the day —
and then offers "Start deep work". Outside office hours and on non-work days
it shows the Build card instead. A second Must Ship for the same day is
refused; to change it, edit it or put it back among the candidates. Up to
two secondary tasks sit below it (there is no third), then anything delegated
that is due for follow-up. From 17:00 a "Close the day" banner appears.
Candidates — planned outputs with no date yet — live on each project's page.
The schedule (work days, deep-work window, shutdown, office hours, build
blocks) is edited at `/settings`.
```

- [ ] **Step 4: Verify and commit**

Run: `npm run lint && npx vitest run`
Expected: clean; all green.

```bash
git add e2e/today.spec.ts README.md
git commit -m "test: add the Must Ship, day-moments and schedule journeys"
```

---

### Task 16: Phase 4 verification and report

**Files:** none are created; this is the after-every-phase ritual from the spec (section D).

- [ ] **Step 1: Static checks**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 2: Unit and integration coverage**

Run: `npm run test:coverage`
Expected: every project green, and the 80% line threshold passes. Note the totals and any file under 80% for the report.

- [ ] **Step 3: Journeys**

Run: `npm run test:e2e`
Expected: 13 passed, and `ls -d "$(node -p 'require("os").tmpdir()')"/taskflow-e2e-* 2>/dev/null | wc -l` prints `0`.

- [ ] **Step 4: Manual run against the phase's bar**

The spec's Phase 4 "Done when" is: *`DAY_TAKEN` and the two-slot limit hold; Today's action matches the table for every moment.*

Never touch `data/*.db`. Copy them to a temp directory and point the servers at the copy:
- `D=$(mktemp -d "$(node -p 'require("os").tmpdir()')/taskflow-verify-XXXX")`, then `cp data/execution.db data/taskflow.db "$D"/`.
- Start the API with `DB_PATH="$D/taskflow.db" EXEC_DB_PATH="$D/execution.db" TASKFLOW_API_PORT=4160 npx tsx server/index.ts`.
- Start the web app with `TASKFLOW_API_PORT=4160 npx vite --port 3160 --strictPort`.

Drive it headless with a throwaway Playwright script under `$D`, using `page.clock.setFixedTime` for each moment. Record what you saw at each:
- **A work day at 07:00:** the Build card.
- **At 09:00 with no Must Ship:** "Choose today's Must Ship". Write one with an activity title: the nudge shows, and it still saves. The Must Ship card appears with "Deep work 08:35–10:05" and "Start deep work".
- **A second Must Ship through the API:** 409 `DAY_TAKEN` with `details.mustShip`.
- **"Put back":** the Must Ship returns to the candidates. "Use this" makes it today's Must Ship again.
- **Two secondaries from the Inbox:** the second one leaves the Inbox, and there is no third "Add". A third through the API gets 400 `SLOT_LIMIT`.
- **A delegated task due today:** "1 delegated item needs follow-up". "Followed up" moves it to the next work day; "Received" closes it.
- **17:30:** the "Close the day" banner. **20:00 and a Saturday:** the Build card, with its block from settings.
- **`/settings`:** change the work days and save; the Today moment changes to match. Then restore the settings.
- **`/week`:** a card whose outcome has a shipped Must Ship shows "Must Ships shipped 1 of 1".
- **A project page:** add a candidate; the projects list shows "1 candidate".

Stop both servers (check that `pgrep -af "server/index.ts|vite --port 3160"` shows nothing of yours). Query `"$D/execution.db"` for `SELECT date, context, status, title FROM must_ships ORDER BY date` and `SELECT * FROM day_slots`, then run `rm -rf "$D"`.

Reserved for the owner: the phone check over the tailnet from Phases 1–2. Nothing new in this phase needs the phone.

- [ ] **Step 5: Report**

Write the phase report where the executing skill keeps it. Include:
- the commit list (`git log --oneline main..HEAD`)
- the coverage totals
- the e2e result
- what was verified by hand
- what is reserved for the owner
- anything that did not pass

The spec's Phase 4 row is the reference.

---

## Self-review

**Spec coverage (Phase 4 scope).**
- **"must ships, days and slots routes":**
  - `GET/POST/PATCH /must-ships` and `POST /must-ships/:id/roll` (Tasks 4–5).
  - `GET /days/:date` and `PUT /days/:date/slots` (Task 6).
  - `POST /days/:date/shutdown` belongs with Shutdown (Phase 6), as recorded in the decisions.
- **"Today with its moments":** `todayMode` covers every row of both spec tables, with boundaries (Task 2). The screen maps each primary kind to its card (Tasks 9–10). `resume` and `grade` link to `/focus` until Phase 5.
- **"the Must Ship picker":** candidates or write one, with the nudge (Task 8). It is used on Today (Task 10) and on `/plan` step 4 (Task 14).
- **"secondaries":** at most two, with no third row (Tasks 6 and 11).
- **"Waiting":** Followed up and Received (Task 11).
- **"a minimal Settings panel (times, work days, build blocks)":** Tasks 3 and 12.
- **Done when:**
  - `DAY_TAKEN` holds: store, route, hook, picker and e2e (Tasks 4, 5, 7, 8, 15).
  - The two-slot limit holds: store, route and e2e (Tasks 6, 15).
  - Today's action matches the table for every moment: unit tests (Task 2), screen tests (Task 10), e2e (Task 15) and the manual run (Task 16).
- **Also delivered:**
  - B "The limits" rows for one Must Ship per workday and two secondaries.
  - "Capture ≠ commitment": only slots and Must Ships put work on Today, and an inbox task chosen for today is processed.
  - C "Week" item 2 "Must Ships shipped x of y" (Task 13).
  - C "Projects" Must Ship candidates (Task 13).
  - C "Sunday planning" step 4 (Task 14).
- **Carried from the Phase 3 review:**
  - Load and error states for Today, Week, Plan and Projects (Tasks 9, 10, 14).
  - The day lookup gated on settings (Task 10).
  - Invalidation tests (Task 7).
  - The context filter on the project picker (Task 13, flagged as a ruling).
- **Deferred with their owning phase:**
  - Deep-work routes and focus: Phase 5.
  - The shutdown route, Friday review and the Week card's Roll: Phase 6.
  - The legacy error handler, killed status on project pages, title `maxLength`, and project rename: Phase 7.

**Placeholder scan.** There is no TBD or TODO, and every code step carries its code. Where a step edits an existing file, it names the exact line to replace or the anchor to insert after.

**Type consistency.**
- **Schemas.** `todaySchemas.ts` (Task 1) is the single home of `MustShip`, `MustShipInput`/`MustShipCreate`, `MustShipPatch`, `MustShipQuery`, `DayView`, `Secondary`, `DeepWorkBlock` and `SettingsUpdate`. Server stores, routes, hooks and components import them from there. `schemas.ts` never imports it (no cycle), which is also why project candidates are read through `GET /must-ships?project=` and not through `ProjectDetail`.
- **Must Ship queries.** `MustShipQuery.project` (Task 1) is read by `listMustShips` (Task 4), sent by `MustShipFilters.project` (Task 7), and used by the project page (Task 13).
- **The day.** `DayView.hasHistory` (Tasks 1 and 6) drives `Banners`' `firstWeek` (Tasks 9 and 10). `todayMode(now, settings, view)` (Task 2) is called with `useToday().now`, `useSettings().data` and `useDay(today).data` (Task 10). Its `Primary` kinds `'start' | 'grade'` are exactly `MustShipCard`'s `mode` (Task 9).
- **The picker.** `MustShipPicker({ date, context, outcomes, onDone? })` (Task 8) is used by `ChooseMustShip` (Task 10) and `NextMustShip` (Task 14). `MustShipForm`'s `MustShipFields` (Task 8) are spread into `useCreateMustShip`'s `MustShipInput` together with `context`, `date` and `projectId` (Tasks 8 and 13).
- **Cache keys.** `keys.ts` (Task 7) is the only place key prefixes are defined; `tasks.ts`, `weeks.ts`, `projects.ts` and `settings.ts` re-export theirs.
- **Fixtures.** `makeMustShip` and `makeDayView` (Task 8) are used unchanged in Tasks 9–14. `makeProjectSummary` gains `mustShipCandidates: 0` (Task 13) alongside `projectSummarySchema`.
- **Labels shared with e2e.** These names match between the components, the unit tests and `e2e/today.spec.ts`:
  - regions: "Choose today's Must Ship", "Must Ship", "Build", "Tomorrow", "Secondary", "Waiting", "Next Must Ship", "Must Ship candidates"
  - buttons: "Set Must Ship", `Use "<title>"`, "Put back", "Save Must Ship", "Add a secondary", "Save settings", "Add candidate"
  - links: "Start deep work", "Close the day", "Plan your first week" / "Plan this week"
  - lists and fields: "Choose a secondary", "Must Ship"

**Review Focus coverage.**
1. Boundaries: Task 2's `08:14`, `08:15`, `18:00`, `16:59` and `17:00` cases.
2. Midnight rollover: Task 7's `useToday` test.
3. The `DAY_TAKEN` race: Task 4 (store), Task 5 (route), Task 7 (hook refresh) and Task 8 (picker message).
4. An inbox task chosen as a secondary: Task 6's store test checks it becomes `this_week` scheduled today, and Task 11's component test checks the PUT.
5. No work days and reversed office hours: Task 1 (schema), Task 2 (`todayMode` and `nextWorkDay`), and Task 12 (the form refuses reversed hours and saves an empty week).
