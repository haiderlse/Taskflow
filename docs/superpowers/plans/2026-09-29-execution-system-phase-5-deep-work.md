# Execution System Phase 5: Deep Work — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the deep-work session real. A block can be planned, started, paused, resumed and finished from `/focus` with a countdown that survives a reload; a Blocked exit files a waiting task; the week grid assigns blocks to outcomes (on `/week` and as `/plan` step 3); a browser notice fires five minutes before deep work.

**Architecture:** One new server resource follows the Phase 3–4 pattern of zod parse, then a store, then `insertRow`/`updateRow`, all under `/api/exec/deep-work`: create, list by date range, patch, start, pause, resume, finish. The timer is never stored: it is derived from `started_at`, `paused_seconds` and `pause_started_at` by a pure `elapsed`, so a reload or a second tab loses nothing. A pure `planFocus` decides what `/focus` does (resume the live block, start one, or say there is nothing to focus on), so the screen only executes the plan. The week grid is a presentational component fed by `defaultBlocksFor` proposals plus persisted blocks; saving a proposal is what persists it.

**Tech Stack:** React 19, Vite 6.4, TanStack Query 5, react-router 7, Tailwind v4; Express 5, better-sqlite3 (SQLite 3.53); zod 4.6 (`z.iso.datetime()`, `z.uuid()`); vitest 4.1 (node + jsdom projects), Testing Library, user-event; Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-22-execution-system-design.md` (Phase 5 row in D "Build sequence"; B "deep_work_blocks", "Routes", "Pure core"; C "Deep Work (`/focus`)", "Week" item 4, "Sunday planning" step 3, "Keyboard").

## Global Constraints

Copied from the spec and the earlier plans; every task's requirements include these.

- `/api/exec/*` responses are `{ success: true, data }` or `{ success: false, error, code }` with `code` one of `VALIDATION`, `NOT_FOUND`, `WEEK_FULL`, `DAY_TAKEN`, `SLOT_LIMIT`, `SHUTDOWN_NOT_READY`, `DELETE_NOT_ALLOWED`, `CONSTRAINT`, `INTERNAL`. Error responses never carry a stack, a path, a driver message, or a client-supplied field name or value.
- Every body, query and path parameter is parsed by a zod schema before a store is touched. Schemas for this phase live in `src/shared/exec/deepWorkSchemas.ts`. Every row write to `deep_work_blocks`, `must_ships` or `tasks` goes through `insertRow`/`updateRow` in `server/exec/rows.ts`. Statements are always parameterised.
- The timer is derived, never stored: `elapsed(block, now)` from `started_at`, `ended_at`, `paused_seconds` and `pause_started_at`. Past zero it counts up quietly; there is no alarm.
- At most one block per date is running (started, not ended). Two unfinished blocks on one date never overlap in time. A block must end by midnight and lasts 15 to 600 minutes.
- A block's outcome must be an active, slotted outcome of the week containing the block's date and of the block's context (`contextOf(category)`); a block's Must Ship must be dated the block's date and share its context (work and build never mix, §16).
- A started block cannot be edited. A finished block cannot be finished again. Finishing requires a started block.
- Completing a block ships its Must Ship (unless killed). Blocking one writes the blocker on the Must Ship, sets it `blocked`, and files a `waiting` task for the next action, owned by the blocker's owner, with `follow_up_date` the day after the block's date.
- Every read shows a loading state and a failure state with a retry. A missing read is never rendered as an empty list or an empty region (`data ?? []` must not decide what the user sees).
- The activity nudge, the one-per-day limits and the two-secondary limit from earlier phases are unchanged.
- Time zone Asia/Karachi. All calendar dates are local `YYYY-MM-DD`, timestamps are ISO-8601 UTC set by the server, ids are server-generated UUIDs, and rows are returned camelCase.
- The API always binds `127.0.0.1`. No new environment variables. No new migration: `deep_work_blocks` exists in `001_init.sql`.
- New code compiles under `strict: true` with `noUnusedLocals`/`noUnusedParameters`. `npm run lint` is `tsc --noEmit -p tsconfig.app.json`. Legacy code is not modified: `App.tsx`, the root `components/`, `services/`, `utils/`, `server/routes/*` and `server/db/*`.
- Files stay under 400 lines and functions under 50 lines. No `console.log` in application code. Build new objects rather than mutating.
- TDD: the failing test lands before the code that passes it, and the RED run is recorded before the implementation is written. Coverage stays at 80% lines. Phase 4's 595 tests keep passing, except the tests this plan says to change.
- Commit messages follow `<type>: <description>` and contain nothing else: no `Co-Authored-By`, no `Claude-Session`, no trailer of any kind (the user's own git rules disable attribution). Never push.
- Port 3000 on the development machine is held by another project, so `npm run dev` prints another port (3001). The e2e config uses 3100/4150. `os.tmpdir()` is `/mnt/clarus_nvme/tmp`. Manual checks run against a temp copy of `data/`, never the owner's real databases.

## Review Focus

These are the inputs the spec implies but no happy-path test exercises, most likely to bite first. Each has its test in the owning task.

1. **A reload mid-session, running or paused.** The countdown must resume from the server's timestamps, and a paused block must stay frozen. `elapsed` tests (Task 2), `useFocusSession` and Focus tests with a paused block (Tasks 8, 9), the e2e reload (Task 15).
2. **The same start twice.** React StrictMode runs effects twice in development and a second tab can open `/focus`; either must yield one block and one start. Store idempotency and the one-running rule (Task 4), a StrictMode test (Task 8).
3. **A session left running overnight, or a stale unfinished block from an earlier date.** It is ignored by Today and by `/focus`, is never counted as deep work, and must not stop a new day's block from starting. Store test (Task 4), `planFocus` test (Task 3).
4. **A session that crosses `office_end`, or `/focus` opened outside office hours.** A live block is resumed whichever context it belongs to; starting follows the clock (work in office hours, build outside them). `planFocus` tests (Task 3), Today tests (Task 10).
5. **Blocked with an empty field or a failed write.** An empty or whitespace field, or a next action over 200 characters, is refused with a clear message and nothing is written; a failed finish leaves the session live with the error shown. Schema (Task 1), store refusals that change nothing (Task 5), Focus test (Task 9).

## Decisions carried into this plan

- **Blocks reach the client through `GET /deep-work?from&to`, not through `GET /weeks/:id`.** The spec's route table says the week read includes "planned blocks", but Phase 3 shipped `WeekView` as `{ week, outcomes }` and the spec's own `GET /deep-work?from&to` covers the read. One range query serves the Week screen, the grid and `/plan` step 3.
- **Blocks are persisted lazily.** `defaultBlocksFor(startDate, settings)` proposes a work block on each work day (`deepWorkStart`, `deepWorkMinutes`) and each configured build block. A proposal becomes a row only when it is saved from the grid or when a session starts without one. The spec's signature takes a week; it takes the week's start date here because nothing else of the week is needed.
- **`/focus` starts or resumes, by the clock.** A live block (started, not ended, dated today) is resumed whatever its context. Otherwise the context is work in office hours and build outside them; today's unstarted block of that context is started, or one is created at the current time snapped down to 15 minutes, for the settings' deep-work minutes (build: the day's build block length, else 60), capped at midnight. Opening `/focus` starts a session, as the spec says; the "Start deep work" link is the intent.
- **Starting links the day.** `start` sets the block's Must Ship to the day's Must Ship of the block's context when it has none, and takes that Must Ship's outcome when the block has none, so minutes count toward the outcome.
- **Nothing to focus on is a screen, not a session.** No Must Ship for the context and (for build) no active build outcome: "Nothing to focus on." with a link back. A Must Ship that is no longer `planned` says so and starts nothing.
- **The three exits are Completed, Made progress and Blocked.** The fourth stored result, `abandoned`, is accepted by the API and has no button; Phase 6's Shutdown will use it for a session left running.
- **A blocker files a task even when the block has no Must Ship** (a build session on an outcome): the blocker's what, owner and next action would otherwise be lost. Only `POST /deep-work/:id/finish` files the waiting task in this phase. `PATCH /must-ships/:id` to `blocked` does not; Phase 6's Shutdown decides whether it should.
- **Today's `grade` card** (the block ended and the Must Ship is still `planned`) offers "Mark shipped" and "Start another session". The spec's "Shipped / Progress / Blocked" collapses: Progress is the state the card is already in, and Blocked is reached from a session.
- **The grid has no drag and no click-to-place.** A block is clicked to assign it to an outcome or to change its start and length (any minute: the defaults are 08:35 for 90 minutes and 50-minute build blocks, and a `step` on either field would make a browser refuse to save them); "Add a block" per day creates an extra one. The spec's "drag onto an outcome" is left out: click covers assignment and needs no drag library.
- **`/plan` step 3 flags, it does not block.** Outcomes with no block are listed as "No time yet"; the button is always enabled. A hard stop would trap a plan the owner has decided to leave loose.
- **The five-minute notice** fires once per day on a work day while a tab is open, from the app shell, when permission is granted; permission is requested once, from Today, and the answer is remembered in `localStorage`. No service worker (spec D "Not built").
- **`f` opens focus** when today has a work or build Must Ship (spec C "Keyboard").
- **Deferred:** a shutdown that abandons a live block, Blocked from Today's card, and rolling/killing blocks (Phase 6); accessibility polish on the grid buttons and drag (Phase 7); `deep_work_blocks` deletion (never: history feeds the scoreboard).
- **The new e2e spec is `e2e/work-session.spec.ts`.** It runs against the real clock (block timestamps come from the server) and sorts after `week.spec.ts`, whose outcomes it reuses.

---

## File Structure

**Shared (`src/shared/exec/`)**
- `deepWorkSchemas.ts` (new): create, patch, query, finish and finish-result schemas (Task 1).
- `deepWork.ts` (new): `elapsed`, `countdownLabel`, `defaultBlocksFor`, grid helpers, `minutesByOutcome` (Task 2).
- `focus.ts` (new): `planFocus`, `newBlockFor` (Task 3).
- `notice.ts` (new): `noticeDue` (Task 11).

**Server (`server/exec/`)**
- `rows.ts`: `ExecTable` gains `'deep_work_blocks'` (Task 4).
- `deepWork/store.ts` (new, Task 4), `deepWork/finish.ts` (new, Task 5), `routes/deepWork.ts` (new, Task 6); `router.ts` mounts `/deep-work` (Task 6).

**Client (`src/`)**
- `api/keys.ts`, `api/deepWork.ts` (new), `test/fixtures.ts` (Task 7).
- `components/focus/useFocusSession.ts` (Task 8); `components/focus/FocusTimer.tsx`, `BlockerForm.tsx`, `FocusSession.tsx`; `screens/Focus.tsx` (Task 9).
- `shared/exec/today.ts`, `components/today/PrimaryCard.tsx`, `BuildCard.tsx`, `MustShipCard.tsx` (Task 10).
- `lib/useFocusKey.ts`, `components/FocusShortcut.tsx`, `lib/useDeepWorkNotice.ts`, `components/today/NoticePrompt.tsx`, `app/Shell.tsx`, `screens/Today.tsx` (Task 11).
- `components/week/WeekGrid.tsx`, `BlockPanel.tsx`, `WeekDeepWork.tsx` (Task 12).
- `screens/Week.tsx`, `components/week/WeekSlots.tsx`, `components/outcomes/OutcomeCard.tsx` (Task 13).
- `components/plan/PlanTime.tsx`, `screens/Plan.tsx` (Task 14).

**E2E:** `e2e/work-session.spec.ts` (new), `e2e/week.spec.ts` (the plan journey gains step 3, Task 14). README section (Task 15).

---

### Task 1: Deep-work schemas

**Files:**
- Create: `src/shared/exec/deepWorkSchemas.ts`
- Test: `src/shared/exec/deepWorkSchemas.test.ts`

**Interfaces:**
- Consumes: `calendarDateSchema`, `contextSchema`, `fields` (`{ uuid, hhmm, longText, … }`), `taskSchema` from `schemas.ts`; `BLOCK_RESULTS`, `deepWorkBlockSchema`, `mustShipSchema` from `todaySchemas.ts`; `addDays` from `dates.ts`.
- Produces, all exported from `src/shared/exec/deepWorkSchemas.ts`:
  - `deepWorkCreateSchema` / `type DeepWorkCreate` (output) / `type DeepWorkInput` (`z.input`): `{ date, context, plannedStart, plannedMinutes, outcomeId: string | null = null, mustShipId: string | null = null }`
  - `deepWorkPatchSchema` / `type DeepWorkPatch`: any of `plannedStart`, `plannedMinutes`, `outcomeId`, `mustShipId`; at least one
  - `deepWorkQuerySchema` / `type DeepWorkQuery`: `{ from, to }`, from ≤ to, at most 62 days apart
  - `blockerSchema` / `type Blocker`: `{ what, owner, nextAction }`
  - `deepWorkFinishSchema` / `type DeepWorkFinish` (output) / `type DeepWorkFinishInput` (`z.input`): `{ result, notes = '', blocker? }`; `blocked` requires the blocker and nothing else may carry one
  - `finishResultSchema` / `type FinishResult`: `{ block, mustShip: MustShip | null, task: Task | null }`

- [ ] **Step 1: Write the failing test**

Create `src/shared/exec/deepWorkSchemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deepWorkCreateSchema, deepWorkFinishSchema, deepWorkPatchSchema, deepWorkQuerySchema } from './deepWorkSchemas';

const BASE = { date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 };
const BLOCKER = { what: 'Supplier has not replied', owner: 'Bilal', nextAction: 'Call Bilal about the tracker' };

describe('deepWorkCreateSchema', () => {
  it('fills the links with null', () => {
    expect(deepWorkCreateSchema.parse(BASE)).toEqual({ ...BASE, outcomeId: null, mustShipId: null });
  });

  it('bounds the length, the start and the context', () => {
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedMinutes: 14 }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedMinutes: 601 }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedMinutes: 90.5 }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedStart: '8:35' }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedStart: '24:00' }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, context: 'home' }).success).toBe(false);
  });

  it('never lets a client write timestamps or a result', () => {
    expect(deepWorkCreateSchema.safeParse({ ...BASE, startedAt: '2026-09-29T03:35:00.000Z' }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, result: 'completed' }).success).toBe(false);
  });
});

describe('deepWorkPatchSchema', () => {
  it('takes only the planning fields, and at least one', () => {
    expect(deepWorkPatchSchema.parse({ plannedMinutes: 60 })).toEqual({ plannedMinutes: 60 });
    expect(deepWorkPatchSchema.safeParse({}).success).toBe(false);
    expect(deepWorkPatchSchema.safeParse({ date: '2026-09-30' }).success).toBe(false);
    expect(deepWorkPatchSchema.safeParse({ context: 'build' }).success).toBe(false);
    expect(deepWorkPatchSchema.safeParse({ pausedSeconds: 5 }).success).toBe(false);
  });
});

describe('deepWorkQuerySchema', () => {
  it('reads a range and refuses a backwards or oversized one', () => {
    expect(deepWorkQuerySchema.parse({ from: '2026-09-27', to: '2026-10-03' })).toEqual({ from: '2026-09-27', to: '2026-10-03' });
    const backwards = deepWorkQuerySchema.safeParse({ from: '2026-10-03', to: '2026-09-27' });
    expect(backwards.success).toBe(false);
    expect(backwards.error?.issues[0]).toMatchObject({ path: ['to'], message: 'from must not be after to' });
    expect(deepWorkQuerySchema.safeParse({ from: '2026-01-01', to: '2026-03-05' }).error?.issues[0]).toMatchObject({ message: 'at most 62 days at a time' });
    expect(deepWorkQuerySchema.safeParse({ from: '2026-01-01' }).success).toBe(false);
  });
});

describe('deepWorkFinishSchema', () => {
  it('takes the three plain results without a blocker, with empty notes by default', () => {
    for (const result of ['completed', 'progress', 'abandoned']) {
      expect(deepWorkFinishSchema.parse({ result })).toEqual({ result, notes: '' });
    }
  });

  it('needs the whole blocker to be blocked, trims it, and refuses a blocker on any other result', () => {
    expect(deepWorkFinishSchema.parse({ result: 'blocked', blocker: { what: ' Supplier silent ', owner: ' Bilal ', nextAction: ' Call them ' } })).toEqual({
      result: 'blocked',
      notes: '',
      blocker: { what: 'Supplier silent', owner: 'Bilal', nextAction: 'Call them' },
    });
    const missing = deepWorkFinishSchema.safeParse({ result: 'blocked' });
    expect(missing.error?.issues[0]).toMatchObject({ path: ['blocker'], message: 'a blocked session needs what blocks it, who owns it and the next action' });
    expect(deepWorkFinishSchema.safeParse({ result: 'completed', blocker: BLOCKER }).error?.issues[0]).toMatchObject({ message: 'only a blocked session carries a blocker' });
  });

  it('refuses an empty or oversized blocker field', () => {
    expect(deepWorkFinishSchema.safeParse({ result: 'blocked', blocker: { ...BLOCKER, owner: '   ' } }).success).toBe(false);
    expect(deepWorkFinishSchema.safeParse({ result: 'blocked', blocker: { ...BLOCKER, nextAction: 'x'.repeat(201) } }).success).toBe(false);
    expect(deepWorkFinishSchema.safeParse({ result: 'blocked', blocker: { ...BLOCKER, extra: 'no' } }).success).toBe(false);
    expect(deepWorkFinishSchema.safeParse({ result: 'lost' }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/exec/deepWorkSchemas.test.ts`
Expected: FAIL, because `./deepWorkSchemas` cannot be resolved.

- [ ] **Step 3: Write the schemas**

Create `src/shared/exec/deepWorkSchemas.ts`:

```ts
import { z } from 'zod';
import { addDays } from './dates';
import { calendarDateSchema, contextSchema, fields, taskSchema } from './schemas';
import { BLOCK_RESULTS, deepWorkBlockSchema, mustShipSchema } from './todaySchemas';

/** Deep-work blocks (Phase 5). Every body and query of /api/exec/deep-work is parsed by one of these. */

const { uuid, hhmm, longText } = fields;

const plannedMinutes = z.number().int().min(15).max(600);
const MAX_RANGE_DAYS = 62;

/** A planned block. Timestamps, pauses and the result are the server's: a client only plans. */
export const deepWorkCreateSchema = z.strictObject({
  date: calendarDateSchema,
  context: contextSchema,
  plannedStart: hhmm,
  plannedMinutes,
  outcomeId: uuid.nullable().default(null),
  mustShipId: uuid.nullable().default(null),
});
export type DeepWorkCreate = z.infer<typeof deepWorkCreateSchema>;
export type DeepWorkInput = z.input<typeof deepWorkCreateSchema>;

/** The date and context of a block are fixed; only its time and links move, and only before it starts. */
export const deepWorkPatchSchema = z
  .strictObject({
    plannedStart: hhmm.optional(),
    plannedMinutes: plannedMinutes.optional(),
    outcomeId: uuid.nullable().optional(),
    mustShipId: uuid.nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type DeepWorkPatch = z.infer<typeof deepWorkPatchSchema>;

export const deepWorkQuerySchema = z
  .strictObject({ from: calendarDateSchema, to: calendarDateSchema })
  .refine((range) => range.from <= range.to, { message: 'from must not be after to', path: ['to'] })
  .refine((range) => range.to <= addDays(range.from, MAX_RANGE_DAYS), { message: 'at most 62 days at a time', path: ['to'] });
export type DeepWorkQuery = z.infer<typeof deepWorkQuerySchema>;

/** The three answers a blocked session must give (spec C "Deep Work"); the next action becomes a task title. */
export const blockerSchema = z.strictObject({
  what: z.string().trim().min(1, 'required').max(500, 'too long'),
  owner: z.string().trim().min(1, 'required').max(120, 'too long'),
  nextAction: z.string().trim().min(1, 'required').max(200, 'too long'),
});
export type Blocker = z.infer<typeof blockerSchema>;

export const deepWorkFinishSchema = z
  .strictObject({ result: z.enum(BLOCK_RESULTS), notes: longText.default(''), blocker: blockerSchema.optional() })
  .superRefine((body, context) => {
    if (body.result === 'blocked' && !body.blocker) {
      context.addIssue({ code: 'custom', path: ['blocker'], message: 'a blocked session needs what blocks it, who owns it and the next action' });
    }
    if (body.result !== 'blocked' && body.blocker) {
      context.addIssue({ code: 'custom', path: ['blocker'], message: 'only a blocked session carries a blocker' });
    }
  });
export type DeepWorkFinish = z.infer<typeof deepWorkFinishSchema>;
export type DeepWorkFinishInput = z.input<typeof deepWorkFinishSchema>;

/** What finishing returns: the block, the Must Ship it settled, and the waiting task a blocker filed. */
export const finishResultSchema = z.object({
  block: deepWorkBlockSchema,
  mustShip: mustShipSchema.nullable(),
  task: taskSchema.nullable(),
});
export type FinishResult = z.infer<typeof finishResultSchema>;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shared/exec/deepWorkSchemas.test.ts`
Expected: PASS.

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/exec/deepWorkSchemas.ts src/shared/exec/deepWorkSchemas.test.ts
git commit -m "feat: add the deep-work block schemas with the blocker rules"
```

---

### Task 2: The deep-work core

**Files:**
- Create: `src/shared/exec/deepWork.ts`
- Test: `src/shared/exec/deepWork.test.ts`

**Interfaces:**
- Consumes: `addDays` (`dates.ts`); `hhmmToMinutes` (`time.ts`); `type Context`, `Settings` (`schemas.ts`); `type DeepWorkBlock` (`todaySchemas.ts`).
- Produces, all exported from `src/shared/exec/deepWork.ts`:
  - `type Elapsed = { seconds: number; remaining: number; paused: boolean }` and `elapsed(block, now: Date): Elapsed`, where `block` is `Pick<DeepWorkBlock, 'startedAt' | 'endedAt' | 'pausedSeconds' | 'pauseStartedAt' | 'plannedMinutes'>`
  - `countdownLabel(remaining: number): string`, `"90:00"`, or `"+02:10"` past zero
  - `minutesToHhmm(minutes: number): string` and `snapDown(minutes: number, step = 15): number`
  - `type ProposedBlock = { date: string; context: Context; plannedStart: string; plannedMinutes: number }`
  - `defaultBlocksFor(startDate: string, settings: Settings): ProposedBlock[]`, sorted by date then start
  - `withoutPlaced(proposals: ProposedBlock[], blocks: DeepWorkBlock[]): ProposedBlock[]`
  - `weekRange(startDate: string): { from: string; to: string }`
  - `gridRange(blocks: { plannedStart: string; plannedMinutes: number }[]): { start: number; end: number }`, in minutes, at least 06:00–19:00, whole hours
  - `blockBox(plannedStart: string, plannedMinutes: number, range: { start: number; end: number }): { top: number; height: number }`, percentages
  - `minutesByOutcome(blocks: DeepWorkBlock[]): Record<string, { planned: number; done: number }>`

- [ ] **Step 1: Write the failing test**

Create `src/shared/exec/deepWork.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { blockBox, countdownLabel, defaultBlocksFor, elapsed, gridRange, minutesByOutcome, minutesToHhmm, snapDown, weekRange, withoutPlaced } from './deepWork';
import type { Settings } from './schemas';
import type { DeepWorkBlock } from './todaySchemas';

const SETTINGS: Settings = {
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

const timed = (overrides: Partial<Parameters<typeof elapsed>[0]> = {}) => ({
  plannedMinutes: 90,
  startedAt: '2026-09-29T03:35:00.000Z' as string | null,
  endedAt: null as string | null,
  pausedSeconds: 0,
  pauseStartedAt: null as string | null,
  ...overrides,
});

describe('elapsed', () => {
  it('is untouched before the start', () => {
    expect(elapsed(timed({ startedAt: null }), new Date('2026-09-29T03:40:00Z'))).toEqual({ seconds: 0, remaining: 5400, paused: false });
  });

  it('counts down from the planned minutes', () => {
    expect(elapsed(timed(), new Date('2026-09-29T03:40:00Z'))).toEqual({ seconds: 300, remaining: 5100, paused: false });
  });

  it('leaves out pauses already folded in', () => {
    expect(elapsed(timed({ pausedSeconds: 120 }), new Date('2026-09-29T03:45:00Z')).seconds).toBe(480);
  });

  it('freezes while paused, and a reload an hour later says the same', () => {
    const paused = timed({ pauseStartedAt: '2026-09-29T03:45:00.000Z' });
    expect(elapsed(paused, new Date('2026-09-29T03:50:00Z'))).toEqual({ seconds: 600, remaining: 4800, paused: true });
    expect(elapsed(paused, new Date('2026-09-29T04:50:00Z')).seconds).toBe(600);
  });

  it('stops at the end, and ignores a pause left open on a finished block', () => {
    const done = timed({ endedAt: '2026-09-29T04:05:00.000Z', pauseStartedAt: '2026-09-29T04:00:00.000Z' });
    expect(elapsed(done, new Date('2026-09-30T09:00:00Z'))).toEqual({ seconds: 1800, remaining: 3600, paused: false });
  });

  it('counts up quietly past zero', () => {
    expect(elapsed(timed(), new Date('2026-09-29T05:15:00Z'))).toMatchObject({ seconds: 6000, remaining: -600 });
  });

  it('never goes negative when the clock is behind the server', () => {
    expect(elapsed(timed(), new Date('2026-09-29T03:34:00Z'))).toMatchObject({ seconds: 0, remaining: 5400 });
  });
});

describe('countdownLabel, minutesToHhmm and snapDown', () => {
  it('shows minutes and seconds, and a plus past zero', () => {
    expect(countdownLabel(5400)).toBe('90:00');
    expect(countdownLabel(65)).toBe('01:05');
    expect(countdownLabel(0)).toBe('00:00');
    expect(countdownLabel(-130)).toBe('+02:10');
  });

  it('formats and snaps minutes of the day', () => {
    expect(minutesToHhmm(515)).toBe('08:35');
    expect(minutesToHhmm(0)).toBe('00:00');
    expect(snapDown(515)).toBe(510);
    expect(snapDown(510)).toBe(510);
    expect(snapDown(1439)).toBe(1425);
  });
});

describe('defaultBlocksFor', () => {
  it('places a work block each work day and the build blocks on their weekdays', () => {
    const list = defaultBlocksFor('2026-09-27', SETTINGS).map((block) => `${block.date} ${block.context} ${block.plannedStart} ${block.plannedMinutes}`);
    expect(list).toEqual([
      '2026-09-28 work 08:35 90',
      '2026-09-29 build 06:30 50',
      '2026-09-29 work 08:35 90',
      '2026-09-30 work 08:35 90',
      '2026-10-01 build 06:30 50',
      '2026-10-01 work 08:35 90',
      '2026-10-02 work 08:35 90',
      '2026-10-03 build 09:00 180',
    ]);
  });

  it('places nothing for work when there are no work days, and clamps a block at midnight', () => {
    const late = { ...SETTINGS, workDays: [], buildBlocks: [{ weekday: 0, start: '22:00', minutes: 600 }, { weekday: 1, start: '23:50', minutes: 30 }] };
    expect(defaultBlocksFor('2026-09-27', late)).toEqual([{ date: '2026-09-27', context: 'build', plannedStart: '22:00', plannedMinutes: 120 }]);
  });
});

const persisted = (overrides: Partial<DeepWorkBlock>): DeepWorkBlock => ({
  id: '50000000-0000-4000-8000-000000000001', date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null,
  startedAt: null, endedAt: null, pausedSeconds: 0, pauseStartedAt: null, result: null, notes: '', createdAt: '2026-09-27T03:00:00.000Z', updatedAt: '2026-09-27T03:00:00.000Z', ...overrides,
});

describe('withoutPlaced, weekRange and the grid helpers', () => {
  it('drops a proposal a saved block already covers, matching date, context and start', () => {
    const proposals = defaultBlocksFor('2026-09-27', SETTINGS);
    const left = withoutPlaced(proposals, [persisted({}), persisted({ date: '2026-09-29', context: 'build', plannedStart: '06:45' })]);
    expect(left).toHaveLength(proposals.length - 1);
    expect(left.find((block) => block.date === '2026-09-29' && block.context === 'work')).toBeUndefined();
    expect(left.find((block) => block.date === '2026-09-29' && block.context === 'build')).toBeDefined();
  });

  it('spans a planning week', () => {
    expect(weekRange('2026-09-27')).toEqual({ from: '2026-09-27', to: '2026-10-03' });
  });

  it('shows at least 06:00 to 19:00 and widens to whole hours around anything outside', () => {
    expect(gridRange([])).toEqual({ start: 360, end: 1140 });
    expect(gridRange([{ plannedStart: '08:35', plannedMinutes: 90 }])).toEqual({ start: 360, end: 1140 });
    expect(gridRange([{ plannedStart: '05:15', plannedMinutes: 30 }, { plannedStart: '19:30', plannedMinutes: 90 }])).toEqual({ start: 300, end: 1260 });
  });

  it('places a block as percentages of the range', () => {
    const range = { start: 360, end: 1140 };
    const first = blockBox('06:00', 78, range);
    expect(first.top).toBeCloseTo(0);
    expect(first.height).toBeCloseTo(10);
    const second = blockBox('12:30', 390, range);
    expect(second.top).toBeCloseTo(50);
    expect(second.height).toBeCloseTo(50);
  });
});

describe('minutesByOutcome', () => {
  it('adds planned minutes for every linked block and done minutes for finished ones', () => {
    const outcome = '10000000-0000-4000-8000-000000000001';
    const totals = minutesByOutcome([
      persisted({ outcomeId: outcome, plannedMinutes: 90 }),
      persisted({ outcomeId: outcome, plannedMinutes: 60, startedAt: '2026-09-30T03:35:00.000Z', endedAt: '2026-09-30T04:20:00.000Z', pausedSeconds: 300, result: 'progress' }),
      persisted({ outcomeId: null, plannedMinutes: 30 }),
    ]);
    expect(totals).toEqual({ [outcome]: { planned: 150, done: 40 } });
  });
});
```

The done minutes are 45 minutes on the clock minus a 5-minute pause: 40.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/exec/deepWork.test.ts`
Expected: FAIL, because `./deepWork` cannot be resolved.

- [ ] **Step 3: Write the core**

Create `src/shared/exec/deepWork.ts`:

```ts
import { addDays } from './dates';
import { hhmmToMinutes } from './time';
import type { Context, Settings } from './schemas';
import type { DeepWorkBlock } from './todaySchemas';

export type Elapsed = { seconds: number; remaining: number; paused: boolean };
type Timed = Pick<DeepWorkBlock, 'startedAt' | 'endedAt' | 'pausedSeconds' | 'pauseStartedAt' | 'plannedMinutes'>;

const DAY_MINUTES = 24 * 60;
const MIN_BLOCK = 15;

/**
 * How long a block has really run. Derived from the stored timestamps only, so a reload or a second tab agrees:
 * time spent paused (already folded, or still open) is left out, and a finished block stops at its end.
 */
export function elapsed(block: Timed, now: Date): Elapsed {
  const planned = block.plannedMinutes * 60;
  if (block.startedAt === null) return { seconds: 0, remaining: planned, paused: false };
  const end = block.endedAt === null ? now.getTime() : Date.parse(block.endedAt);
  const pausedNow = block.pauseStartedAt !== null && block.endedAt === null;
  const openPause = pausedNow ? Math.max(0, end - Date.parse(block.pauseStartedAt as string)) : 0;
  const seconds = Math.max(0, Math.floor((end - Date.parse(block.startedAt) - openPause) / 1000) - block.pausedSeconds);
  return { seconds, remaining: planned - seconds, paused: pausedNow };
}

const pad = (value: number): string => String(value).padStart(2, '0');

/** "90:00" while time remains, "+02:10" once over (spec C "Deep Work": past zero it counts up quietly). */
export function countdownLabel(remaining: number): string {
  const abs = Math.abs(Math.trunc(remaining));
  const label = `${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  return remaining < 0 ? `+${label}` : label;
}

export const minutesToHhmm = (minutes: number): string => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

export const snapDown = (minutes: number, step = 15): number => minutes - (minutes % step);

export type ProposedBlock = { date: string; context: Context; plannedStart: string; plannedMinutes: number };

const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

/** A proposal that does not fit before midnight is clamped; one with no room for a minimum block is dropped. */
function fit(date: string, context: Context, plannedStart: string, minutes: number): ProposedBlock | null {
  const room = DAY_MINUTES - hhmmToMinutes(plannedStart);
  return room < MIN_BLOCK ? null : { date, context, plannedStart, plannedMinutes: Math.min(minutes, room) };
}

/** The settings' blocks laid over one planning week: a work block each work day and each build block on its weekday. */
export function defaultBlocksFor(startDate: string, settings: Settings): ProposedBlock[] {
  const proposals: ProposedBlock[] = [];
  const add = (block: ProposedBlock | null) => {
    if (block) proposals.push(block);
  };
  for (let offset = 0; offset < 7; offset += 1) {
    const date = addDays(startDate, offset);
    const weekday = weekdayOf(date);
    if (settings.workDays.includes(weekday)) add(fit(date, 'work', settings.deepWorkStart, settings.deepWorkMinutes));
    for (const block of settings.buildBlocks) {
      if (block.weekday === weekday) add(fit(date, 'build', block.start, block.minutes));
    }
  }
  return proposals.sort((a, b) => a.date.localeCompare(b.date) || a.plannedStart.localeCompare(b.plannedStart));
}

/** Proposals not yet saved: none of the blocks shares the proposal's date, context and start. */
export function withoutPlaced(proposals: ProposedBlock[], blocks: DeepWorkBlock[]): ProposedBlock[] {
  return proposals.filter(
    (proposal) => !blocks.some((block) => block.date === proposal.date && block.context === proposal.context && block.plannedStart === proposal.plannedStart)
  );
}

export const weekRange = (startDate: string): { from: string; to: string } => ({ from: startDate, to: addDays(startDate, 6) });

type Placed = { plannedStart: string; plannedMinutes: number };

/** The hours the grid draws: 06:00 to 19:00, widened to whole hours when a block falls outside them. */
export function gridRange(blocks: Placed[]): { start: number; end: number } {
  const starts = blocks.map((block) => hhmmToMinutes(block.plannedStart));
  const ends = blocks.map((block) => hhmmToMinutes(block.plannedStart) + block.plannedMinutes);
  return {
    start: Math.min(6 * 60, ...starts.map((value) => Math.floor(value / 60) * 60)),
    end: Math.max(19 * 60, ...ends.map((value) => Math.ceil(value / 60) * 60)),
  };
}

/** Where a block sits in a day column, as percentages of the drawn range. */
export function blockBox(plannedStart: string, plannedMinutes: number, range: { start: number; end: number }): { top: number; height: number } {
  const span = range.end - range.start;
  return { top: ((hhmmToMinutes(plannedStart) - range.start) / span) * 100, height: (plannedMinutes / span) * 100 };
}

/** Planned minutes for every block linked to an outcome, and the minutes actually worked in its finished blocks. */
export function minutesByOutcome(blocks: DeepWorkBlock[]): Record<string, { planned: number; done: number }> {
  const totals: Record<string, { planned: number; done: number }> = {};
  for (const block of blocks) {
    if (block.outcomeId === null) continue;
    const done = block.endedAt === null ? 0 : Math.round(elapsed(block, new Date(block.endedAt)).seconds / 60);
    const current = totals[block.outcomeId] ?? { planned: 0, done: 0 };
    totals[block.outcomeId] = { planned: current.planned + block.plannedMinutes, done: current.done + done };
  }
  return totals;
}
```

`23:50` has 10 minutes of room, so its proposal is dropped; `22:00` for 600 minutes is clamped to 120.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shared/exec/deepWork.test.ts`
Expected: PASS.

Run: `npm run lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/exec/deepWork.ts src/shared/exec/deepWork.test.ts
git commit -m "feat: derive the deep-work timer and lay the default blocks over a week"
```

---

### Task 3: What /focus does

**Files:**
- Create: `src/shared/exec/focus.ts`
- Test: `src/shared/exec/focus.test.ts`

**Interfaces:**
- Consumes: `defaultContext`, `localClock` (`time.ts`); `contextOf` (`week.ts`); `minutesToHhmm`, `snapDown` (Task 2); `type Context`, `Outcome`, `Settings` (`schemas.ts`); `type DayView`, `DeepWorkBlock`, `MustShip`, `MustShipStatus` (`todaySchemas.ts`); `type DeepWorkInput` (`deepWorkSchemas.ts`).
- Produces, all exported from `src/shared/exec/focus.ts`:
  - `type FocusSubject = { title: string; definitionOfDone: string; notes: string }`
  - `type FocusPlan = { kind: 'live'; block: DeepWorkBlock; subject: FocusSubject } | { kind: 'start'; context: Context; block: DeepWorkBlock | null; subject: FocusSubject } | { kind: 'closed'; title: string; status: MustShipStatus } | { kind: 'nothing' }`
  - `planFocus(now: Date, settings: Settings, view: DayView): FocusPlan`
  - `newBlockFor(now: Date, settings: Settings, context: Context, date: string): DeepWorkInput`

- [ ] **Step 1: Write the failing test**

Create `src/shared/exec/focus.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { newBlockFor, planFocus } from './focus';
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
const STAMP = '2026-09-29T03:00:00.000Z';
const MS_ID = '40000000-0000-4000-8000-000000000001';
const BUILD_MS_ID = '40000000-0000-4000-8000-000000000002';
const OUTCOME_ID = '10000000-0000-4000-8000-000000000001';

/** Karachi is UTC+5: a local HH:MM on 2026-09-29 (a Tuesday) as a Date. */
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const utc = h * 60 + m - 300;
  return new Date(`2026-09-29T${String(Math.floor(utc / 60)).padStart(2, '0')}:${String(utc % 60).padStart(2, '0')}:00Z`);
};

const mustShip = (overrides: Partial<MustShip> = {}): MustShip => ({
  id: MS_ID, title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20', context: 'work', date: '2026-09-29', outcomeId: null, projectId: null, status: 'planned',
  blockerWhat: null, blockerOwner: null, blockerNextAction: null, notes: 'Use the March template', rolledFromId: null, rollCount: 0, closedAt: null, createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const block = (overrides: Partial<DeepWorkBlock> = {}): DeepWorkBlock => ({
  id: '50000000-0000-4000-8000-000000000001', date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null,
  startedAt: null, endedAt: null, pausedSeconds: 0, pauseStartedAt: null, result: null, notes: '', createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const outcome = (overrides: Partial<Outcome> = {}): Outcome => ({
  id: OUTCOME_ID, weekId: '20000000-0000-4000-8000-000000000001', slot: 1, title: 'Healify beta live', description: '', category: 'business', definitionOfDone: 'Ten users on it',
  targetDate: null, projectId: null, progress: 0, status: 'active', reviewGrade: null, reviewReason: null, reviewDisposition: null, rolledFromId: null, notes: 'Start with onboarding',
  closedAt: null, createdAt: STAMP, updatedAt: STAMP, ...overrides,
});
const view = (overrides: Partial<DayView> = {}, outcomes: Outcome[] = []): DayView => ({
  date: '2026-09-29', day: null, hasHistory: true, mustShip: null, buildMustShip: null, secondaries: [], waiting: [], blocks: [], inboxCount: 0,
  week: { week: { id: '20000000-0000-4000-8000-000000000001', startDate: '2026-09-27', reviewedAt: null, reviewNotes: '', createdAt: STAMP, updatedAt: STAMP }, outcomes }, ...overrides,
});

describe('planFocus', () => {
  it('resumes the live block whatever the hour or context, with its Must Ship as the subject', () => {
    const live = block({ context: 'work', mustShipId: MS_ID, startedAt: '2026-09-29T03:40:00.000Z' });
    const plan = planFocus(at('20:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [live] }));
    expect(plan).toEqual({ kind: 'live', block: live, subject: { title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20', notes: 'Use the March template' } });
  });

  it('falls back to the linked outcome, then to a plain title, for a live block with no Must Ship', () => {
    const linked = block({ context: 'build', outcomeId: OUTCOME_ID, startedAt: '2026-09-29T01:40:00.000Z' });
    expect(planFocus(at('07:00'), SETTINGS, view({ blocks: [linked] }, [outcome()]))).toMatchObject({ kind: 'live', subject: { title: 'Healify beta live', definitionOfDone: 'Ten users on it' } });
    const bare = block({ startedAt: '2026-09-29T03:40:00.000Z' });
    expect(planFocus(at('09:00'), SETTINGS, view({ blocks: [bare] }))).toMatchObject({ kind: 'live', subject: { title: 'Deep work', definitionOfDone: '', notes: '' } });
  });

  it('ignores a finished block and starts the work Must Ship in office hours, creating a block when none is planned', () => {
    const done = block({ startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T03:50:00.000Z' });
    expect(planFocus(at('09:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [done] }))).toMatchObject({ kind: 'start', context: 'work', block: null, subject: { title: 'Delivery tracker sent' } });
  });

  it('starts the earliest unstarted block of the moment\'s context', () => {
    const later = block({ id: '50000000-0000-4000-8000-000000000003', plannedStart: '14:00' });
    const early = block({ id: '50000000-0000-4000-8000-000000000002', plannedStart: '08:35' });
    const other = block({ id: '50000000-0000-4000-8000-000000000004', context: 'build', plannedStart: '06:30' });
    expect(planFocus(at('09:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [other, early, later] }))).toMatchObject({ kind: 'start', block: { id: early.id } });
  });

  it('starts nothing for a Must Ship that is no longer planned, and nothing without one in office hours', () => {
    expect(planFocus(at('09:00'), SETTINGS, view({ mustShip: mustShip({ status: 'shipped' }) }))).toEqual({ kind: 'closed', title: 'Delivery tracker sent', status: 'shipped' });
    expect(planFocus(at('09:00'), SETTINGS, view({ buildMustShip: null }))).toEqual({ kind: 'nothing' });
  });

  it('follows the clock: build outside office hours, on the build Must Ship or the block\'s outcome', () => {
    const build = mustShip({ id: BUILD_MS_ID, context: 'build', title: 'Landing page live' });
    expect(planFocus(at('07:00'), SETTINGS, view({ mustShip: mustShip(), buildMustShip: build }))).toMatchObject({ kind: 'start', context: 'build', subject: { title: 'Landing page live' } });
    const planned = block({ context: 'build', outcomeId: OUTCOME_ID, plannedStart: '06:30' });
    const other = outcome({ id: '10000000-0000-4000-8000-000000000002', title: 'Pinkbox P&L live', slot: 2 });
    expect(planFocus(at('07:00'), SETTINGS, view({ blocks: [planned] }, [other, outcome()]))).toMatchObject({ kind: 'start', subject: { title: 'Healify beta live', notes: 'Start with onboarding' } });
    expect(planFocus(at('07:00'), SETTINGS, view({}, [other, outcome()]))).toMatchObject({ kind: 'start', subject: { title: 'Pinkbox P&L live' } });
  });

  it('says there is nothing when no build Must Ship or active build outcome exists, and never uses an office outcome for build', () => {
    expect(planFocus(at('07:00'), SETTINGS, view())).toEqual({ kind: 'nothing' });
    expect(planFocus(at('07:00'), SETTINGS, view({}, [outcome({ category: 'office' }), outcome({ slot: null, status: 'killed' })]))).toEqual({ kind: 'nothing' });
  });
});

describe('newBlockFor', () => {
  it('starts now, snapped down to 15 minutes, for the deep-work length', () => {
    expect(newBlockFor(at('09:07'), SETTINGS, 'work', '2026-09-29')).toEqual({ date: '2026-09-29', context: 'work', plannedStart: '09:00', plannedMinutes: 90, outcomeId: null, mustShipId: null });
  });

  it('uses the day\'s build block length, else an hour', () => {
    expect(newBlockFor(at('07:00'), SETTINGS, 'build', '2026-09-29').plannedMinutes).toBe(50);
    expect(newBlockFor(at('07:00'), { ...SETTINGS, buildBlocks: [] }, 'build', '2026-09-29').plannedMinutes).toBe(60);
  });

  it('never runs past midnight and never drops under 15 minutes', () => {
    expect(newBlockFor(at('23:50'), SETTINGS, 'work', '2026-09-29')).toMatchObject({ plannedStart: '23:45', plannedMinutes: 15 });
    expect(newBlockFor(at('22:10'), SETTINGS, 'work', '2026-09-29')).toMatchObject({ plannedStart: '22:00', plannedMinutes: 90 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/exec/focus.test.ts`
Expected: FAIL, because `./focus` cannot be resolved.

- [ ] **Step 3: Write the plan**

Create `src/shared/exec/focus.ts`:

```ts
import { defaultContext, localClock } from './time';
import { contextOf } from './week';
import { minutesToHhmm, snapDown } from './deepWork';
import type { DeepWorkInput } from './deepWorkSchemas';
import type { Context, Outcome, Settings } from './schemas';
import type { DayView, DeepWorkBlock, MustShip, MustShipStatus } from './todaySchemas';

export type FocusSubject = { title: string; definitionOfDone: string; notes: string };
export type FocusPlan =
  | { kind: 'live'; block: DeepWorkBlock; subject: FocusSubject }
  | { kind: 'start'; context: Context; block: DeepWorkBlock | null; subject: FocusSubject }
  | { kind: 'closed'; title: string; status: MustShipStatus }
  | { kind: 'nothing' };

const ofMustShip = (mustShip: MustShip): FocusSubject => ({ title: mustShip.title, definitionOfDone: mustShip.definitionOfDone, notes: mustShip.notes });
const ofOutcome = (outcome: Outcome): FocusSubject => ({ title: outcome.title, definitionOfDone: outcome.definitionOfDone, notes: outcome.notes });
const PLAIN: FocusSubject = { title: 'Deep work', definitionOfDone: '', notes: '' };

/**
 * What opening /focus does (spec C "Deep Work"): resume the live block, or start today's block for the
 * moment's context, or say there is nothing to do. A live block is resumed whatever its context, so a
 * session that runs past office hours is never lost.
 */
export function planFocus(now: Date, settings: Settings, view: DayView): FocusPlan {
  const outcomes = view.week?.outcomes ?? [];
  const live = view.blocks.find((block) => block.startedAt !== null && block.endedAt === null);
  if (live) {
    const mustShip = [view.mustShip, view.buildMustShip].find((candidate) => candidate !== null && candidate.id === live.mustShipId) ?? null;
    const outcome = outcomes.find((candidate) => candidate.id === live.outcomeId) ?? null;
    return { kind: 'live', block: live, subject: mustShip ? ofMustShip(mustShip) : outcome ? ofOutcome(outcome) : PLAIN };
  }
  const context = defaultContext(now, settings);
  const mustShip = context === 'work' ? view.mustShip : view.buildMustShip;
  const block = view.blocks.find((candidate) => candidate.context === context && candidate.startedAt === null) ?? null;
  if (mustShip) {
    return mustShip.status === 'planned'
      ? { kind: 'start', context, block, subject: ofMustShip(mustShip) }
      : { kind: 'closed', title: mustShip.title, status: mustShip.status };
  }
  if (context === 'build') {
    const active = outcomes.filter((outcome) => outcome.slot !== null && outcome.status === 'active' && contextOf(outcome.category) === 'build');
    const outcome = active.find((candidate) => candidate.id === block?.outcomeId) ?? active[0];
    if (outcome) return { kind: 'start', context, block, subject: ofOutcome(outcome) };
  }
  return { kind: 'nothing' };
}

/** A block for a session that starts without a planned one: now snapped down to 15 minutes, capped at midnight. */
export function newBlockFor(now: Date, settings: Settings, context: Context, date: string): DeepWorkInput {
  const clock = localClock(now, settings.timezone);
  const start = snapDown(clock.minutes);
  const buildBlock = settings.buildBlocks.find((block) => block.weekday === clock.weekday);
  const wanted = context === 'work' ? settings.deepWorkMinutes : buildBlock?.minutes ?? 60;
  return { date, context, plannedStart: minutesToHhmm(start), plannedMinutes: Math.max(15, Math.min(wanted, 24 * 60 - start)), outcomeId: null, mustShipId: null };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/shared/exec/focus.test.ts`
Expected: PASS.

Run: `npx vitest run src/shared/exec && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/exec/focus.ts src/shared/exec/focus.test.ts
git commit -m "feat: decide what /focus does: resume, start or say there is nothing to do"
```

---

### Task 4: The block data module

**Files:**
- Create: `server/exec/deepWork/store.ts`
- Modify: `server/exec/rows.ts` (`ExecTable` gains `'deep_work_blocks'`)
- Test: `server/exec/__tests__/deep-work-store.test.ts`

**Interfaces:**
- Consumes: `toEntity`, `insertRow`, `updateRow`, `type ExecTable` (`rows.ts`); `ApiError` (`http.ts`); `getOutcome` (`outcomes/store.ts`); `getWeek` (`weeks/store.ts`); `getMustShip` (`mustShips/store.ts`); `addDays` (`dates.ts`); `hhmmToMinutes` (`time.ts`); `contextOf` (`week.ts`); `type DeepWorkBlock`, `MustShip` (`todaySchemas.ts`); `type DeepWorkCreate`, `DeepWorkPatch`, `DeepWorkQuery` (Task 1). The tests also use `prepareExecDb`, `ensureWeek`, `addOutcome`, `createMustShip`.
- Produces, all exported from `server/exec/deepWork/store.ts`:
  - `invalid(message: string): ApiError`, a `400 VALIDATION` refusal (Task 5 reuses it)
  - `getBlock(db, id): DeepWorkBlock | null`
  - `listBlocks(db, query: DeepWorkQuery): DeepWorkBlock[]`, dates inclusive, ordered by date then start
  - `createBlock(db, input: DeepWorkCreate, now): DeepWorkBlock`
  - `patchBlock(db, id, patch: DeepWorkPatch, now): DeepWorkBlock | null`
  - `startBlock(db, id, now): DeepWorkBlock | null`, idempotent while running
  - `pauseBlock(db, id, now)` and `resumeBlock(db, id, now)`, each `DeepWorkBlock | null`, idempotent
  - `pauseFold(block, now): { pausedSeconds: number; pauseStartedAt: null }`, which Task 5 reuses when a paused block finishes

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/deep-work-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { createMustShip } from '../mustShips/store';
import { createBlock, getBlock, listBlocks, patchBlock, pauseBlock, resumeBlock, startBlock } from '../deepWork/store';
import { ApiError } from '../http';
import type { DeepWorkCreate } from '../../../src/shared/exec/deepWorkSchemas';

const T0 = '2026-09-29T03:00:00.000Z';
const T1 = '2026-09-29T03:35:00.000Z';
const T2 = '2026-09-29T03:45:00.000Z';
const T3 = '2026-09-29T03:50:00.000Z';
const MISSING = '50000000-0000-4000-8000-000000000999';
let db: Database.Database;
let weekId: string;

const plan = (overrides: Partial<DeepWorkCreate> = {}): DeepWorkCreate => ({
  date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null, ...overrides,
});
const outcome = (category: 'office' | 'business', title = 'Supplier plan confirmed') =>
  addOutcome(db, weekId, { title, category, description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, T0);
const mustShip = (context: 'work' | 'build' = 'work', date = '2026-09-29') =>
  createMustShip(db, { title: 'Delivery tracker sent', context, date, definitionOfDone: '', outcomeId: null, projectId: null, notes: '' }, T0);

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
  weekId = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
});

describe('createBlock', () => {
  it('plans an unstarted block with server-set fields', () => {
    const made = createBlock(db, plan(), T0);
    expect(made).toMatchObject({ date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null, startedAt: null, endedAt: null, pausedSeconds: 0, pauseStartedAt: null, result: null, notes: '', createdAt: T0 });
    expect(getBlock(db, made.id)).toEqual(made);
  });

  it('links an active outcome of the week and context, and a Must Ship of the day and context', () => {
    const linked = outcome('office');
    const ship = mustShip();
    const made = createBlock(db, plan({ outcomeId: linked.id, mustShipId: ship.id }), T0);
    expect(made).toMatchObject({ outcomeId: linked.id, mustShipId: ship.id });
  });

  it('refuses a block that overlaps an unfinished one, but not one that only touches it, or a finished one', () => {
    const first = createBlock(db, plan(), T0);
    expect(refusal(() => createBlock(db, plan({ plannedStart: '09:30', plannedMinutes: 30 }), T0))).toMatchObject({ status: 400, code: 'VALIDATION', message: 'that time overlaps another block' });
    expect(createBlock(db, plan({ plannedStart: '10:05', plannedMinutes: 30 }), T0).plannedStart).toBe('10:05');
    db.prepare("UPDATE deep_work_blocks SET started_at = ?, ended_at = ?, result = 'progress' WHERE id = ?").run(T1, T2, first.id);
    expect(createBlock(db, plan({ plannedStart: '08:45', plannedMinutes: 15 }), T0).plannedStart).toBe('08:45');
  });

  it('refuses a block that would run past midnight', () => {
    expect(refusal(() => createBlock(db, plan({ plannedStart: '23:00', plannedMinutes: 90 }), T0))).toMatchObject({ message: 'a block must end by midnight' });
    expect(createBlock(db, plan({ plannedStart: '22:30', plannedMinutes: 90 }), T0).plannedStart).toBe('22:30');
  });

  it('refuses an outcome that is unknown, killed, from another week, or of the other context', () => {
    expect(refusal(() => createBlock(db, plan({ outcomeId: MISSING }), T0))).toMatchObject({ message: 'no such outcome' });
    const killed = outcome('office', 'Killed one');
    db.prepare("UPDATE outcomes SET status = 'killed', slot = NULL WHERE id = ?").run(killed.id);
    expect(refusal(() => createBlock(db, plan({ outcomeId: killed.id }), T0))).toMatchObject({ message: 'that outcome is not active this week' });
    const office = outcome('office');
    expect(refusal(() => createBlock(db, plan({ date: '2026-10-06', outcomeId: office.id }), T0))).toMatchObject({ message: 'that outcome belongs to another week' });
    const business = outcome('business', 'Healify beta live');
    expect(refusal(() => createBlock(db, plan({ outcomeId: business.id }), T0))).toMatchObject({ message: 'that outcome belongs to the other context' });
    expect(createBlock(db, plan({ context: 'build', outcomeId: business.id }), T0).outcomeId).toBe(business.id);
  });

  it('refuses a Must Ship that is unknown or belongs to another day or context', () => {
    expect(refusal(() => createBlock(db, plan({ mustShipId: MISSING }), T0))).toMatchObject({ message: 'no such must ship' });
    const otherDay = mustShip('work', '2026-09-30');
    expect(refusal(() => createBlock(db, plan({ mustShipId: otherDay.id }), T0))).toMatchObject({ message: 'that must ship is for another day or context' });
    const build = mustShip('build');
    expect(refusal(() => createBlock(db, plan({ mustShipId: build.id }), T0))).toMatchObject({ message: 'that must ship is for another day or context' });
  });
});

describe('listBlocks', () => {
  it('lists a date range inclusively, by date then start', () => {
    createBlock(db, plan({ date: '2026-09-30' }), T0);
    createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    createBlock(db, plan(), T0);
    createBlock(db, plan({ date: '2026-10-05' }), T0);
    expect(listBlocks(db, { from: '2026-09-29', to: '2026-09-30' }).map((block) => `${block.date} ${block.plannedStart}`)).toEqual([
      '2026-09-29 08:35',
      '2026-09-29 14:00',
      '2026-09-30 08:35',
    ]);
  });
});

describe('patchBlock', () => {
  it('assigns an outcome and moves the time before the block starts', () => {
    const made = createBlock(db, plan(), T0);
    const linked = outcome('office');
    const patched = patchBlock(db, made.id, { outcomeId: linked.id, plannedStart: '09:00', plannedMinutes: 60 }, T1);
    expect(patched).toMatchObject({ outcomeId: linked.id, plannedStart: '09:00', plannedMinutes: 60, updatedAt: T1 });
    expect(patchBlock(db, made.id, { outcomeId: null }, T1)?.outcomeId).toBeNull();
  });

  it('checks the new time against the other blocks but not against itself', () => {
    const first = createBlock(db, plan(), T0);
    createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    expect(patchBlock(db, first.id, { plannedMinutes: 120 }, T1)?.plannedMinutes).toBe(120);
    expect(refusal(() => patchBlock(db, first.id, { plannedMinutes: 400 }, T1))).toMatchObject({ message: 'that time overlaps another block' });
    expect(getBlock(db, first.id)?.plannedMinutes).toBe(120);
  });

  it('refuses a started block and answers null for an unknown one', () => {
    const made = createBlock(db, plan(), T0);
    startBlock(db, made.id, T1);
    expect(refusal(() => patchBlock(db, made.id, { plannedMinutes: 30 }, T2))).toMatchObject({ message: 'a started block cannot be changed' });
    expect(patchBlock(db, MISSING, { plannedMinutes: 30 }, T2)).toBeNull();
  });
});

describe('startBlock', () => {
  it('starts once, and a second start changes nothing', () => {
    const made = createBlock(db, plan(), T0);
    expect(startBlock(db, made.id, T1)).toMatchObject({ startedAt: T1 });
    expect(startBlock(db, made.id, T2)?.startedAt).toBe(T1);
  });

  it('takes the day\'s Must Ship of the block\'s context, and its outcome when the block has none', () => {
    const linked = outcome('office');
    const ship = createMustShip(db, { title: 'Delivery tracker sent', context: 'work', date: '2026-09-29', definitionOfDone: '', outcomeId: linked.id, projectId: null, notes: '' }, T0);
    mustShip('build');
    const made = createBlock(db, plan(), T0);
    expect(startBlock(db, made.id, T1)).toMatchObject({ mustShipId: ship.id, outcomeId: linked.id });
  });

  it('keeps an outcome the block already has, and starts fine with no Must Ship at all', () => {
    const planned = outcome('office', 'Planned outcome');
    const made = createBlock(db, plan({ outcomeId: planned.id }), T0);
    expect(startBlock(db, made.id, T1)).toMatchObject({ outcomeId: planned.id, mustShipId: null });
  });

  it('refuses a second running block on the day, but ignores one left running on an earlier date', () => {
    const stale = createBlock(db, plan({ date: '2026-09-28' }), T0);
    startBlock(db, stale.id, '2026-09-28T03:35:00.000Z');
    const first = createBlock(db, plan(), T0);
    const second = createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    expect(startBlock(db, first.id, T1)).toMatchObject({ startedAt: T1 });
    expect(refusal(() => startBlock(db, second.id, T2))).toMatchObject({ status: 400, message: 'another block is already running' });
    expect(getBlock(db, second.id)?.startedAt).toBeNull();
  });

  it('refuses a finished block and answers null for an unknown one', () => {
    const made = createBlock(db, plan(), T0);
    db.prepare("UPDATE deep_work_blocks SET started_at = ?, ended_at = ?, result = 'progress' WHERE id = ?").run(T1, T2, made.id);
    expect(refusal(() => startBlock(db, made.id, T3))).toMatchObject({ message: 'that block has already finished' });
    expect(startBlock(db, MISSING, T3)).toBeNull();
  });
});

describe('pauseBlock and resumeBlock', () => {
  it('pauses, and pausing again changes nothing', () => {
    const made = createBlock(db, plan(), T0);
    startBlock(db, made.id, T1);
    expect(pauseBlock(db, made.id, T2)).toMatchObject({ pauseStartedAt: T2, pausedSeconds: 0 });
    expect(pauseBlock(db, made.id, T3)?.pauseStartedAt).toBe(T2);
  });

  it('folds the paused time into paused_seconds on resume, and resuming again changes nothing', () => {
    const made = createBlock(db, plan(), T0);
    startBlock(db, made.id, T1);
    pauseBlock(db, made.id, T2);
    expect(resumeBlock(db, made.id, T3)).toMatchObject({ pauseStartedAt: null, pausedSeconds: 300 });
    expect(resumeBlock(db, made.id, '2026-09-29T04:30:00.000Z')?.pausedSeconds).toBe(300);
  });

  it('refuses to pause a block that is not running, and answers null for an unknown one', () => {
    const made = createBlock(db, plan(), T0);
    expect(refusal(() => pauseBlock(db, made.id, T2))).toMatchObject({ message: 'that block is not running' });
    expect(pauseBlock(db, MISSING, T2)).toBeNull();
    expect(resumeBlock(db, MISSING, T2)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/deep-work-store.test.ts`
Expected: FAIL, because `../deepWork/store` cannot be resolved.

- [ ] **Step 3: Allow the table and write the store**

In `server/exec/rows.ts`, change the `ExecTable` line to:

```ts
export type ExecTable = 'tasks' | 'projects' | 'weeks' | 'outcomes' | 'must_ships' | 'deep_work_blocks';
```

Create `server/exec/deepWork/store.ts`:

```ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../http';
import { toEntity, insertRow, updateRow } from '../rows';
import { getOutcome } from '../outcomes/store';
import { getWeek } from '../weeks/store';
import { getMustShip } from '../mustShips/store';
import { addDays } from '../../../src/shared/exec/dates';
import { hhmmToMinutes } from '../../../src/shared/exec/time';
import { contextOf } from '../../../src/shared/exec/week';
import type { DeepWorkBlock, MustShip } from '../../../src/shared/exec/todaySchemas';
import type { DeepWorkCreate, DeepWorkPatch, DeepWorkQuery } from '../../../src/shared/exec/deepWorkSchemas';

type Placement = Pick<DeepWorkBlock, 'date' | 'context' | 'plannedStart' | 'plannedMinutes' | 'outcomeId' | 'mustShipId'>;

export const invalid = (message: string): ApiError => new ApiError(400, 'VALIDATION', message);

export function getBlock(db: Database.Database, id: string): DeepWorkBlock | null {
  const row = db.prepare('SELECT * FROM deep_work_blocks WHERE id = ?').get(id);
  return row ? toEntity<DeepWorkBlock>(row) : null;
}

export function listBlocks(db: Database.Database, query: DeepWorkQuery): DeepWorkBlock[] {
  return db
    .prepare('SELECT * FROM deep_work_blocks WHERE date BETWEEN ? AND ? ORDER BY date, planned_start, id')
    .all(query.from, query.to)
    .map((row) => toEntity<DeepWorkBlock>(row));
}

function assertFits(fields: Placement): void {
  if (hhmmToMinutes(fields.plannedStart) + fields.plannedMinutes > 24 * 60) throw invalid('a block must end by midnight');
}

/** Unfinished blocks on a date may not overlap in time; finished ones are history and never block a plan. */
function assertFree(db: Database.Database, fields: Placement, exceptId: string | null): void {
  const start = hhmmToMinutes(fields.plannedStart);
  const end = start + fields.plannedMinutes;
  const others = db
    .prepare('SELECT planned_start, planned_minutes FROM deep_work_blocks WHERE date = ? AND ended_at IS NULL AND id IS NOT ?')
    .all(fields.date, exceptId) as { planned_start: string; planned_minutes: number }[];
  for (const other of others) {
    const otherStart = hhmmToMinutes(other.planned_start);
    if (start < otherStart + other.planned_minutes && otherStart < end) throw invalid('that time overlaps another block');
  }
}

function assertOutcome(db: Database.Database, fields: Placement): void {
  if (fields.outcomeId === null) return;
  const outcome = getOutcome(db, fields.outcomeId);
  if (!outcome) throw invalid('no such outcome');
  if (outcome.slot === null || outcome.status !== 'active') throw invalid('that outcome is not active this week');
  const week = getWeek(db, outcome.weekId);
  if (!week || fields.date < week.startDate || fields.date > addDays(week.startDate, 6)) throw invalid('that outcome belongs to another week');
  if (contextOf(outcome.category) !== fields.context) throw invalid('that outcome belongs to the other context');
}

function assertMustShip(db: Database.Database, fields: Placement): void {
  if (fields.mustShipId === null) return;
  const mustShip = getMustShip(db, fields.mustShipId);
  if (!mustShip) throw invalid('no such must ship');
  if (mustShip.date !== fields.date || mustShip.context !== fields.context) throw invalid('that must ship is for another day or context');
}

function assertPlaceable(db: Database.Database, fields: Placement, exceptId: string | null): void {
  assertFits(fields);
  assertFree(db, fields, exceptId);
  assertOutcome(db, fields);
  assertMustShip(db, fields);
}

export function createBlock(db: Database.Database, input: DeepWorkCreate, now: string): DeepWorkBlock {
  return db
    .transaction((): DeepWorkBlock => {
      assertPlaceable(db, input, null);
      const id = randomUUID();
      insertRow(db, 'deep_work_blocks', { ...input, id, createdAt: now, updatedAt: now });
      return getBlock(db, id) as DeepWorkBlock;
    })
    .immediate();
}

/** A block can be re-planned until it starts; after that its time and links are history. */
export function patchBlock(db: Database.Database, id: string, patch: DeepWorkPatch, now: string): DeepWorkBlock | null {
  return db
    .transaction((): DeepWorkBlock | null => {
      const current = getBlock(db, id);
      if (!current) return null;
      if (current.startedAt !== null) throw invalid('a started block cannot be changed');
      assertPlaceable(db, { ...current, ...patch }, id);
      updateRow(db, 'deep_work_blocks', id, { ...patch, updatedAt: now });
      return getBlock(db, id);
    })
    .immediate();
}

function dayMustShip(db: Database.Database, block: DeepWorkBlock): MustShip | null {
  const row = db.prepare('SELECT * FROM must_ships WHERE date = ? AND context = ?').get(block.date, block.context);
  return row ? toEntity<MustShip>(row) : null;
}

/**
 * Sets started_at. Idempotent while running. The block takes the day's Must Ship of its context when it has none,
 * and that Must Ship's outcome when it has none, so the minutes count toward the outcome.
 */
export function startBlock(db: Database.Database, id: string, now: string): DeepWorkBlock | null {
  return db
    .transaction((): DeepWorkBlock | null => {
      const block = getBlock(db, id);
      if (!block) return null;
      if (block.endedAt !== null) throw invalid('that block has already finished');
      if (block.startedAt !== null) return block;
      const running = db.prepare('SELECT 1 FROM deep_work_blocks WHERE date = ? AND started_at IS NOT NULL AND ended_at IS NULL AND id != ?').get(block.date, id);
      if (running) throw invalid('another block is already running');
      const mustShip = block.mustShipId === null ? dayMustShip(db, block) : getMustShip(db, block.mustShipId);
      updateRow(db, 'deep_work_blocks', id, {
        startedAt: now,
        mustShipId: mustShip?.id ?? block.mustShipId,
        outcomeId: block.outcomeId ?? mustShip?.outcomeId ?? null,
        updatedAt: now,
      });
      return getBlock(db, id);
    })
    .immediate();
}

/** The paused seconds folded into the total, and the pause cleared. */
export function pauseFold(block: Pick<DeepWorkBlock, 'pausedSeconds' | 'pauseStartedAt'>, now: string): { pausedSeconds: number; pauseStartedAt: null } {
  if (block.pauseStartedAt === null) return { pausedSeconds: block.pausedSeconds, pauseStartedAt: null };
  const span = Math.max(0, Math.round((Date.parse(now) - Date.parse(block.pauseStartedAt)) / 1000));
  return { pausedSeconds: block.pausedSeconds + span, pauseStartedAt: null };
}

export function pauseBlock(db: Database.Database, id: string, now: string): DeepWorkBlock | null {
  return db
    .transaction((): DeepWorkBlock | null => {
      const block = getBlock(db, id);
      if (!block) return null;
      if (block.startedAt === null || block.endedAt !== null) throw invalid('that block is not running');
      if (block.pauseStartedAt !== null) return block;
      updateRow(db, 'deep_work_blocks', id, { pauseStartedAt: now, updatedAt: now });
      return getBlock(db, id);
    })
    .immediate();
}

export function resumeBlock(db: Database.Database, id: string, now: string): DeepWorkBlock | null {
  return db
    .transaction((): DeepWorkBlock | null => {
      const block = getBlock(db, id);
      if (!block) return null;
      if (block.pauseStartedAt === null) return block;
      updateRow(db, 'deep_work_blocks', id, { ...pauseFold(block, now), updatedAt: now });
      return getBlock(db, id);
    })
    .immediate();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/deep-work-store.test.ts`
Expected: PASS.

Run: `npx vitest run server/exec && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 5: Commit**

```bash
git add server/exec/rows.ts server/exec/deepWork/store.ts server/exec/__tests__/deep-work-store.test.ts
git commit -m "feat: add the deep-work blocks data module with overlap, start, pause and resume"
```

---

### Task 5: Finishing a block, and the blocker's waiting task

**Files:**
- Create: `server/exec/deepWork/finish.ts`
- Test: `server/exec/__tests__/deep-work-finish.test.ts`

**Interfaces:**
- Consumes: `getBlock`, `pauseFold`, `invalid` (`deepWork/store.ts`, Task 4); `getMustShip`, `patchMustShip` (`mustShips/store.ts`); `getTask` (`tasks/store.ts`); `insertRow`, `updateRow` (`rows.ts`); `addDays`; `type Task` (`schemas.ts`); `type DeepWorkBlock`, `MustShip` (`todaySchemas.ts`); `type Blocker`, `DeepWorkFinish`, `FinishResult` (Task 1).
- Produces: `finishBlock(db, id, input: DeepWorkFinish, now): FinishResult | null`, or `null` for an unknown id. It:
  - ends the block with its result and notes, folding any open pause;
  - ships the Must Ship on `completed` (unless it is killed);
  - on `blocked`, blocks the Must Ship and files a `waiting` task for the next action;
  - leaves the Must Ship alone on `progress` and `abandoned`;
  - refuses a block that never started or has already finished.

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/deep-work-finish.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { createMustShip, getMustShip, patchMustShip } from '../mustShips/store';
import { createBlock, getBlock, pauseBlock, startBlock } from '../deepWork/store';
import { finishBlock } from '../deepWork/finish';
import { ApiError } from '../http';
import type { DeepWorkCreate, DeepWorkFinish } from '../../../src/shared/exec/deepWorkSchemas';

const T0 = '2026-09-29T03:00:00.000Z';
const T1 = '2026-09-29T03:35:00.000Z';
const T2 = '2026-09-29T03:45:00.000Z';
const T3 = '2026-09-29T04:05:00.000Z';
const BLOCKER = { what: 'Supplier has not replied', owner: 'Bilal', nextAction: 'Call Bilal about the tracker' };
let db: Database.Database;
let weekId: string;

const plan = (overrides: Partial<DeepWorkCreate> = {}): DeepWorkCreate => ({ date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null, ...overrides });
const done = (result: DeepWorkFinish['result'], extra: Partial<DeepWorkFinish> = {}): DeepWorkFinish => ({ result, notes: '', ...extra });
const outcome = () =>
  addOutcome(db, weekId, { title: 'Supplier plan confirmed', category: 'office', description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, T0);
const ship = (outcomeId: string | null = null) =>
  createMustShip(db, { title: 'Delivery tracker sent', context: 'work', date: '2026-09-29', definitionOfDone: '', outcomeId, projectId: null, notes: '' }, T0);
/** A started block, linked to the day's Must Ship by the start. */
const running = (context: 'work' | 'build' = 'work') => {
  const made = createBlock(db, plan({ context }), T0);
  return startBlock(db, made.id, T1)!;
};

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
  weekId = ensureWeek(db, '2026-09-29', 0, T0).view.week.id;
});

describe('finishBlock', () => {
  it('ends the block with its result and notes, and ships the Must Ship on completed', () => {
    const planned = ship();
    const block = running();
    const finished = finishBlock(db, block.id, done('completed', { notes: 'Sent to all 20' }), T3)!;
    expect(finished.block).toMatchObject({ endedAt: T3, result: 'completed', notes: 'Sent to all 20', mustShipId: planned.id });
    expect(finished.mustShip).toMatchObject({ id: planned.id, status: 'shipped', closedAt: T3 });
    expect(finished.task).toBeNull();
  });

  it('leaves the Must Ship planned on progress and on abandoned', () => {
    const planned = ship();
    const first = running();
    finishBlock(db, first.id, done('progress'), T2);
    expect(getMustShip(db, planned.id)?.status).toBe('planned');
    const second = createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    startBlock(db, second.id, T3);
    expect(finishBlock(db, second.id, done('abandoned'), '2026-09-29T04:30:00.000Z')!.mustShip?.status).toBe('planned');
  });

  it('never revives a killed Must Ship', () => {
    const killed = ship();
    const block = running();
    patchMustShip(db, killed.id, { status: 'killed' }, T2);
    expect(finishBlock(db, block.id, done('completed'), T3)!.mustShip?.status).toBe('killed');
  });

  it('blocks the Must Ship and files a waiting task owned by the blocker, due the next day', () => {
    const linked = outcome();
    const planned = ship(linked.id);
    const block = running();
    const finished = finishBlock(db, block.id, done('blocked', { blocker: BLOCKER }), T3)!;
    expect(finished.mustShip).toMatchObject({ status: 'blocked', blockerWhat: BLOCKER.what, blockerOwner: 'Bilal', blockerNextAction: BLOCKER.nextAction, closedAt: T3 });
    expect(finished.task).toMatchObject({
      title: 'Call Bilal about the tracker',
      notes: 'Blocked: Supplier has not replied',
      context: 'work',
      status: 'waiting',
      ownerName: 'Bilal',
      followUpDate: '2026-09-30',
      mustShipId: planned.id,
      outcomeId: linked.id,
      capturedAt: T3,
      processedAt: T3,
      delegatedAt: T3,
    });
  });

  it('still files the task when the block has no Must Ship, as a build session on an outcome would', () => {
    const made = createBlock(db, plan({ context: 'build' }), T0);
    startBlock(db, made.id, T1);
    const finished = finishBlock(db, made.id, done('blocked', { blocker: BLOCKER }), T3)!;
    expect(finished.mustShip).toBeNull();
    expect(finished.task).toMatchObject({ context: 'build', status: 'waiting', ownerName: 'Bilal', mustShipId: null });
  });

  it('folds an open pause into the paused seconds', () => {
    ship();
    const block = running();
    pauseBlock(db, block.id, T2);
    const finished = finishBlock(db, block.id, done('progress'), T3)!;
    expect(finished.block).toMatchObject({ pauseStartedAt: null, pausedSeconds: 1200, endedAt: T3 });
  });

  it('refuses a block that never started, one already finished, and a blocked result with no blocker, changing nothing', () => {
    const planned = ship();
    const idle = createBlock(db, plan({ plannedStart: '14:00', plannedMinutes: 60 }), T0);
    expect(refusal(() => finishBlock(db, idle.id, done('progress'), T3))).toMatchObject({ status: 400, message: 'a block must be started before it can finish' });
    const block = running();
    expect(refusal(() => finishBlock(db, block.id, done('blocked'), T3))).toMatchObject({ message: 'a blocked session needs a blocker' });
    expect(getBlock(db, block.id)).toMatchObject({ endedAt: null, result: null });
    expect(getMustShip(db, planned.id)?.status).toBe('planned');
    finishBlock(db, block.id, done('progress'), T3);
    expect(refusal(() => finishBlock(db, block.id, done('completed'), T3))).toMatchObject({ message: 'that block has already finished' });
  });

  it('answers null for an unknown block', () => {
    expect(finishBlock(db, '50000000-0000-4000-8000-000000000999', done('progress'), T3)).toBeNull();
  });
});
```

The paused-fold test: paused at 03:45, finished at 04:05 = 1200 seconds.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/deep-work-finish.test.ts`
Expected: FAIL, because `../deepWork/finish` cannot be resolved.

- [ ] **Step 3: Write finishing**

Create `server/exec/deepWork/finish.ts`:

```ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { insertRow, updateRow } from '../rows';
import { getMustShip, patchMustShip } from '../mustShips/store';
import { getTask } from '../tasks/store';
import { getBlock, invalid, pauseFold } from './store';
import { addDays } from '../../../src/shared/exec/dates';
import type { Task } from '../../../src/shared/exec/schemas';
import type { DeepWorkBlock, MustShip } from '../../../src/shared/exec/todaySchemas';
import type { Blocker, DeepWorkFinish, FinishResult } from '../../../src/shared/exec/deepWorkSchemas';

/** Completing ships the Must Ship and blocking blocks it; a killed Must Ship is never revived, and progress changes nothing. */
function settleMustShip(db: Database.Database, block: DeepWorkBlock, input: DeepWorkFinish, now: string): MustShip | null {
  if (block.mustShipId === null) return null;
  const current = getMustShip(db, block.mustShipId);
  if (!current || current.status === 'killed') return current;
  if (input.result === 'completed') return patchMustShip(db, current.id, { status: 'shipped' }, now);
  if (input.result === 'blocked' && input.blocker && current.status !== 'shipped') {
    return patchMustShip(
      db,
      current.id,
      { status: 'blocked', blockerWhat: input.blocker.what, blockerOwner: input.blocker.owner, blockerNextAction: input.blocker.nextAction },
      now
    );
  }
  return current;
}

/** The next action becomes a task waiting on its owner, to follow up the day after the block (spec B, POST /deep-work/:id/finish). */
function fileBlockerTask(db: Database.Database, block: DeepWorkBlock, mustShip: MustShip | null, blocker: Blocker, now: string): Task {
  const id = randomUUID();
  insertRow(db, 'tasks', {
    id,
    title: blocker.nextAction,
    notes: `Blocked: ${blocker.what}`,
    context: block.context,
    status: 'waiting',
    projectId: mustShip?.projectId ?? null,
    outcomeId: block.outcomeId ?? mustShip?.outcomeId ?? null,
    mustShipId: mustShip?.id ?? block.mustShipId,
    ownerName: blocker.owner,
    followUpDate: addDays(block.date, 1),
    capturedAt: now,
    processedAt: now,
    delegatedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return getTask(db, id) as Task;
}

/** Ends a running block, settles its Must Ship and, when blocked, files the waiting task, all or nothing. */
export function finishBlock(db: Database.Database, id: string, input: DeepWorkFinish, now: string): FinishResult | null {
  return db
    .transaction((): FinishResult | null => {
      const block = getBlock(db, id);
      if (!block) return null;
      if (block.startedAt === null) throw invalid('a block must be started before it can finish');
      if (block.endedAt !== null) throw invalid('that block has already finished');
      if (input.result === 'blocked' && !input.blocker) throw invalid('a blocked session needs a blocker');
      updateRow(db, 'deep_work_blocks', id, { endedAt: now, result: input.result, notes: input.notes, ...pauseFold(block, now), updatedAt: now });
      const mustShip = settleMustShip(db, block, input, now);
      const task = input.result === 'blocked' && input.blocker ? fileBlockerTask(db, block, mustShip, input.blocker, now) : null;
      return { block: getBlock(db, id) as DeepWorkBlock, mustShip, task };
    })
    .immediate();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/deep-work-finish.test.ts`
Expected: PASS.

Run: `npx vitest run server/exec && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 5: Commit**

```bash
git add server/exec/deepWork/finish.ts server/exec/__tests__/deep-work-finish.test.ts
git commit -m "feat: finish a block, settle its Must Ship and file the blocker's waiting task"
```

---

### Task 6: Serve deep work under /api/exec

**Files:**
- Create: `server/exec/routes/deepWork.ts`
- Modify: `server/exec/router.ts`
- Test: `server/exec/__tests__/deep-work-routes.test.ts`

**Interfaces:**
- Consumes: Task 4's store and Task 5's `finishBlock`; `deepWorkCreateSchema`, `deepWorkPatchSchema`, `deepWorkQuerySchema`, `deepWorkFinishSchema`, `finishResultSchema` (Task 1); `deepWorkBlockSchema` (`todaySchemas.ts`); `ok`, `ApiError` (`http.ts`); `nowIso`.
- Produces: `deepWorkRouter(db, clock = nowIso)`, mounted at `/deep-work` after `/days`:
  - `GET /?from&to` returns `DeepWorkBlock[]`
  - `POST /` returns 201 and the block
  - `PATCH /:id` updates a planned block
  - `POST /:id/start`, `/pause` and `/resume` (no body) each return the block
  - `POST /:id/finish` returns a `FinishResult`
  - An unknown id gets `404 NOT_FOUND 'no such block'`.

- [ ] **Step 1: Write the failing tests**

Create `server/exec/__tests__/deep-work-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { deepWorkBlockSchema } from '../../../src/shared/exec/todaySchemas';
import { finishResultSchema } from '../../../src/shared/exec/deepWorkSchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const create = (body: Record<string, unknown>) => request(app).post('/api/exec/deep-work').send(body);
const block = { date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 };
const missing = { success: false, error: 'no such block', code: 'NOT_FOUND' };
const UNKNOWN = '50000000-0000-4000-8000-000000000999';

describe('/api/exec/deep-work', () => {
  it('plans a block (201), lists a range, and patches it', async () => {
    const made = await create(block);
    expect(made.status).toBe(201);
    expect(deepWorkBlockSchema.safeParse(made.body.data).success).toBe(true);
    await create({ ...block, date: '2026-10-08' });
    const listed = await request(app).get('/api/exec/deep-work?from=2026-09-27&to=2026-10-03');
    expect(listed.body.data.map((row: { date: string }) => row.date)).toEqual(['2026-09-29']);
    const patched = await request(app).patch(`/api/exec/deep-work/${made.body.data.id}`).send({ plannedMinutes: 60 });
    expect(patched.body.data).toMatchObject({ plannedMinutes: 60 });
  });

  it('runs a session from start to a blocked finish and leaves every trace', async () => {
    const ship = (await request(app).post('/api/exec/must-ships').send({ title: 'Delivery tracker sent', context: 'work', date: '2026-09-29' })).body.data;
    const id = (await create(block)).body.data.id as string;
    const started = await request(app).post(`/api/exec/deep-work/${id}/start`).send({});
    expect(started.body.data).toMatchObject({ mustShipId: ship.id });
    expect(started.body.data.startedAt).not.toBeNull();
    expect((await request(app).post(`/api/exec/deep-work/${id}/pause`).send({})).body.data.pauseStartedAt).not.toBeNull();
    expect((await request(app).post(`/api/exec/deep-work/${id}/resume`).send({})).body.data.pauseStartedAt).toBeNull();
    const finished = await request(app)
      .post(`/api/exec/deep-work/${id}/finish`)
      .send({ result: 'blocked', blocker: { what: 'Supplier has not replied', owner: 'Bilal', nextAction: 'Call Bilal about the tracker' } });
    expect(finished.status).toBe(200);
    expect(finishResultSchema.safeParse(finished.body.data).success).toBe(true);
    expect(finished.body.data).toMatchObject({ block: { result: 'blocked' }, mustShip: { status: 'blocked' }, task: { status: 'waiting', ownerName: 'Bilal', followUpDate: '2026-09-30' } });
    const waiting = await request(app).get('/api/exec/tasks?status=waiting');
    expect(waiting.body.data.map((task: { title: string }) => task.title)).toEqual(['Call Bilal about the tracker']);
    const day = await request(app).get('/api/exec/days/2026-09-29');
    expect(day.body.data.blocks).toMatchObject([{ id, result: 'blocked' }]);
  });

  it('answers 404 with the exact body for an unknown block on every verb', async () => {
    const calls = [
      request(app).patch(`/api/exec/deep-work/${UNKNOWN}`).send({ plannedMinutes: 30 }),
      request(app).post(`/api/exec/deep-work/${UNKNOWN}/start`).send({}),
      request(app).post(`/api/exec/deep-work/${UNKNOWN}/pause`).send({}),
      request(app).post(`/api/exec/deep-work/${UNKNOWN}/resume`).send({}),
      request(app).post(`/api/exec/deep-work/${UNKNOWN}/finish`).send({ result: 'progress' }),
    ];
    for (const response of await Promise.all(calls)) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual(missing);
    }
  });

  it('refuses with the rule that failed, and never echoes an unknown field', async () => {
    await create(block);
    const overlap = await create({ ...block, plannedStart: '09:00' });
    expect(overlap.status).toBe(400);
    expect(overlap.body).toMatchObject({ code: 'VALIDATION', error: 'that time overlaps another block' });
    const range = await request(app).get('/api/exec/deep-work?from=2026-10-03&to=2026-09-27');
    expect(range.body).toMatchObject({ code: 'VALIDATION', details: [{ path: 'to', message: 'from must not be after to' }] });
    const blocker = await request(app).post(`/api/exec/deep-work/${UNKNOWN}/finish`).send({ result: 'blocked' });
    expect(blocker.body.details).toEqual([{ path: 'blocker', message: 'a blocked session needs what blocks it, who owns it and the next action' }]);
    const extra = await create({ ...block, plannedStart: '15:00', startedAt: '2026-09-29T10:00:00.000Z' });
    expect(extra.status).toBe(400);
    expect(extra.body.details).toEqual([{ path: '', message: 'unknown field' }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/deep-work-routes.test.ts`
Expected: FAIL. Every call answers `404 no such endpoint`.

- [ ] **Step 3: Write the router and mount it**

Create `server/exec/routes/deepWork.ts`:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { createBlock, listBlocks, patchBlock, pauseBlock, resumeBlock, startBlock } from '../deepWork/store';
import { finishBlock } from '../deepWork/finish';
import { deepWorkCreateSchema, deepWorkFinishSchema, deepWorkPatchSchema, deepWorkQuerySchema } from '../../../src/shared/exec/deepWorkSchemas';

export function deepWorkRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const found = <T>(value: T | null): T => {
    if (value === null) throw new ApiError(404, 'NOT_FOUND', 'no such block');
    return value;
  };

  router.get('/', (req, res) => ok(res, listBlocks(db, deepWorkQuerySchema.parse(req.query))));

  router.post('/', (req, res) => ok(res, createBlock(db, deepWorkCreateSchema.parse(req.body), clock()), 201));

  router.patch('/:id', (req, res) => {
    const patch = deepWorkPatchSchema.parse(req.body);
    ok(res, found(patchBlock(db, req.params.id, patch, clock())));
  });

  router.post('/:id/start', (req, res) => ok(res, found(startBlock(db, req.params.id, clock()))));
  router.post('/:id/pause', (req, res) => ok(res, found(pauseBlock(db, req.params.id, clock()))));
  router.post('/:id/resume', (req, res) => ok(res, found(resumeBlock(db, req.params.id, clock()))));

  router.post('/:id/finish', (req, res) => {
    const input = deepWorkFinishSchema.parse(req.body);
    ok(res, found(finishBlock(db, req.params.id, input, clock())));
  });

  return router;
}
```

In `server/exec/router.ts`, add `import { deepWorkRouter } from './routes/deepWork';` beside the other route imports, and after `router.use('/days', daysRouter(db));` add:

```ts
  router.use('/deep-work', deepWorkRouter(db));
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/deep-work-routes.test.ts`
Expected: PASS.

Run: `npx vitest run server/exec && npm run lint`
Expected: all green; lint clean.

- [ ] **Step 5: Commit**

```bash
git add server/exec/routes/deepWork.ts server/exec/router.ts server/exec/__tests__/deep-work-routes.test.ts
git commit -m "feat: serve deep-work blocks under /api/exec with start, pause, resume and finish"
```

---

### Task 7: Client hooks for deep work

**Files:**
- Create: `src/api/deepWork.ts`
- Modify: `src/api/keys.ts`, `src/test/fixtures.ts`
- Test: `src/api/deepWork.test.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError` (`client.ts`); `toQueryString`; `daysKey`, `mustShipsKey`, `tasksKey` (`keys.ts`); `type DeepWorkBlock` (`todaySchemas.ts`); `type DeepWorkInput`, `DeepWorkPatch`, `DeepWorkFinishInput`, `FinishResult` (`deepWorkSchemas.ts`).
- Produces:
  - `keys.ts`: `deepWorkKey`
  - `src/api/deepWork.ts`, exporting `deepWorkKey` and:
    - `useBlocks(range: { from: string; to: string }, { enabled? })`
    - `useCreateBlock()` (variables `DeepWorkInput`)
    - `useUpdateBlock()` (variables `{ id, patch }`)
    - `useStartBlock()`, `usePauseBlock()` and `useResumeBlock()` (variable: the block id)
    - `useFinishBlock()` (variables `{ id, input }`)
  - Every block write refreshes blocks and the day. Finishing also refreshes Must Ships and tasks, since it can ship or block a Must Ship and file a waiting task.
  - `fixtures.ts`: `makeBlock(overrides?)`, an unstarted work block for Tuesday 29 Sep 2026 at 08:35 for 90 minutes.

- [ ] **Step 1: Write the failing test**

Create `src/api/deepWork.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useBlocks, useCreateBlock, useUpdateBlock, useStartBlock, usePauseBlock, useResumeBlock, useFinishBlock } from './deepWork';
import { useDay } from './days';
import { useMustShips } from './mustShips';
import { useTasks } from './tasks';
import { stubFetch, json } from '../test/fetch';
import { makeBlock } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('useBlocks', () => {
  it('reads a date range, and waits until it is enabled', async () => {
    const calls = stubFetch(() => json([makeBlock()]));
    const { result, rerender } = renderHook(({ enabled }) => useBlocks({ from: '2026-09-27', to: '2026-10-03' }, { enabled }), { wrapper, initialProps: { enabled: false } });
    expect(calls).toHaveLength(0);
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]).toMatchObject({ method: 'GET', url: '/api/exec/deep-work?from=2026-09-27&to=2026-10-03' });
  });
});

describe('block writes', () => {
  it('sends each verb to its route, and refreshes the blocks and the day after each', async () => {
    const calls = stubFetch((url) => (url.startsWith('/api/exec/days/') ? json({}) : url.includes('/deep-work?') ? json([]) : json(makeBlock())));
    const { result } = renderHook(
      () => ({
        blocks: useBlocks({ from: '2026-09-27', to: '2026-10-03' }),
        day: useDay('2026-09-29'),
        create: useCreateBlock(),
        update: useUpdateBlock(),
        start: useStartBlock(),
        pause: usePauseBlock(),
        resume: useResumeBlock(),
      }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.blocks.isSuccess && result.current.day.isSuccess).toBe(true));
    await act(async () => {
      await result.current.create.mutateAsync({ date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 });
      await result.current.update.mutateAsync({ id: 'b1', patch: { plannedMinutes: 60 } });
      await result.current.start.mutateAsync('b1');
      await result.current.pause.mutateAsync('b1');
      await result.current.resume.mutateAsync('b1');
    });
    expect(calls.filter((c) => c.method !== 'GET').map((c) => [c.method, c.url, c.body])).toEqual([
      ['POST', '/api/exec/deep-work', { date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 }],
      ['PATCH', '/api/exec/deep-work/b1', { plannedMinutes: 60 }],
      ['POST', '/api/exec/deep-work/b1/start', {}],
      ['POST', '/api/exec/deep-work/b1/pause', {}],
      ['POST', '/api/exec/deep-work/b1/resume', {}],
    ]);
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/days/2026-09-29').length).toBeGreaterThanOrEqual(6));
    expect(calls.filter((c) => c.url.startsWith('/api/exec/deep-work?')).length).toBeGreaterThanOrEqual(6);
  });

  it('refreshes Must Ships and tasks after a finish, since it can ship, block and file a task', async () => {
    const calls = stubFetch((_url, init) => (init?.method === 'POST' ? json({ block: makeBlock(), mustShip: null, task: null }) : json([])));
    const { result } = renderHook(
      () => ({ ships: useMustShips({ date: '2026-09-29' }), tasks: useTasks({ status: ['waiting'] }), finish: useFinishBlock() }),
      { wrapper }
    );
    await waitFor(() => expect(result.current.ships.isSuccess && result.current.tasks.isSuccess).toBe(true));
    await act(async () => {
      await result.current.finish.mutateAsync({ id: 'b1', input: { result: 'completed' } });
    });
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/deep-work/b1/finish', body: { result: 'completed' } });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/must-ships?date=2026-09-29')).toHaveLength(2));
    expect(calls.filter((c) => c.url === '/api/exec/tasks?status=waiting')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/api/deepWork.test.tsx`
Expected: FAIL. `./deepWork` cannot be resolved and `makeBlock` is not exported.

- [ ] **Step 3: Add the key, the fixture and the hooks**

In `src/api/keys.ts`, append:

```ts
export const deepWorkKey = ['exec', 'deepWork'] as const;
```

In `src/test/fixtures.ts`, add `DeepWorkBlock` to the existing type import from `'../shared/exec/todaySchemas'` (that import already brings in `DayView` and `MustShip`), and append:

```ts
/** An unstarted work block for Tuesday 29 Sep 2026, 08:35 for 90 minutes, unless overridden. */
export function makeBlock(overrides: Partial<DeepWorkBlock> = {}): DeepWorkBlock {
  counter += 1;
  return {
    id: `50000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    date: '2026-09-29',
    context: 'work',
    plannedStart: '08:35',
    plannedMinutes: 90,
    outcomeId: null,
    mustShipId: null,
    startedAt: null,
    endedAt: null,
    pausedSeconds: 0,
    pauseStartedAt: null,
    result: null,
    notes: '',
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}
```

Create `src/api/deepWork.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DeepWorkBlock } from '../shared/exec/todaySchemas';
import type { DeepWorkFinishInput, DeepWorkInput, DeepWorkPatch, FinishResult } from '../shared/exec/deepWorkSchemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { daysKey, deepWorkKey, mustShipsKey, tasksKey } from './keys';

export { deepWorkKey };

/** Blocks dated from `from` to `to`, inclusive. Pass `enabled: false` until the range is trustworthy. */
export function useBlocks(range: { from: string; to: string }, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<DeepWorkBlock[], ApiError>({
    queryKey: [...deepWorkKey, range],
    queryFn: () => api.get<DeepWorkBlock[]>(`/deep-work${toQueryString(range)}`),
    enabled,
  });
}

/** Every block write refreshes the blocks and the day; `alsoRefresh` adds what a write can change beyond them. */
function useBlockMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>, alsoRefresh: readonly (readonly string[])[] = []) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => Promise.all([deepWorkKey, daysKey, ...alsoRefresh].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export const useCreateBlock = () => useBlockMutation((input: DeepWorkInput) => api.post<DeepWorkBlock>('/deep-work', input));

export const useUpdateBlock = () =>
  useBlockMutation(({ id, patch }: { id: string; patch: DeepWorkPatch }) => api.patch<DeepWorkBlock>(`/deep-work/${id}`, patch));

export const useStartBlock = () => useBlockMutation((id: string) => api.post<DeepWorkBlock>(`/deep-work/${id}/start`, {}));
export const usePauseBlock = () => useBlockMutation((id: string) => api.post<DeepWorkBlock>(`/deep-work/${id}/pause`, {}));
export const useResumeBlock = () => useBlockMutation((id: string) => api.post<DeepWorkBlock>(`/deep-work/${id}/resume`, {}));

/** Finishing can ship or block a Must Ship and file a waiting task, so those lists refresh too. */
export const useFinishBlock = () =>
  useBlockMutation(
    ({ id, input }: { id: string; input: DeepWorkFinishInput }) => api.post<FinishResult>(`/deep-work/${id}/finish`, input),
    [mustShipsKey, tasksKey]
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/api/deepWork.test.tsx`
Expected: PASS.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/api/deepWork.ts src/api/keys.ts src/test/fixtures.ts src/api/deepWork.test.tsx
git commit -m "feat: add the deep-work block hooks with refreshes for the day, Must Ships and tasks"
```

---

### Task 8: Start or resume a session

**Files:**
- Create: `src/components/focus/useFocusSession.ts`
- Test: `src/components/focus/useFocusSession.test.tsx`

**Interfaces:**
- Consumes: `useToday` (`{ today, now, ready, settings }`), `useDay`, `useSettings`; `useCreateBlock`, `useStartBlock` (Task 7); `planFocus`, `newBlockFor`, `type FocusSubject` (Task 3); `type ApiError` (`client.ts`); `type DeepWorkBlock`, `MustShipStatus` (`todaySchemas.ts`). The tests use fixtures `SETTINGS`, `makeBlock`, `makeMustShip`, `makeDayView` and `stubFetch`, `json`, `failure`.
- Produces: `useFocusSession(): FocusState`, where `FocusState` is one of:
  - `{ kind: 'loading' }`
  - `{ kind: 'error'; what: string | null; error: ApiError; retry: () => void }`, where `what` names a failed read ("the schedule", "today") and is `null` when starting the session failed
  - `{ kind: 'starting' }`
  - `{ kind: 'live'; block: DeepWorkBlock; subject: FocusSubject }`
  - `{ kind: 'closed'; title: string; status: MustShipStatus }`
  - `{ kind: 'nothing' }`

  The hook executes `planFocus`: for a `start` plan it creates a block when the plan has none, then starts it, exactly once however many times it renders.

- [ ] **Step 1: Write the failing test**

Create `src/components/focus/useFocusSession.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StrictMode, type ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '../../api/queryClient';
import { useFocusSession } from './useFocusSession';
import { stubFetch, json, failure } from '../../test/fetch';
import { SETTINGS, makeBlock, makeDayView, makeMustShip } from '../../test/fixtures';
import type { DayView } from '../../shared/exec/todaySchemas';

const DATE = '2026-09-29';
const STARTED = '2026-09-29T04:00:00.000Z';

/** StrictMode runs effects twice in development, which is exactly what a session start must survive. Each hook gets its own cache. */
const fresh = () => {
  const client = createQueryClient({ retry: false });
  return ({ children }: { children: ReactNode }) => (
    <StrictMode>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </StrictMode>
  );
};

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T04:00:00Z') }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ship = makeMustShip({ title: 'Delivery tracker sent' });

/** A tiny server: creating a block adds it to the day, starting one marks it live. */
function server(initial: DayView, failCreates = 0) {
  const state = { day: initial, failCreates };
  const calls = stubFetch((url, init) => {
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url === `/api/exec/days/${DATE}`) return json(state.day);
    if (url === '/api/exec/deep-work' && init?.method === 'POST') {
      if (state.failCreates > 0) {
        state.failCreates -= 1;
        return failure(500, 'INTERNAL', 'internal server error');
      }
      const created = makeBlock(JSON.parse(String(init.body)));
      state.day = { ...state.day, blocks: [...state.day.blocks, created] };
      return json(created, 201);
    }
    const start = url.match(/\/deep-work\/([^/]+)\/start$/);
    if (start) {
      state.day = { ...state.day, blocks: state.day.blocks.map((block) => (block.id === start[1] ? { ...block, startedAt: STARTED, mustShipId: ship.id } : block)) };
      return json(state.day.blocks.find((block) => block.id === start[1]));
    }
    return json({});
  });
  return calls;
}
const writes = (calls: ReturnType<typeof server>) => calls.filter((call) => call.method !== 'GET').map((call) => `${call.method} ${call.url}`);

describe('useFocusSession', () => {
  it('resumes a live block with its Must Ship as the subject, writing nothing', async () => {
    const live = makeBlock({ mustShipId: ship.id, startedAt: '2026-09-29T03:40:00.000Z' });
    const calls = server(makeDayView({ mustShip: ship, blocks: [live] }));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    expect(result.current.kind).toBe('loading');
    await waitFor(() => expect(result.current.kind).toBe('live'));
    expect(result.current).toMatchObject({ block: { id: live.id }, subject: { title: 'Delivery tracker sent' } });
    expect(writes(calls)).toEqual([]);
  });

  it('creates a block and starts it, once, even under StrictMode, then goes live', async () => {
    const calls = server(makeDayView({ mustShip: ship }));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current.kind).toBe('live'));
    const created = calls.filter((call) => call.method === 'POST' && call.url === '/api/exec/deep-work');
    expect(created).toHaveLength(1);
    expect(created[0].body).toEqual({ date: DATE, context: 'work', plannedStart: '09:00', plannedMinutes: 90, outcomeId: null, mustShipId: null });
    expect(writes(calls).filter((write) => write.endsWith('/start'))).toHaveLength(1);
  });

  it('starts a planned, unstarted block without creating another', async () => {
    const planned = makeBlock({ plannedStart: '08:35' });
    const calls = server(makeDayView({ mustShip: ship, blocks: [planned] }));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current.kind).toBe('live'));
    expect(writes(calls)).toEqual([`POST /api/exec/deep-work/${planned.id}/start`]);
  });

  it('starts nothing for a Must Ship that is no longer planned, or for no Must Ship', async () => {
    const calls = server(makeDayView({ mustShip: makeMustShip({ title: 'Delivery tracker sent', status: 'shipped' }) }));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current).toEqual({ kind: 'closed', title: 'Delivery tracker sent', status: 'shipped' }));
    expect(writes(calls)).toEqual([]);
    vi.unstubAllGlobals();
    server(makeDayView());
    const empty = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(empty.result.current.kind).toBe('nothing'));
  });

  it('reports a failed start with a retry that tries again', async () => {
    const calls = server(makeDayView({ mustShip: ship }), 1);
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current.kind).toBe('error'));
    expect(result.current).toMatchObject({ kind: 'error', what: null, error: { code: 'INTERNAL' } });
    await act(async () => {
      if (result.current.kind === 'error') result.current.retry();
    });
    await waitFor(() => expect(result.current.kind).toBe('live'));
    expect(calls.filter((call) => call.method === 'POST' && call.url === '/api/exec/deep-work')).toHaveLength(2);
  });

  it('reports a failed read of today or of the schedule, naming it, and never starts anything', async () => {
    const calls = stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    const { result } = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(result.current.kind).toBe('error'));
    expect(result.current).toMatchObject({ what: 'today', error: { code: 'INTERNAL' } });
    expect(calls.filter((call) => call.method !== 'GET')).toEqual([]);
    vi.unstubAllGlobals();
    stubFetch(() => failure(500, 'INTERNAL', 'internal server error'));
    const schedule = renderHook(() => useFocusSession(), { wrapper: fresh() });
    await waitFor(() => expect(schedule.result.current).toMatchObject({ kind: 'error', what: 'the schedule' }));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/focus/useFocusSession.test.tsx`
Expected: FAIL, because `./useFocusSession` cannot be resolved.

- [ ] **Step 3: Write the hook**

Create `src/components/focus/useFocusSession.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import type { ApiError } from '../../api/client';
import { useDay } from '../../api/days';
import { useCreateBlock, useStartBlock } from '../../api/deepWork';
import { useSettings } from '../../api/settings';
import { useToday } from '../../lib/useToday';
import { newBlockFor, planFocus, type FocusSubject } from '../../shared/exec/focus';
import type { DeepWorkBlock, MustShipStatus } from '../../shared/exec/todaySchemas';

export type FocusState =
  | { kind: 'loading' }
  | { kind: 'error'; what: string | null; error: ApiError; retry: () => void }
  | { kind: 'starting' }
  | { kind: 'live'; block: DeepWorkBlock; subject: FocusSubject }
  | { kind: 'closed'; title: string; status: MustShipStatus }
  | { kind: 'nothing' };

/**
 * Opening /focus starts or resumes today's block (spec C "Deep Work"). The plan is pure (`planFocus`); this
 * hook only executes a `start` plan, once: a ref guards the effect against StrictMode's double run and a
 * re-render, and a failure is kept until the person retries.
 */
export function useFocusSession(): FocusState {
  const { today, now, ready, settings } = useToday();
  const schedule = useSettings();
  const day = useDay(today, { enabled: ready });
  const create = useCreateBlock();
  const start = useStartBlock();
  const attempted = useRef(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const plan = settings && day.data ? planFocus(now, settings, day.data) : null;
  const wantsStart = plan?.kind === 'start';

  useEffect(() => {
    if (!plan || plan.kind !== 'start' || !settings || attempted.current || failure) return;
    attempted.current = true;
    const { context, block } = plan;
    void (async () => {
      try {
        const target = block ?? (await create.mutateAsync(newBlockFor(new Date(), settings, context, today)));
        await start.mutateAsync(target.id);
      } catch (error) {
        setFailure(error as ApiError);
      }
    })();
  }, [wantsStart, failure]);

  const retry = () => {
    attempted.current = false;
    setFailure(null);
  };
  if (schedule.isError) return { kind: 'error', what: 'the schedule', error: schedule.error, retry: () => void schedule.refetch() };
  if (day.isError) return { kind: 'error', what: 'today', error: day.error, retry: () => void day.refetch() };
  if (failure) return { kind: 'error', what: null, error: failure, retry };
  if (!plan) return { kind: 'loading' };
  if (plan.kind === 'live') return { kind: 'live', block: plan.block, subject: plan.subject };
  if (plan.kind === 'closed') return { kind: 'closed', title: plan.title, status: plan.status };
  if (plan.kind === 'nothing') return { kind: 'nothing' };
  return { kind: 'starting' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/focus/useFocusSession.test.tsx`
Expected: PASS.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/focus/useFocusSession.ts src/components/focus/useFocusSession.test.tsx
git commit -m "feat: start or resume today's deep-work session exactly once"
```

---

### Task 9: The focus screen

**Files:**
- Create: `src/components/focus/FocusTimer.tsx`, `src/components/focus/BlockerForm.tsx`, `src/components/focus/FocusSession.tsx`
- Modify: `src/screens/Focus.tsx` (overwrite)
- Test: `src/screens/Focus.test.tsx`

**Interfaces:**
- Consumes: `useFocusSession`, `type FocusState` (Task 8); `usePauseBlock`, `useResumeBlock`, `useFinishBlock` (Task 7); `elapsed`, `countdownLabel` (Task 2); `useNow` (`src/lib/useNow.ts`); `useReportError`, `errorMessage` (`errors.ts`); `LoadError`; `ScreenShell`; `MUST_SHIP_STATUS_LABELS`; `type FocusSubject` (Task 3); `type Blocker`, `DeepWorkFinishInput` (Task 1).
- Produces:
  - `FocusTimer({ block })`: a `role="timer"` named "Time remaining", refreshed each second, `"MM:SS"` or `"+MM:SS"` past zero, with "Paused" underneath while paused.
  - `BlockerForm({ pending, onSubmit(blocker), onCancel })`: a form named "Blocked" with the fields "What blocks it?", "Who owns the unblock?" and "What is the next action?" (200 characters at most), and the button "File the next action and stop", disabled until all three have text.
  - `FocusSession({ block, subject })`: a region "Focus session" with the subject, a Pause/Resume button, and the exits "Completed", "Made progress" and "Blocked". Every exit ends on Today.
  - `/focus`: the screen for each `FocusState`.
    - "Loading…" and "Starting your session…" while waiting.
    - `LoadError` for a failed read.
    - `Could not start the session: <reason>` with "Try again" for a failed start.
    - "Nothing to focus on." and `<title> is <status>. Nothing left to focus on.`, each with "Back to Today".
    - The live session otherwise.

- [ ] **Step 1: Write the failing test**

Create `src/screens/Focus.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeBlock, makeDayView, makeMustShip } from '../test/fixtures';
import type { DayView } from '../shared/exec/todaySchemas';

const DATE = '2026-09-29';
const ship = makeMustShip({ title: 'Delivery tracker sent', definitionOfDone: 'Sent to all 20', notes: 'Use the March template' });
const BLOCKER = { what: 'Supplier has not replied', owner: 'Bilal', nextAction: 'Call Bilal about the tracker' };

/** 09:00 on a Tuesday in Karachi. */
beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T04:00:00Z') }));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const live = (overrides = {}) => makeBlock({ mustShipId: ship.id, startedAt: '2026-09-29T03:40:00.000Z', ...overrides });
const seconds = (text: string | null) => {
  const [minutes, rest] = (text ?? '').replace('+', '').split(':').map(Number);
  return minutes * 60 + rest;
};
const timer = () => screen.getByRole('timer', { name: 'Time remaining' });

function server(day: DayView, respond?: (url: string, init?: RequestInit) => Response | undefined) {
  return stubFetch((url, init) => respond?.(url, init) ?? (url.endsWith('/settings') ? json(SETTINGS) : url === `/api/exec/days/${DATE}` ? json(day) : json([])));
}

describe('/focus', () => {
  it('shows the Must Ship, its definition and notes, and a countdown from the server timestamps that keeps moving', async () => {
    server(makeDayView({ mustShip: ship, blocks: [live()] }));
    renderRoute('/focus');
    expect(await screen.findByRole('heading', { level: 2, name: 'Delivery tracker sent' })).toBeInTheDocument();
    expect(screen.getByText('Sent to all 20')).toBeInTheDocument();
    expect(screen.getByText('Use the March template')).toBeInTheDocument();
    expect(timer()).toHaveTextContent(/^(70:00|69:5\d)$/);
    const before = seconds(timer().textContent);
    await act(async () => {
      vi.advanceTimersByTime(61_000);
    });
    expect(seconds(timer().textContent)).toBeLessThanOrEqual(before - 60);
  });

  it('stays frozen while paused, offers Resume, and counts up quietly past the plan', async () => {
    server(makeDayView({ mustShip: ship, blocks: [live({ pauseStartedAt: '2026-09-29T03:50:00.000Z' })] }));
    renderRoute('/focus');
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument();
    expect(timer()).toHaveTextContent('80:00');
    expect(screen.getByText('Paused')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(300_000);
    });
    expect(timer()).toHaveTextContent('80:00');
  });

  it('counts up past zero with a plus, without an alarm', async () => {
    server(makeDayView({ mustShip: ship, blocks: [live({ startedAt: '2026-09-29T02:20:00.000Z' })] }));
    renderRoute('/focus');
    await screen.findByRole('timer', { name: 'Time remaining' });
    expect(timer().textContent?.startsWith('+')).toBe(true);
  });

  it('pauses and resumes through the API', async () => {
    const block = live();
    const calls = server(makeDayView({ mustShip: ship, blocks: [block] }), (_url, init) => (init?.method === 'POST' ? json(block) : undefined));
    renderRoute('/focus');
    await userEvent.click(await screen.findByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')).toMatchObject({ url: `/api/exec/deep-work/${block.id}/pause` }));
  });

  it('ends on Today after Completed and after Made progress', async () => {
    const block = live();
    for (const [name, result] of [['Completed', 'completed'], ['Made progress', 'progress']] as const) {
      const calls = server(makeDayView({ mustShip: ship, blocks: [block] }), (_url, init) =>
        init?.method === 'POST' ? json({ block, mustShip: null, task: null }) : undefined
      );
      const { unmount } = renderRoute('/focus');
      await userEvent.click(await screen.findByRole('button', { name }));
      await waitFor(() => expect(calls.find((call) => call.method === 'POST')).toMatchObject({ url: `/api/exec/deep-work/${block.id}/finish`, body: { result } }));
      expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
      unmount();
      vi.unstubAllGlobals();
    }
  });

  it('asks the three blocker questions inline, needs every answer, files them and ends on Today', async () => {
    const block = live();
    const calls = server(makeDayView({ mustShip: ship, blocks: [block] }), (_url, init) => (init?.method === 'POST' ? json({ block, mustShip: null, task: null }) : undefined));
    renderRoute('/focus');
    await userEvent.click(await screen.findByRole('button', { name: 'Blocked' }));
    const form = screen.getByRole('form', { name: 'Blocked' });
    const file = screen.getByRole('button', { name: 'File the next action and stop' });
    expect(file).toBeDisabled();
    await userEvent.type(screen.getByLabelText('What blocks it?'), BLOCKER.what);
    await userEvent.type(screen.getByLabelText('Who owns the unblock?'), '   ');
    await userEvent.type(screen.getByLabelText('What is the next action?'), BLOCKER.nextAction);
    expect(file).toBeDisabled();
    await userEvent.clear(screen.getByLabelText('Who owns the unblock?'));
    await userEvent.type(screen.getByLabelText('Who owns the unblock?'), BLOCKER.owner);
    expect(form).toBeInTheDocument();
    await userEvent.click(file);
    await waitFor(() => expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ result: 'blocked', blocker: BLOCKER }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  });

  it('keeps the session live and says why when finishing fails', async () => {
    const block = live();
    server(makeDayView({ mustShip: ship, blocks: [block] }), (_url, init) => (init?.method === 'POST' ? failure(500, 'INTERNAL', 'internal server error') : undefined));
    renderRoute('/focus');
    await userEvent.click(await screen.findByRole('button', { name: 'Completed' }));
    expect(await screen.findByText('Could not finish the session: internal server error')).toBeInTheDocument();
    expect(timer()).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1, name: 'Today' })).toBeNull();
  });

  it('says so, with a way back, when there is nothing to focus on or the Must Ship is closed', async () => {
    server(makeDayView());
    const { unmount } = renderRoute('/focus');
    expect(await screen.findByText('Nothing to focus on.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/');
    unmount();
    vi.unstubAllGlobals();
    server(makeDayView({ mustShip: makeMustShip({ title: 'Delivery tracker sent', status: 'shipped' }) }));
    renderRoute('/focus');
    expect(await screen.findByText('Delivery tracker sent is shipped. Nothing left to focus on.')).toBeInTheDocument();
  });

  it('shows a failed start with a retry, and a failed read with the standard error', async () => {
    let creates = 0;
    const calls = server(makeDayView({ mustShip: ship }), (url, init) => {
      if (url === '/api/exec/deep-work' && init?.method === 'POST') {
        creates += 1;
        return failure(500, 'INTERNAL', 'internal server error');
      }
      return undefined;
    });
    const { unmount } = renderRoute('/focus');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not start the session: internal server error');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(creates).toBe(2));
    expect(calls.filter((call) => call.method === 'POST' && call.url.endsWith('/start'))).toEqual([]);
    unmount();
    vi.unstubAllGlobals();
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    renderRoute('/focus');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load today: internal server error');
  });
});
```

The existing shell test in `src/app/App.test.tsx` (`/focus` shows "Focus" full screen) keeps passing: the screen keeps its `h1` "Focus".

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/screens/Focus.test.tsx`
Expected: FAIL. `/focus` still says "Arrives in Phase 5."

- [ ] **Step 3: Write the components**

Create `src/components/focus/FocusTimer.tsx`:

```tsx
import { useNow } from '../../lib/useNow';
import { countdownLabel, elapsed } from '../../shared/exec/deepWork';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';

/** The large countdown, derived from the block's timestamps each second; quiet past zero, frozen while paused. */
export function FocusTimer({ block }: { block: DeepWorkBlock }) {
  const now = useNow(1000);
  const { remaining, paused } = elapsed(block, now);
  return (
    <div className="space-y-1 text-center">
      <p role="timer" aria-label="Time remaining" className={`text-7xl font-semibold tabular-nums ${remaining < 0 ? 'text-ink-muted' : ''}`}>
        {countdownLabel(remaining)}
      </p>
      <p className="h-5 text-sm text-ink-muted">{paused ? 'Paused' : ''}</p>
    </div>
  );
}
```

Create `src/components/focus/BlockerForm.tsx`:

```tsx
import { useId, useState, type FormEvent } from 'react';
import type { Blocker } from '../../shared/exec/deepWorkSchemas';

type Props = { pending: boolean; onSubmit: (blocker: Blocker) => void; onCancel: () => void };

const FIELD = 'w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink';

/** The three answers a Blocked exit asks for (spec C "Deep Work"): what blocks it, who owns the unblock, the next action. */
export function BlockerForm({ pending, onSubmit, onCancel }: Props) {
  const id = useId();
  const [what, setWhat] = useState('');
  const [owner, setOwner] = useState('');
  const [nextAction, setNextAction] = useState('');
  const blocker = { what: what.trim(), owner: owner.trim(), nextAction: nextAction.trim() };
  const complete = blocker.what !== '' && blocker.owner !== '' && blocker.nextAction !== '';
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (complete && !pending) onSubmit(blocker);
  };
  return (
    <form aria-label="Blocked" onSubmit={submit} className="space-y-2 rounded-lg border border-line p-4 dark:border-ink-muted">
      <label htmlFor={`${id}-what`} className="block text-sm">What blocks it?</label>
      <input id={`${id}-what`} value={what} maxLength={500} onChange={(e) => setWhat(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-owner`} className="block text-sm">Who owns the unblock?</label>
      <input id={`${id}-owner`} value={owner} maxLength={120} onChange={(e) => setOwner(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-next`} className="block text-sm">What is the next action?</label>
      <input id={`${id}-next`} value={nextAction} maxLength={200} onChange={(e) => setNextAction(e.target.value)} className={FIELD} />
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!complete || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
          File the next action and stop
        </button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
      </div>
    </form>
  );
}
```

Create `src/components/focus/FocusSession.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinishBlock, usePauseBlock, useResumeBlock } from '../../api/deepWork';
import { useReportError } from '../../api/errors';
import type { DeepWorkFinishInput } from '../../shared/exec/deepWorkSchemas';
import type { FocusSubject } from '../../shared/exec/focus';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';
import { BlockerForm } from './BlockerForm';
import { FocusTimer } from './FocusTimer';

type Props = { block: DeepWorkBlock; subject: FocusSubject };

const EXIT = 'rounded border border-line px-4 py-2 disabled:opacity-40 dark:border-ink-muted';

/** The whole screen of a live session: the subject, the timer, Pause, and three exits. Nothing else (spec C "Deep Work"). */
export function FocusSession({ block, subject }: Props) {
  const navigate = useNavigate();
  const pause = usePauseBlock();
  const resume = useResumeBlock();
  const finish = useFinishBlock();
  const report = useReportError();
  const [blocking, setBlocking] = useState(false);
  const paused = block.pauseStartedAt !== null;
  const toggling = pause.isPending || resume.isPending;
  const leave = (input: DeepWorkFinishInput) =>
    finish.mutate({ id: block.id, input }, { onSuccess: () => navigate('/'), onError: report('finish the session') });
  return (
    <section aria-label="Focus session" className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{subject.title}</h2>
        {subject.definitionOfDone && <p>{subject.definitionOfDone}</p>}
        {subject.notes && <p className="whitespace-pre-wrap text-ink-muted">{subject.notes}</p>}
      </div>
      <FocusTimer block={block} />
      <div className="flex justify-center">
        <button
          type="button"
          disabled={toggling}
          onClick={() => (paused ? resume : pause).mutate(block.id, { onError: report(paused ? 'resume the session' : 'pause the session') })}
          className={EXIT}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" disabled={finish.isPending} onClick={() => leave({ result: 'completed' })} className={EXIT}>Completed</button>
        <button type="button" disabled={finish.isPending} onClick={() => leave({ result: 'progress' })} className={EXIT}>Made progress</button>
        <button type="button" disabled={finish.isPending} onClick={() => setBlocking(true)} className={EXIT}>Blocked</button>
      </div>
      {blocking && <BlockerForm pending={finish.isPending} onCancel={() => setBlocking(false)} onSubmit={(blocker) => leave({ result: 'blocked', blocker })} />}
    </section>
  );
}
```

Overwrite `src/screens/Focus.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { LoadError } from '../components/LoadError';
import { FocusSession } from '../components/focus/FocusSession';
import { useFocusSession } from '../components/focus/useFocusSession';
import { errorMessage } from '../api/errors';
import { MUST_SHIP_STATUS_LABELS } from '../lib/labels';

const WAIT = 'text-ink-muted';

function Nothing({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      <p>{text}</p>
      <Link to="/" className="underline">Back to Today</Link>
    </div>
  );
}

/** Deep Work (spec C): opened from Today, it starts or resumes today's block. One subject, one timer, three exits. */
export default function Focus() {
  const state = useFocusSession();
  return (
    <ScreenShell title="Focus">
      {state.kind === 'loading' && <p className={WAIT}>Loading…</p>}
      {state.kind === 'starting' && <p className={WAIT}>Starting your session…</p>}
      {state.kind === 'error' && state.what !== null && <LoadError what={state.what} error={state.error} onRetry={state.retry} />}
      {state.kind === 'error' && state.what === null && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-4 dark:border-ink-muted">
          <p className="flex-1">Could not start the session: {errorMessage(state.error)}</p>
          <button type="button" onClick={state.retry} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">Try again</button>
        </div>
      )}
      {state.kind === 'nothing' && <Nothing text="Nothing to focus on." />}
      {state.kind === 'closed' && <Nothing text={`${state.title} is ${MUST_SHIP_STATUS_LABELS[state.status].toLowerCase()}. Nothing left to focus on.`} />}
      {state.kind === 'live' && <FocusSession block={state.block} subject={state.subject} />}
    </ScreenShell>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/screens/Focus.test.tsx src/app/App.test.tsx`
Expected: PASS, the Focus tests and every App test.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/components/focus src/screens/Focus.tsx src/screens/Focus.test.tsx
git commit -m "feat: add the focus screen with a derived countdown, pause and three exits"
```

---

### Task 10: Today knows about the session

**Files:**
- Modify: `src/shared/exec/today.ts`, `src/components/today/PrimaryCard.tsx`, `src/components/today/BuildCard.tsx`, `src/components/today/MustShipCard.tsx`
- Test: `src/shared/exec/today.test.ts`, `src/components/today/TodayCards.test.tsx`, `src/screens/Today.test.tsx` (append and change as listed)

**Interfaces:**
- Consumes: the Phase 4 Today components; `useUpdateMustShip`; `type DeepWorkBlock` (`todaySchemas.ts`); fixtures `makeBlock` (Task 7).
- Produces:
  - `todayMode`'s `resume` applies only to a live block whose context is `work`. A live build block never shows the office "Resume focus" card, since the Build card carries its own.
  - `BuildCard` gains an optional `live: DeepWorkBlock | null` (default `null`); when set, its primary action reads "Resume focus" instead of "Start".
  - `PrimaryCard`'s Build branch passes `live` as any live block of the day, whatever its context, so a session that runs past `office_end` can still be resumed. Its `resume` card names the Must Ship.
  - `MustShipCard`: "Start deep work" only for a planned Must Ship in `start` mode. In `grade` mode a planned Must Ship offers "Mark shipped" and "Start another session"; a Must Ship that is no longer planned offers neither.

- [ ] **Step 1: Write the failing tests**

In `src/shared/exec/today.test.ts`, inside `describe('todayMode: the primary card …')`, add:

```ts
  it('resumes only a live work block: a live build block leaves the Must Ship card to say Start', () => {
    const build = block({ context: 'build', mustShipId: null, startedAt: '2026-09-29T03:40:00.000Z' });
    expect(todayMode(at('2026-09-29', '09:00'), SETTINGS, view({ mustShip: mustShip(), blocks: [build] })).primary).toEqual({ kind: 'start', mustShipId: MS_ID });
  });
```

In `src/components/today/TodayCards.test.tsx`, add `makeBlock` to the fixtures import, then:

- In the test named 'asks for the result once its block has ended, and shows a closed status without edits', replace `expect(screen.getByRole('link', { name: 'Record the result' })).toHaveAttribute('href', '/focus');` with:

```tsx
    expect(screen.getByRole('button', { name: 'Mark shipped' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start another session' })).toHaveAttribute('href', '/focus');
    expect(screen.queryByRole('link', { name: 'Start deep work' })).toBeNull();
```

  and, after `expect(screen.queryByRole('button', { name: 'Put back' })).toBeNull();` in the same test, add:

```tsx
    expect(screen.queryByRole('link', { name: 'Start deep work' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Mark shipped' })).toBeNull();
```

- Append to the `describe('MustShipCard', …)` block:

```tsx
  it('marks a Must Ship shipped from the grade card', async () => {
    const mustShip = makeMustShip({ title: 'Delivery tracker sent' });
    const calls = stubFetch(() => json(mustShip));
    show(<MustShipCard mustShip={mustShip} outcome={null} outcomes={[]} settings={SETTINGS} mode="grade" />);
    await userEvent.click(screen.getByRole('button', { name: 'Mark shipped' }));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')).toMatchObject({ url: `/api/exec/must-ships/${mustShip.id}`, body: { status: 'shipped' } }));
  });
```

- Append to the `describe('BuildCard and TomorrowCard', …)` block:

```tsx
  it('offers to resume a live session instead of starting one', () => {
    const live = makeBlock({ context: 'build', startedAt: '2026-09-29T01:40:00.000Z' });
    show(<BuildCard mustShip={makeMustShip({ title: 'Landing page live', context: 'build' })} outcome={null} block={null} tomorrow={null} date="2026-09-29" outcomes={[]} live={live} />);
    expect(screen.getByRole('link', { name: 'Resume focus' })).toHaveAttribute('href', '/focus');
    expect(screen.queryByRole('link', { name: 'Start' })).toBeNull();
  });
```

In `src/screens/Today.test.tsx`, append, adding `makeBlock` to the fixtures import:

```tsx
  it('names the Must Ship on the resume card while a session is live', async () => {
    at('2026-09-29T04:00:00Z');
    const ship = makeMustShip({ title: 'Delivery tracker sent' });
    api({ '2026-09-29': makeDayView({ week: planned, mustShip: ship, blocks: [makeBlock({ mustShipId: ship.id, startedAt: '2026-09-29T03:40:00.000Z' })] }) });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Focus' });
    expect(card).toHaveTextContent('Delivery tracker sent');
    expect(within(card).getByRole('link', { name: 'Resume focus' })).toHaveAttribute('href', '/focus');
  });

  it('resumes a session that runs past office hours from the Build card', async () => {
    at('2026-09-29T13:30:00Z');
    api({ '2026-09-29': makeDayView({ week: planned, blocks: [makeBlock({ startedAt: '2026-09-29T12:50:00.000Z' })] }) });
    renderRoute('/');
    const card = await screen.findByRole('region', { name: 'Build' });
    expect(within(card).getByRole('link', { name: 'Resume focus' })).toHaveAttribute('href', '/focus');
  });
```

The second test runs at 18:30 in Karachi: outside office hours, with a work block started at 17:50 still running.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/exec/today.test.ts src/components/today/TodayCards.test.tsx src/screens/Today.test.tsx`
Expected: FAIL. The build block still resumes, "Mark shipped" and `live` do not exist, and the resume card names no Must Ship.

- [ ] **Step 3: Change the core and the cards**

In `src/shared/exec/today.ts`, change the `live` line in `primaryFor` to:

```ts
  const live = view.blocks.find((block) => block.context === 'work' && block.startedAt !== null && block.endedAt === null);
```

In `src/components/today/BuildCard.tsx`, add `import type { DeepWorkBlock, MustShip } from '../../shared/exec/todaySchemas';` (replacing the existing `MustShip`-only import), extend the props, and change the action:

```tsx
type Props = { mustShip: MustShip | null; outcome: Outcome | null; block: Block | null; tomorrow: string | null; date: string; outcomes: Outcome[]; live?: DeepWorkBlock | null };

export function BuildCard({ mustShip, outcome, block, tomorrow, date, outcomes, live = null }: Props) {
```

and replace the `{title ? (<Link to="/focus" …>Start</Link>) : (…)}` element with:

```tsx
        {live ? (
          <Link to="/focus" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Resume focus</Link>
        ) : title ? (
          <Link to="/focus" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Start</Link>
        ) : (
          <Link to="/week" className="underline">Open the week</Link>
        )}
```

In `src/components/today/PrimaryCard.tsx`, pass `live` in the Build branch (after the `tomorrow=` prop):

```tsx
        live={view.blocks.find((block) => block.startedAt !== null && block.endedAt === null) ?? null}
```

and replace the `resume` branch with:

```tsx
  if (primary.kind === 'resume') {
    return (
      <section aria-label="Focus" className="space-y-2 rounded-lg border border-line p-5 dark:border-ink-muted">
        <p className="text-xs uppercase tracking-wide text-ink-muted">Deep work in progress</p>
        {view.mustShip && <h2 className="text-2xl font-semibold">{view.mustShip.title}</h2>}
        <Link to="/focus" className="inline-block rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Resume focus</Link>
      </section>
    );
  }
```

In `src/components/today/MustShipCard.tsx`, replace the actions `<div>` with:

```tsx
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {planned && mode === 'start' && (
          <Link to="/focus" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Start deep work</Link>
        )}
        {planned && mode === 'grade' && (
          <>
            <button type="button" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink" onClick={() => save({ status: 'shipped' })}>Mark shipped</button>
            <Link to="/focus" className="rounded border border-line px-3 py-1.5 dark:border-ink-muted">Start another session</Link>
          </>
        )}
        {planned && <button type="button" className={BUTTON} onClick={() => setEditing(true)}>Edit</button>}
        {planned && <button type="button" className={BUTTON} onClick={() => save({ date: null })}>Put back</button>}
      </div>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/shared/exec/today.test.ts src/components/today src/screens/Today.test.tsx src/app/App.test.tsx`
Expected: PASS.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/exec/today.ts src/components/today/PrimaryCard.tsx src/components/today/BuildCard.tsx src/components/today/MustShipCard.tsx src/shared/exec/today.test.ts src/components/today/TodayCards.test.tsx src/screens/Today.test.tsx
git commit -m "feat: let Today resume a live session and grade a finished one"
```

---

### Task 11: The `f` key and the five-minute notice

**Files:**
- Create: `src/lib/safeStorage.ts`, `src/lib/useFocusKey.ts`, `src/components/FocusShortcut.tsx`, `src/shared/exec/notice.ts`, `src/lib/useDeepWorkNotice.ts`, `src/components/today/NoticePrompt.tsx`
- Modify: `src/app/Shell.tsx`, `src/screens/Today.tsx`
- Test: `src/shared/exec/notice.test.ts`, `src/lib/useDeepWorkNotice.test.tsx`, `src/components/today/NoticePrompt.test.tsx`, `src/components/FocusShortcut.test.tsx`

**Interfaces:**
- Consumes: `isEditableTarget` (`keys.ts`); `useToday`, `useDay`; `hhmmToMinutes`, `isWorkDay`, `localClock` (`time.ts`); `type Settings`. The tests use `renderRoute`, `stubFetch`, `json` and the fixtures `SETTINGS`, `makeDayView`, `makeMustShip`.
- Produces:
  - `readStorage(key): string | null` and `writeStorage(key, value): void`, both swallowing storage errors
  - `noticeDue(now, settings): string | null`: the date to remember while the notice is due (a work day, from five minutes before `deepWorkStart` until it starts), else `null`
  - `useDeepWorkNotice()`: from the shell, once per date, `new Notification('Deep work begins in 5 minutes')` when permission is granted
  - `NoticePrompt`: a region "Deep work notice", shown on Today only while permission is undecided and never answered, with "Turn on" and "Not now"
  - `useFocusKey(onTrigger)` and `FocusShortcut`: a bare `f` opens `/focus` when today has a work or build Must Ship
  - `Shell` mounts both `FocusShortcut` and the notice hook

- [ ] **Step 1: Write the failing tests**

Create `src/shared/exec/notice.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { noticeDue } from './notice';
import type { Settings } from './schemas';

const SETTINGS: Settings = {
  timezone: 'Asia/Karachi', weekStartDay: 0, workDays: [1, 2, 3, 4, 5], deepWorkStart: '08:35', deepWorkMinutes: 90,
  shutdownTime: '17:00', officeStart: '08:15', officeEnd: '18:00', buildBlocks: [],
};
/** Karachi is UTC+5: a local HH:MM on a date as a Date. */
const at = (date: string, hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const utc = h * 60 + m - 300;
  return new Date(`${date}T${String(Math.floor(utc / 60)).padStart(2, '0')}:${String(utc % 60).padStart(2, '0')}:00Z`);
};

describe('noticeDue', () => {
  it('is due from five minutes before deep work until it starts, on a work day', () => {
    expect(noticeDue(at('2026-09-29', '08:29'), SETTINGS)).toBeNull();
    expect(noticeDue(at('2026-09-29', '08:30'), SETTINGS)).toBe('2026-09-29');
    expect(noticeDue(at('2026-09-29', '08:34'), SETTINGS)).toBe('2026-09-29');
    expect(noticeDue(at('2026-09-29', '08:35'), SETTINGS)).toBeNull();
  });

  it('is never due on a non-work day, or when there are no work days', () => {
    expect(noticeDue(at('2026-10-03', '08:31'), SETTINGS)).toBeNull();
    expect(noticeDue(at('2026-09-29', '08:31'), { ...SETTINGS, workDays: [] })).toBeNull();
  });

  it('follows a changed start time', () => {
    expect(noticeDue(at('2026-09-29', '09:56'), { ...SETTINGS, deepWorkStart: '10:00' })).toBe('2026-09-29');
  });
});
```

Create `src/lib/useDeepWorkNotice.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from '../api/queryClient';
import { useDeepWorkNotice } from './useDeepWorkNotice';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS } from '../test/fixtures';

const fresh = () => {
  const client = createQueryClient({ retry: false });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

let calls: ReturnType<typeof stubFetch>;

/** Waits until the schedule has been asked for, then lets it land, so a quiet result is not just a slow one. */
const settled = async () => {
  await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  await act(async () => {
    vi.advanceTimersByTime(1000);
  });
  calls.length = 0;
};

function notification(permission: string) {
  const ctor = Object.assign(vi.fn(), { permission });
  vi.stubGlobal('Notification', ctor);
  return ctor;
}

beforeEach(() => {
  localStorage.clear();
  calls = stubFetch(() => json(SETTINGS));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('useDeepWorkNotice', () => {
  it('fires once on the day, five minutes before deep work, however often it ticks', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T03:31:00Z') });
    const shown = notification('granted');
    renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await waitFor(() => expect(shown).toHaveBeenCalledWith('Deep work begins in 5 minutes'));
    await act(async () => {
      vi.advanceTimersByTime(120_000);
    });
    expect(shown).toHaveBeenCalledTimes(1);
  });

  it('stays quiet without permission, outside the window, on a non-work day, or when it already fired today', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T03:31:00Z') });
    const denied = notification('default');
    const first = renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(denied).not.toHaveBeenCalled();
    first.unmount();

    vi.setSystemTime(new Date('2026-09-29T03:40:00Z'));
    const late = notification('granted');
    const second = renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(late).not.toHaveBeenCalled();
    second.unmount();

    vi.setSystemTime(new Date('2026-10-03T03:31:00Z'));
    const weekend = notification('granted');
    const third = renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(weekend).not.toHaveBeenCalled();
    third.unmount();

    vi.setSystemTime(new Date('2026-09-29T03:31:00Z'));
    localStorage.setItem('taskflow.noticeFired', '2026-09-29');
    const again = notification('granted');
    renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(again).not.toHaveBeenCalled();
  });

  it('does nothing where the browser has no notifications', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T03:31:00Z') });
    vi.stubGlobal('Notification', undefined);
    const { result } = renderHook(() => useDeepWorkNotice(), { wrapper: fresh() });
    await settled();
    expect(result.current).toBeUndefined();
  });
});
```

Create `src/components/today/NoticePrompt.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoticePrompt } from './NoticePrompt';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

function notification(permission: string) {
  const request = vi.fn().mockResolvedValue('granted');
  vi.stubGlobal('Notification', Object.assign(vi.fn(), { permission, requestPermission: request }));
  return request;
}

describe('NoticePrompt', () => {
  it('asks once: Turn on requests permission and never shows again', async () => {
    const request = notification('default');
    const { unmount } = render(<NoticePrompt />);
    expect(screen.getByRole('region', { name: 'Deep work notice' })).toHaveTextContent('Get a notice 5 minutes before deep work?');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
    unmount();
    render(<NoticePrompt />);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
  });

  it('Not now asks the browser nothing and is remembered', async () => {
    const request = notification('default');
    const { unmount } = render(<NoticePrompt />);
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(request).not.toHaveBeenCalled();
    unmount();
    render(<NoticePrompt />);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
  });

  it('shows nothing once permission is decided, or where notifications do not exist', () => {
    notification('granted');
    const { unmount } = render(<NoticePrompt />);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
    unmount();
    vi.stubGlobal('Notification', undefined);
    render(<NoticePrompt />);
    expect(screen.queryByRole('region', { name: 'Deep work notice' })).toBeNull();
  });
});
```

Create `src/components/FocusShortcut.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import { renderRoute } from '../test/render';
import { stubFetch, json } from '../test/fetch';
import { SETTINGS, makeDayView, makeMustShip } from '../test/fixtures';
import type { DayView } from '../shared/exec/todaySchemas';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Serves `day` for 09:00 on a Tuesday in Karachi, and resolves once the day has been read and rendered. */
async function opened(day: DayView) {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T04:00:00Z') });
  const calls = stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : url === '/api/exec/days/2026-09-29' ? json(day) : json([])));
  const view = renderRoute('/inbox');
  await screen.findByRole('heading', { level: 1, name: 'Inbox' });
  await vi.waitFor(() => expect(calls.some((call) => call.url === '/api/exec/days/2026-09-29')).toBe(true));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
  return view;
}

const pressF = (target: Element = document.body) => fireEvent.keyDown(target, { key: 'f' });

describe('the f key', () => {
  it('opens focus from any screen when today has a Must Ship', async () => {
    await opened(makeDayView({ mustShip: makeMustShip() }));
    pressF();
    expect(await screen.findByRole('heading', { level: 1, name: 'Focus' })).toBeInTheDocument();
  });

  it('opens focus for a build Must Ship too, and does nothing without one', async () => {
    const { unmount } = await opened(makeDayView({ buildMustShip: makeMustShip({ context: 'build' }) }));
    pressF();
    expect(await screen.findByRole('heading', { level: 1, name: 'Focus' })).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();
    await opened(makeDayView());
    pressF();
    expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument();
  });

  it('ignores an f typed into a field, and still answers one pressed elsewhere', async () => {
    await opened(makeDayView({ mustShip: makeMustShip() }));
    const field = document.createElement('input');
    document.body.appendChild(field);
    pressF(field);
    expect(screen.getByRole('heading', { level: 1, name: 'Inbox' })).toBeInTheDocument();
    field.remove();
    pressF();
    expect(await screen.findByRole('heading', { level: 1, name: 'Focus' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/exec/notice.test.ts src/lib/useDeepWorkNotice.test.tsx src/components/today/NoticePrompt.test.tsx src/components/FocusShortcut.test.tsx`
Expected: FAIL, because none of the modules exist.

- [ ] **Step 3: Write the notice, the prompt and the key**

Create `src/lib/safeStorage.ts`:

```ts
/** localStorage can be missing or throw (private windows, blocked site data); a lost remembered choice is never an error. */
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // nothing to do: the choice is simply asked or fired again next time
  }
}
```

Create `src/shared/exec/notice.ts`:

```ts
import { hhmmToMinutes, isWorkDay, localClock } from './time';
import type { Settings } from './schemas';

const LEAD_MINUTES = 5;

/**
 * The date to remember while the five-minute notice is due: a work day, from five minutes before
 * `deepWorkStart` until it starts (spec C "Deep Work"). Null the rest of the time.
 */
export function noticeDue(now: Date, settings: Settings): string | null {
  const clock = localClock(now, settings.timezone);
  if (!isWorkDay(clock, settings)) return null;
  const start = hhmmToMinutes(settings.deepWorkStart);
  return clock.minutes >= start - LEAD_MINUTES && clock.minutes < start ? clock.date : null;
}
```

Create `src/lib/useDeepWorkNotice.ts`:

```ts
import { useEffect } from 'react';
import { noticeDue } from '../shared/exec/notice';
import { readStorage, writeStorage } from './safeStorage';
import { useToday } from './useToday';

export const NOTICE_FIRED_KEY = 'taskflow.noticeFired';

/** While a tab is open, a browser notification five minutes before deep work, once a day, if permission was given (no service worker). */
export function useDeepWorkNotice(): void {
  const { now, settings } = useToday();
  useEffect(() => {
    if (!settings || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const date = noticeDue(now, settings);
    if (date === null || readStorage(NOTICE_FIRED_KEY) === date) return;
    writeStorage(NOTICE_FIRED_KEY, date);
    new Notification('Deep work begins in 5 minutes');
  }, [now, settings]);
}
```

Create `src/components/today/NoticePrompt.tsx`:

```tsx
import { useState } from 'react';
import { readStorage, writeStorage } from '../../lib/safeStorage';

export const NOTICE_ASKED_KEY = 'taskflow.noticeAsked';

/** Permission is asked once, from Today (spec C "Deep Work"): a choice either way is remembered and the prompt never returns. */
export function NoticePrompt() {
  const [asked, setAsked] = useState(() => readStorage(NOTICE_ASKED_KEY) === 'yes');
  if (asked || typeof Notification === 'undefined' || Notification.permission !== 'default') return null;
  const answer = (allow: boolean) => {
    writeStorage(NOTICE_ASKED_KEY, 'yes');
    setAsked(true);
    if (allow) void Notification.requestPermission();
  };
  return (
    <section aria-label="Deep work notice" className="flex flex-wrap items-center gap-3 text-sm text-ink-muted">
      <p className="flex-1">Get a notice 5 minutes before deep work?</p>
      <button type="button" onClick={() => answer(true)} className="rounded border border-line px-2 py-1 dark:border-ink-muted">Turn on</button>
      <button type="button" onClick={() => answer(false)} className="rounded border border-line px-2 py-1 dark:border-ink-muted">Not now</button>
    </section>
  );
}
```

Create `src/lib/useFocusKey.ts`:

```ts
import { useEffect } from 'react';
import { isEditableTarget } from './keys';

/** A bare `f` anywhere, except while typing, opens focus (spec C "Keyboard"). */
export function useFocusKey(onTrigger: () => void): void {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (event.key !== 'f' || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) return;
      event.preventDefault();
      onTrigger();
    };
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, [onTrigger]);
}
```

Create `src/components/FocusShortcut.tsx`:

```tsx
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDay } from '../api/days';
import { useFocusKey } from '../lib/useFocusKey';
import { useToday } from '../lib/useToday';

/** `f` opens focus when today has a work or build Must Ship to focus on; otherwise it does nothing. */
export function FocusShortcut() {
  const navigate = useNavigate();
  const { today, ready } = useToday();
  const day = useDay(today, { enabled: ready });
  const available = Boolean(day.data?.mustShip ?? day.data?.buildMustShip);
  const trigger = useCallback(() => {
    if (available) navigate('/focus');
  }, [available, navigate]);
  useFocusKey(trigger);
  return null;
}
```

In `src/app/Shell.tsx`, add the imports and render both, right after `<CaptureShortcut />`:

```tsx
import { FocusShortcut } from '../components/FocusShortcut';
import { useDeepWorkNotice } from '../lib/useDeepWorkNotice';
```

Call the hook at the top of `Shell()` (`useDeepWorkNotice();`) and add `<FocusShortcut />` after `<CaptureShortcut />`.

In `src/screens/Today.tsx`, add `import { NoticePrompt } from '../components/today/NoticePrompt';` and, inside the loaded fragment after `<Waiting … />`, add `<NoticePrompt />`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/shared/exec/notice.test.ts src/lib/useDeepWorkNotice.test.tsx src/components/today/NoticePrompt.test.tsx src/components/FocusShortcut.test.tsx`
Expected: PASS.

Run: `npx vitest run`
Expected: all green. The Shell now reads today's day and the schedule on every shell screen. Against the Phase 4 suite no existing test needed a change (their fake servers answer unknown URLs with `[]`); if one does, change only its stub, and name each test you touched in the report. Then `npm run lint && npm run build` must be clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/safeStorage.ts src/lib/useFocusKey.ts src/lib/useDeepWorkNotice.ts src/components/FocusShortcut.tsx src/components/today/NoticePrompt.tsx src/shared/exec/notice.ts src/app/Shell.tsx src/screens/Today.tsx src/shared/exec/notice.test.ts src/lib/useDeepWorkNotice.test.tsx src/components/today/NoticePrompt.test.tsx src/components/FocusShortcut.test.tsx
git commit -m "feat: open focus with f and give a five-minute notice before deep work"
```

---

### Task 12: The week grid

**Files:**
- Create: `src/components/week/WeekGrid.tsx`, `src/components/week/BlockPanel.tsx`, `src/components/week/WeekDeepWork.tsx`
- Modify: `src/lib/labels.ts` (add `BLOCK_RESULT_LABELS`)
- Test: `src/components/week/BlockPanel.test.tsx`, `src/components/week/WeekDeepWork.test.tsx`

**Interfaces:**
- Consumes: `useSettings`; `useBlocks`, `useCreateBlock`, `useUpdateBlock` (Task 7); `defaultBlocksFor`, `withoutPlaced`, `weekRange`, `gridRange`, `blockBox`, `type ProposedBlock` (Task 2); `dayLabel` (`today.ts`); `contextOf` (`week.ts`); `addDays`; `useReportError`; `LoadError`; `ContextToggle`; `type Context`, `Outcome` (`schemas.ts`); `type DeepWorkBlock` (`todaySchemas.ts`). Fixtures: `SETTINGS`, `makeBlock`, `makeOutcome`.
- Produces:
  - `BLOCK_RESULT_LABELS: Record<'completed' | 'progress' | 'blocked' | 'abandoned', string>` (`Completed`, `Made progress`, `Blocked`, `Abandoned`)
  - `WeekGrid({ weekStartDate, blocks, proposals, outcomes, onSelect, onAdd })` and `type GridTarget`. It draws seven day columns, each a region named `dayLabel(date)` (for example "Tuesday 29 September"), with a button "Add a block on <day>" and one button per block.
    - Block button name: `<day> <start>, <minutes> minutes, <outcome title or "no outcome">`, plus `, suggested` for a proposal, `, running` for a live block, or `, <result label>` for a finished one.
  - `BlockPanel({ target, outcomes, pending, onSave, onClose })` and `type PanelTarget`, `type PanelFields`:
    - A form "Deep work block" with "Outcome" (active, slotted outcomes of the block's context only), "Start", "Minutes", and a Work/Build toggle for a new block.
    - Buttons "Save block" and "Cancel".
    - A block that has started is read-only: "Running now." or "Finished: <result>", with "Close".
  - `WeekDeepWork({ weekStartDate, today, outcomes, flagMissing? })`: a region "Deep work" with the grid, the panel, and, with `flagMissing`, "No time yet: <titles>" or "Every outcome has time." It reads the week's blocks and the schedule, showing "Loading deep work…" or `LoadError`.
    - Proposals dated before `today` are not offered.
    - Saving a proposal or a new block POSTs `{ date, context, plannedStart, plannedMinutes, outcomeId }`; saving a saved block PATCHes `{ plannedStart, plannedMinutes, outcomeId }`.

- [ ] **Step 1: Write the failing tests**

Create `src/components/week/BlockPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BlockPanel } from './BlockPanel';
import { makeBlock, makeOutcome } from '../../test/fixtures';

const office = makeOutcome({ title: 'Supplier plan confirmed', category: 'office', slot: 1 });
const build = makeOutcome({ title: 'Healify beta live', category: 'business', slot: 2 });
const killed = makeOutcome({ title: 'Killed one', category: 'office', slot: null, status: 'killed' });
const outcomes = [office, build, killed];
const proposal = { date: '2026-09-29', context: 'work' as const, plannedStart: '08:35', plannedMinutes: 90 };

describe('BlockPanel', () => {
  it('offers only active outcomes of the block\'s context, and saves what was chosen', async () => {
    const onSave = vi.fn();
    render(<BlockPanel target={{ kind: 'proposal', proposal }} outcomes={outcomes} pending={false} onSave={onSave} onClose={vi.fn()} />);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['No outcome', 'Supplier plan confirmed']);
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Supplier plan confirmed');
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '60' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    expect(onSave).toHaveBeenCalledWith({ context: 'work', plannedStart: '08:35', plannedMinutes: 60, outcomeId: office.id });
  });

  it('lets a new block choose its context, which changes the outcomes on offer', async () => {
    const onSave = vi.fn();
    render(<BlockPanel target={{ kind: 'new', date: '2026-10-02' }} outcomes={outcomes} pending={false} onSave={onSave} onClose={vi.fn()} />);
    expect(screen.getByLabelText('Start')).toHaveValue('09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['No outcome', 'Healify beta live']);
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    expect(onSave).toHaveBeenCalledWith({ context: 'build', plannedStart: '09:00', plannedMinutes: 60, outcomeId: null });
  });

  it('refuses a length outside 15 to 600 minutes and disables saving while pending', () => {
    const { rerender } = render(<BlockPanel target={{ kind: 'proposal', proposal }} outcomes={outcomes} pending={false} onSave={vi.fn()} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '10' } });
    expect(screen.getByRole('button', { name: 'Save block' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '90' } });
    expect(screen.getByRole('button', { name: 'Save block' })).toBeEnabled();
    rerender(<BlockPanel target={{ kind: 'proposal', proposal }} outcomes={outcomes} pending onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save block' })).toBeDisabled();
  });

  it('accepts the start and length the defaults use, which are not multiples of 15 (08:35 for 90, or 50 minutes)', () => {
    render(<BlockPanel target={{ kind: 'proposal', proposal: { date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 } }} outcomes={outcomes} pending={false} onSave={vi.fn()} onClose={vi.fn()} />);
    expect((screen.getByLabelText('Start') as HTMLInputElement).checkValidity()).toBe(true);
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '50' } });
    // A browser runs this check on submit and silently refuses the form when it fails; a `step` on the field breaks it.
    expect((screen.getByLabelText('Minutes') as HTMLInputElement).checkValidity()).toBe(true);
  });

  it('shows a running or finished block as read-only', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<BlockPanel target={{ kind: 'block', block: makeBlock({ startedAt: '2026-09-29T03:35:00.000Z' }) }} outcomes={outcomes} pending={false} onSave={vi.fn()} onClose={onClose} />);
    expect(screen.getByText('Running now.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save block' })).toBeNull();
    rerender(<BlockPanel target={{ kind: 'block', block: makeBlock({ startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T04:20:00.000Z', result: 'blocked' }) }} outcomes={outcomes} pending={false} onSave={vi.fn()} onClose={onClose} />);
    expect(screen.getByText('Finished: Blocked')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });
});
```

Create `src/components/week/WeekDeepWork.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WeekDeepWork } from './WeekDeepWork';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json, failure } from '../../test/fetch';
import { SETTINGS, makeBlock, makeOutcome } from '../../test/fixtures';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';

afterEach(() => vi.unstubAllGlobals());

const office = makeOutcome({ title: 'Supplier plan confirmed', category: 'office', slot: 1 });
const business = makeOutcome({ title: 'Healify beta live', category: 'business', slot: 2 });

/** A tiny server: creating a block adds it to the list, patching one changes it. */
function server(initial: DeepWorkBlock[] = [], respond?: (url: string, init?: RequestInit) => Response | undefined) {
  const state = { blocks: initial };
  const calls = stubFetch((url, init) => {
    const custom = respond?.(url, init);
    if (custom) return custom;
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url.startsWith('/api/exec/deep-work?')) return json(state.blocks);
    if (url === '/api/exec/deep-work' && init?.method === 'POST') {
      const made = makeBlock(JSON.parse(String(init.body)));
      state.blocks = [...state.blocks, made];
      return json(made, 201);
    }
    const patch = url.match(/\/deep-work\/([^/]+)$/);
    if (patch && init?.method === 'PATCH') {
      state.blocks = state.blocks.map((block) => (block.id === patch[1] ? { ...block, ...JSON.parse(String(init.body)) } : block));
      return json(state.blocks.find((block) => block.id === patch[1]));
    }
    return json([]);
  });
  return calls;
}

const show = (flagMissing = false) =>
  renderWithProviders(<WeekDeepWork weekStartDate="2026-09-27" today="2026-09-29" outcomes={[office, business]} flagMissing={flagMissing} />);
const day = (name: string) => screen.findByRole('region', { name });

describe('WeekDeepWork', () => {
  it('lays the default blocks over the days from today on, as suggestions', async () => {
    server();
    show();
    const tuesday = await day('Tuesday 29 September');
    expect(within(tuesday).getByRole('button', { name: 'Tuesday 29 September 06:30, 50 minutes, no outcome, suggested' })).toBeInTheDocument();
    expect(within(tuesday).getByRole('button', { name: 'Tuesday 29 September 08:35, 90 minutes, no outcome, suggested' })).toBeInTheDocument();
    expect(within(await day('Monday 28 September')).getAllByRole('button')).toHaveLength(1);
    expect(within(await day('Sunday 27 September')).getAllByRole('button')).toHaveLength(1);
    expect(within(await day('Saturday 3 October')).getByRole('button', { name: /09:00, 180 minutes/ })).toBeInTheDocument();
  });

  it('saves a suggestion by assigning an outcome, and the saved block replaces it', async () => {
    const calls = server();
    show();
    const tuesday = await day('Tuesday 29 September');
    await userEvent.click(within(tuesday).getByRole('button', { name: /08:35, 90 minutes, no outcome, suggested/ }));
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Supplier plan confirmed');
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: office.id })
    );
    expect(await within(tuesday).findByRole('button', { name: 'Tuesday 29 September 08:35, 90 minutes, Supplier plan confirmed' })).toBeInTheDocument();
    expect(within(tuesday).queryByRole('button', { name: /08:35.*suggested/ })).toBeNull();
    await waitFor(() => expect(screen.queryByRole('form', { name: 'Deep work block' })).toBeNull());
  });

  it('changes a saved block\'s outcome and length with a PATCH', async () => {
    const saved = makeBlock({ date: '2026-09-30' });
    const calls = server([saved]);
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Wednesday 30 September 08:35, 90 minutes, no outcome' }));
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Supplier plan confirmed');
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '60' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    await waitFor(() => expect(calls.find((call) => call.method === 'PATCH')).toMatchObject({ url: `/api/exec/deep-work/${saved.id}`, body: { plannedStart: '08:35', plannedMinutes: 60, outcomeId: office.id } }));
    expect(await screen.findByRole('button', { name: 'Wednesday 30 September 08:35, 60 minutes, Supplier plan confirmed' })).toBeInTheDocument();
  });

  it('adds an extra block on a day, choosing its context', async () => {
    const calls = server();
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Add a block on Friday 2 October' }));
    await userEvent.click(screen.getByRole('button', { name: 'Build' }));
    await userEvent.selectOptions(screen.getByLabelText('Outcome'), 'Healify beta live');
    fireEvent.change(screen.getByLabelText('Start'), { target: { value: '14:00' } });
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '45' } });
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    await waitFor(() =>
      expect(calls.find((call) => call.method === 'POST')?.body).toEqual({ date: '2026-10-02', context: 'build', plannedStart: '14:00', plannedMinutes: 45, outcomeId: business.id })
    );
  });

  it('shows a finished block with its result and opens it read-only', async () => {
    const finished = makeBlock({ date: '2026-09-30', outcomeId: office.id, startedAt: '2026-09-30T03:35:00.000Z', endedAt: '2026-09-30T04:20:00.000Z', result: 'progress' });
    server([finished]);
    show();
    await userEvent.click(await screen.findByRole('button', { name: 'Wednesday 30 September 08:35, 90 minutes, Supplier plan confirmed, Made progress' }));
    expect(screen.getByText('Finished: Made progress')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save block' })).toBeNull();
  });

  it('says why a save failed and keeps the panel open', async () => {
    server([], (_url, init) => (init?.method === 'POST' ? failure(400, 'VALIDATION', 'that time overlaps another block') : undefined));
    show();
    await userEvent.click(await screen.findByRole('button', { name: /Tuesday 29 September 08:35.*suggested/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save block' }));
    expect(await screen.findByText('Could not save the block: that time overlaps another block')).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Deep work block' })).toBeInTheDocument();
  });

  it('waits for the blocks, and says so when the blocks or the schedule cannot be read', async () => {
    server();
    const { unmount } = show();
    expect(screen.getByText('Loading deep work…')).toBeInTheDocument();
    await day('Tuesday 29 September');
    unmount();
    vi.unstubAllGlobals();
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : failure(500, 'INTERNAL', 'internal server error')));
    const failed = show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load deep work: internal server error');
    failed.unmount();
    vi.unstubAllGlobals();
    stubFetch((url) => (url.endsWith('/settings') ? failure(500, 'INTERNAL', 'internal server error') : json([])));
    show();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the schedule: internal server error');
  });

  it('flags the outcomes that still have no block, and says when every one has time', async () => {
    server([makeBlock({ date: '2026-09-30', outcomeId: office.id })]);
    const { unmount } = show(true);
    expect(await screen.findByText('No time yet: Healify beta live')).toBeInTheDocument();
    unmount();
    vi.unstubAllGlobals();
    server([makeBlock({ date: '2026-09-30', outcomeId: office.id }), makeBlock({ date: '2026-10-03', context: 'build', plannedStart: '09:00', outcomeId: business.id })]);
    show(true);
    expect(await screen.findByText('Every outcome has time.')).toBeInTheDocument();
  });

  it('shows no flags unless asked to', async () => {
    server();
    show(false);
    await day('Tuesday 29 September');
    expect(screen.queryByText(/No time yet/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/week/BlockPanel.test.tsx src/components/week/WeekDeepWork.test.tsx`
Expected: FAIL, because the components do not exist.

- [ ] **Step 3: Add the labels and write the components**

In `src/lib/labels.ts`, change the todaySchemas type import to `import type { DeepWorkBlock, MustShipStatus } from '../shared/exec/todaySchemas';` and append:

```ts
export const BLOCK_RESULT_LABELS: Record<NonNullable<DeepWorkBlock['result']>, string> = {
  completed: 'Completed',
  progress: 'Made progress',
  blocked: 'Blocked',
  abandoned: 'Abandoned',
};
```

Create `src/components/week/WeekGrid.tsx`:

```tsx
import { BLOCK_RESULT_LABELS } from '../../lib/labels';
import { addDays } from '../../shared/exec/dates';
import { blockBox, gridRange, type ProposedBlock } from '../../shared/exec/deepWork';
import { dayLabel } from '../../shared/exec/today';
import type { Outcome } from '../../shared/exec/schemas';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';

export type GridTarget = { kind: 'block'; block: DeepWorkBlock } | { kind: 'proposal'; proposal: ProposedBlock };

type Props = {
  weekStartDate: string;
  blocks: DeepWorkBlock[];
  proposals: ProposedBlock[];
  outcomes: Outcome[];
  onSelect: (target: GridTarget) => void;
  onAdd: (date: string) => void;
};

const TONES = {
  saved: 'bg-ink text-paper dark:bg-paper dark:text-ink',
  suggested: 'border border-dashed border-ink-muted text-ink-muted',
  done: 'border border-line bg-paper-raised text-ink-muted dark:border-ink-muted dark:bg-ink',
};

const shortDay = (date: string): string => `${dayLabel(date).slice(0, 3)} ${Number(date.slice(8))}`;

type CellProps = { label: string; text: string; tone: keyof typeof TONES; box: { top: number; height: number }; onClick: () => void };

function Cell({ label, text, tone, box, onClick }: CellProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ top: `${box.top}%`, height: `${box.height}%` }}
      className={`absolute inset-x-0.5 overflow-hidden rounded px-1 text-left text-xs ${TONES[tone]}`}
    >
      {text}
    </button>
  );
}

function statusOf(block: DeepWorkBlock): string {
  if (block.endedAt !== null) return `, ${block.result ? BLOCK_RESULT_LABELS[block.result] : 'finished'}`;
  return block.startedAt !== null ? ', running' : '';
}

/** Spec C "Week" item 4: seven columns over the day's hours. A block is saved, a suggestion is dashed. */
export function WeekGrid({ weekStartDate, blocks, proposals, outcomes, onSelect, onAdd }: Props) {
  const range = gridRange([...blocks, ...proposals]);
  const titles = new Map(outcomes.map((outcome) => [outcome.id, outcome.title]));
  const days = Array.from({ length: 7 }, (_, offset) => addDays(weekStartDate, offset));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] grid-cols-7 gap-1">
        {days.map((date) => (
          <section key={date} aria-label={dayLabel(date)} className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wide text-ink-muted">{shortDay(date)}</h3>
              <button type="button" aria-label={`Add a block on ${dayLabel(date)}`} onClick={() => onAdd(date)} className="px-1 text-xs text-ink-muted hover:text-ink">+</button>
            </div>
            <div className="relative h-[36rem] rounded border border-line dark:border-ink-muted">
              {blocks.filter((block) => block.date === date).map((block) => {
                const title = block.outcomeId ? titles.get(block.outcomeId) ?? null : null;
                return (
                  <Cell
                    key={block.id}
                    tone={block.endedAt !== null ? 'done' : 'saved'}
                    box={blockBox(block.plannedStart, block.plannedMinutes, range)}
                    label={`${dayLabel(date)} ${block.plannedStart}, ${block.plannedMinutes} minutes, ${title ?? 'no outcome'}${statusOf(block)}`}
                    text={`${block.plannedStart} ${title ?? ''}`}
                    onClick={() => onSelect({ kind: 'block', block })}
                  />
                );
              })}
              {proposals.filter((proposal) => proposal.date === date).map((proposal) => (
                <Cell
                  key={`${proposal.context}-${proposal.plannedStart}`}
                  tone="suggested"
                  box={blockBox(proposal.plannedStart, proposal.plannedMinutes, range)}
                  label={`${dayLabel(date)} ${proposal.plannedStart}, ${proposal.plannedMinutes} minutes, no outcome, suggested`}
                  text={`${proposal.plannedStart} ${proposal.context === 'build' ? 'Build' : 'Work'}`}
                  onClick={() => onSelect({ kind: 'proposal', proposal })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
```

Create `src/components/week/BlockPanel.tsx`:

```tsx
import { useId, useState, type FormEvent } from 'react';
import { BLOCK_RESULT_LABELS } from '../../lib/labels';
import { dayLabel } from '../../shared/exec/today';
import { contextOf } from '../../shared/exec/week';
import type { ProposedBlock } from '../../shared/exec/deepWork';
import type { Context, Outcome } from '../../shared/exec/schemas';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';
import { ContextToggle } from '../ContextToggle';

export type PanelTarget = { kind: 'block'; block: DeepWorkBlock } | { kind: 'proposal'; proposal: ProposedBlock } | { kind: 'new'; date: string };
export type PanelFields = { context: Context; plannedStart: string; plannedMinutes: number; outcomeId: string | null };
type Props = { target: PanelTarget; outcomes: Outcome[]; pending: boolean; onSave: (fields: PanelFields) => void; onClose: () => void };

const FIELD = 'w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink';

function initial(target: PanelTarget): PanelFields & { date: string } {
  if (target.kind === 'block') {
    const { date, context, plannedStart, plannedMinutes, outcomeId } = target.block;
    return { date, context, plannedStart, plannedMinutes, outcomeId };
  }
  if (target.kind === 'proposal') return { ...target.proposal, outcomeId: null };
  return { date: target.date, context: 'work', plannedStart: '09:00', plannedMinutes: 60, outcomeId: null };
}

function ReadOnly({ block, onClose }: { block: DeepWorkBlock; onClose: () => void }) {
  const finished = block.endedAt !== null;
  return (
    <section aria-label="Deep work block" className="space-y-2 rounded-lg border border-line p-4 dark:border-ink-muted">
      <h3 className="font-medium">{dayLabel(block.date)}</h3>
      <p>{finished ? `Finished: ${block.result ? BLOCK_RESULT_LABELS[block.result] : 'stopped'}` : 'Running now.'}</p>
      <button type="button" onClick={onClose} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">Close</button>
    </section>
  );
}

function Editor({ target, outcomes, pending, onSave, onClose }: Props) {
  const id = useId();
  const start = initial(target);
  const [context, setContext] = useState<Context>(start.context);
  const [plannedStart, setPlannedStart] = useState(start.plannedStart);
  const [plannedMinutes, setPlannedMinutes] = useState(String(start.plannedMinutes));
  const [outcomeId, setOutcomeId] = useState(start.outcomeId ?? '');
  const minutes = Number(plannedMinutes);
  const valid = plannedStart !== '' && Number.isInteger(minutes) && minutes >= 15 && minutes <= 600;
  const choices = outcomes.filter((outcome) => outcome.slot !== null && outcome.status === 'active' && contextOf(outcome.category) === context);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (valid && !pending) onSave({ context, plannedStart, plannedMinutes: minutes, outcomeId: outcomeId || null });
  };
  return (
    <form aria-label="Deep work block" onSubmit={submit} className="space-y-2 rounded-lg border border-line p-4 dark:border-ink-muted">
      <h3 className="font-medium">{dayLabel(start.date)} · {context === 'work' ? 'Work' : 'Build'}</h3>
      {target.kind === 'new' && <ContextToggle value={context} onChange={(next) => { setContext(next); setOutcomeId(''); }} />}
      <label htmlFor={`${id}-outcome`} className="block text-sm">Outcome</label>
      <select id={`${id}-outcome`} value={outcomeId} onChange={(e) => setOutcomeId(e.target.value)} className={FIELD}>
        <option value="">No outcome</option>
        {choices.map((outcome) => <option key={outcome.id} value={outcome.id}>{outcome.title}</option>)}
      </select>
      <label htmlFor={`${id}-start`} className="block text-sm">Start</label>
      <input id={`${id}-start`} type="time" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} className={FIELD} />
      <label htmlFor={`${id}-minutes`} className="block text-sm">Minutes</label>
      <input id={`${id}-minutes`} type="number" min={15} max={600} value={plannedMinutes} onChange={(e) => setPlannedMinutes(e.target.value)} className={FIELD} />
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={!valid || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">Save block</button>
        <button type="button" onClick={onClose} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
      </div>
    </form>
  );
}

/** Assign a block to an outcome, or change its time before it starts (spec C "Week" item 4). Once started it is history. */
export function BlockPanel(props: Props) {
  const { target, onClose } = props;
  if (target.kind === 'block' && target.block.startedAt !== null) return <ReadOnly block={target.block} onClose={onClose} />;
  return <Editor {...props} />;
}
```

Create `src/components/week/WeekDeepWork.tsx`:

```tsx
import { useState } from 'react';
import { useCreateBlock, useBlocks, useUpdateBlock } from '../../api/deepWork';
import { useReportError } from '../../api/errors';
import { useSettings } from '../../api/settings';
import { defaultBlocksFor, weekRange, withoutPlaced } from '../../shared/exec/deepWork';
import type { Outcome } from '../../shared/exec/schemas';
import { LoadError } from '../LoadError';
import { BlockPanel, type PanelFields, type PanelTarget } from './BlockPanel';
import { WeekGrid, type GridTarget } from './WeekGrid';

type Props = { weekStartDate: string; today: string; outcomes: Outcome[]; flagMissing?: boolean };

/** The week's deep-work grid with the panel that assigns blocks, and (for /plan step 3) the outcomes still without time. */
export function WeekDeepWork({ weekStartDate, today, outcomes, flagMissing = false }: Props) {
  const settings = useSettings();
  const blocks = useBlocks(weekRange(weekStartDate));
  const create = useCreateBlock();
  const update = useUpdateBlock();
  const report = useReportError();
  const [panel, setPanel] = useState<{ target: PanelTarget; key: number } | null>(null);
  const open = (target: PanelTarget) => setPanel((current) => ({ target, key: (current?.key ?? 0) + 1 }));

  if (settings.isError) return <LoadError what="the schedule" error={settings.error} onRetry={() => void settings.refetch()} />;
  if (blocks.isError) return <LoadError what="deep work" error={blocks.error} onRetry={() => void blocks.refetch()} />;
  if (!settings.data || !blocks.data) return <p className="text-ink-muted">Loading deep work…</p>;

  const proposals = withoutPlaced(defaultBlocksFor(weekStartDate, settings.data), blocks.data).filter((proposal) => proposal.date >= today);
  const active = outcomes.filter((outcome) => outcome.slot !== null && outcome.status === 'active');
  const flagged = active.filter((outcome) => !blocks.data.some((block) => block.outcomeId === outcome.id));
  const pick = (target: GridTarget) => open(target);

  const save = (fields: PanelFields) => {
    if (!panel) return;
    const settle = { onSuccess: () => setPanel(null), onError: report('save the block') };
    const { target } = panel;
    if (target.kind === 'block') {
      update.mutate({ id: target.block.id, patch: { plannedStart: fields.plannedStart, plannedMinutes: fields.plannedMinutes, outcomeId: fields.outcomeId } }, settle);
      return;
    }
    const date = target.kind === 'proposal' ? target.proposal.date : target.date;
    create.mutate({ date, context: fields.context, plannedStart: fields.plannedStart, plannedMinutes: fields.plannedMinutes, outcomeId: fields.outcomeId }, settle);
  };

  return (
    <section aria-label="Deep work" className="space-y-3">
      <h2 className="text-xl font-medium">Deep work</h2>
      <WeekGrid weekStartDate={weekStartDate} blocks={blocks.data} proposals={proposals} outcomes={outcomes} onSelect={pick} onAdd={(date) => open({ kind: 'new', date })} />
      {panel && <BlockPanel key={panel.key} target={panel.target} outcomes={outcomes} pending={create.isPending || update.isPending} onSave={save} onClose={() => setPanel(null)} />}
      {flagMissing && active.length > 0 && <p className="text-sm text-ink-muted">{flagged.length > 0 ? `No time yet: ${flagged.map((outcome) => outcome.title).join(', ')}` : 'Every outcome has time.'}</p>}
    </section>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/week`
Expected: PASS.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/labels.ts src/components/week/WeekGrid.tsx src/components/week/BlockPanel.tsx src/components/week/WeekDeepWork.tsx src/components/week/BlockPanel.test.tsx src/components/week/WeekDeepWork.test.tsx
git commit -m "feat: add the week grid with suggested blocks and a panel to assign them to outcomes"
```

---

### Task 13: Deep work on the Week screen

**Files:**
- Modify: `src/screens/Week.tsx`, `src/components/week/WeekSlots.tsx`, `src/components/outcomes/OutcomeCard.tsx`
- Test: `src/components/outcomes/OutcomeCard.test.tsx`, `src/screens/Week.test.tsx` (append)

**Interfaces:**
- Consumes: `WeekDeepWork` (Task 12); `useBlocks` (Task 7); `minutesByOutcome`, `weekRange` (Task 2); fixtures `makeBlock`.
- Produces:
  - `OutcomeCard` gains an optional `deepWork?: { planned: number; done: number }`. With it, the card shows `Deep work <planned> min planned · <done> min done`, or "No time allocated" when nothing is planned (spec C "Week" item 2, §5). Without it the card shows nothing about time.
  - `WeekSlots` reads the week's blocks and feeds each card. While the blocks are loading or failed it passes nothing, so a card never says "No time allocated" on missing data.
  - `/week` shows the grid region "Deep work" between the outcome cards and the tasks.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/outcomes/OutcomeCard.test.tsx`, reusing the file's existing imports (`renderWithProviders`, `makeOutcome`, `screen`, `vi`, `OutcomeCard`):

```tsx
describe('OutcomeCard deep work', () => {
  it('shows planned and done minutes, says when no time is allocated, and shows nothing while unknown', () => {
    const outcome = makeOutcome({ title: 'Supplier plan confirmed' });
    const { unmount } = renderWithProviders(<OutcomeCard outcome={outcome} onUpdate={vi.fn()} onKill={vi.fn()} deepWork={{ planned: 180, done: 95 }} />);
    expect(screen.getByText('Deep work 180 min planned · 95 min done')).toBeInTheDocument();
    unmount();
    const empty = renderWithProviders(<OutcomeCard outcome={outcome} onUpdate={vi.fn()} onKill={vi.fn()} deepWork={{ planned: 0, done: 0 }} />);
    expect(screen.getByText('No time allocated')).toBeInTheDocument();
    empty.unmount();
    renderWithProviders(<OutcomeCard outcome={outcome} onUpdate={vi.fn()} onKill={vi.fn()} />);
    expect(screen.queryByText(/No time allocated|min planned/)).toBeNull();
  });
});
```

Append to `src/screens/Week.test.tsx`, inside `describe('/week', …)`, adding `makeBlock` to its fixtures import and using the file's existing `three()` helper and fake clock:

```tsx
  it('shows minutes planned and done on each card, and "No time allocated" without a block', async () => {
    const outcomes = three();
    const blocks = [makeBlock({ outcomeId: outcomes[0].id, plannedMinutes: 90, startedAt: '2026-09-22T03:35:00.000Z', endedAt: '2026-09-22T04:15:00.000Z', result: 'progress' })];
    stubFetch((url) =>
      url.endsWith('/settings') ? json(SETTINGS) : url.startsWith('/api/exec/weeks?') ? json(makeLookup({ current: makeWeekView(outcomes) })) : url.startsWith('/api/exec/deep-work?') ? json(blocks) : json([])
    );
    renderRoute('/week');
    const first = await screen.findByRole('article', { name: 'A' });
    expect(await within(first).findByText('Deep work 90 min planned · 40 min done')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'B' })).getByText('No time allocated')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Deep work' })).toBeInTheDocument();
  });

  it('says nothing about time on the cards when the blocks cannot be read, and reports it in the grid', async () => {
    stubFetch((url) =>
      url.endsWith('/settings')
        ? json(SETTINGS)
        : url.startsWith('/api/exec/weeks?')
          ? json(makeLookup({ current: makeWeekView(three()) }))
          : url.startsWith('/api/exec/deep-work?')
            ? failure(500, 'INTERNAL', 'internal server error')
            : json([])
    );
    renderRoute('/week');
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load deep work: internal server error');
    expect(screen.queryByText('No time allocated')).toBeNull();
  });
```

(`failure` is already imported in that file from Phase 4's Task 14; add it to the import if it is not.)

**Change one existing test.** The Phase 4 test 'says so when the week cannot be read' stubs every request except the schedule as failing, so `/week` now shows two alerts: the week's and the grid's. Its last line, `expect(await screen.findByRole('alert')).toHaveTextContent('Could not load the week: internal server error');`, becomes:

```tsx
    expect(await screen.findByText('Could not load the week: internal server error')).toBeInTheDocument();
```

Change nothing else in that test.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/outcomes/OutcomeCard.test.tsx src/screens/Week.test.tsx`
Expected: FAIL. There is no `deepWork` prop and `/week` has no "Deep work" region.

- [ ] **Step 3: Show the minutes and the grid**

In `src/components/outcomes/OutcomeCard.tsx`, extend `Props` with `deepWork?: { planned: number; done: number }`, destructure it in `OutcomeCard({ outcome, onUpdate, onKill, mustShipCount, deepWork })`, and add directly after the `Must Ships shipped` line:

```tsx
      {deepWork && <p className="text-sm text-ink-muted">{deepWork.planned === 0 ? 'No time allocated' : `Deep work ${deepWork.planned} min planned · ${deepWork.done} min done`}</p>}
```

In `src/components/week/WeekSlots.tsx`:
- Add the imports:

```tsx
import { useBlocks } from '../../api/deepWork';
import { minutesByOutcome, weekRange } from '../../shared/exec/deepWork';
```

- Change `Slots` to take the minutes:

```tsx
type Minutes = Record<string, { planned: number; done: number }>;

function Slots({ outcomes, mustShips, minutes }: { outcomes: Outcome[]; mustShips: MustShip[]; minutes: Minutes | null }) {
```

  and add, right after `mustShipCount={countFor(mustShips, outcome.id)}`:

```tsx
            deepWork={minutes ? minutes[outcome.id] ?? { planned: 0, done: 0 } : undefined}
```

- In `WeekSlots`, add below the `useMustShips` line:

```tsx
  const blocks = useBlocks(weekRange(weekStartDate), { enabled: view !== null });
  const minutes = blocks.data ? minutesByOutcome(blocks.data) : null;
```

  and render `<Slots outcomes={slotted} mustShips={mustShips} minutes={minutes} />`.

In `src/screens/Week.tsx`, add `import { WeekDeepWork } from '../components/week/WeekDeepWork';` and, between `<WeekSlots … />` and `<WeekTasks … />`:

```tsx
      <WeekDeepWork weekStartDate={startDate} today={today} outcomes={view?.outcomes ?? []} />
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/outcomes src/screens/Week.test.tsx src/app/App.test.tsx`
Expected: PASS.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean. A test whose fake server answers `/deep-work?…` with something that is not a list of blocks would fail now; the existing Week tests answer unknown URLs with `[]`, so none should.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Week.tsx src/components/week/WeekSlots.tsx src/components/outcomes/OutcomeCard.tsx src/components/outcomes/OutcomeCard.test.tsx src/screens/Week.test.tsx
git commit -m "feat: show the deep-work grid on the Week and the time behind each outcome"
```

---

### Task 14: Sunday planning step 3

**Files:**
- Create: `src/components/plan/PlanTime.tsx`
- Modify: `src/screens/Plan.tsx`, `e2e/week.spec.ts`
- Test: `src/components/plan/PlanTime.test.tsx`, `src/screens/Plan.test.tsx` (append and change as listed)

**Interfaces:**
- Consumes: `WeekDeepWork` (Task 12); `type WeekView` (`schemas.ts`); the Phase 3–4 `Plan` screen.
- Produces:
  - `PlanTime({ view, today, weekStartDate, onDone })`: a section headed "When will you actually work on these?" with the grid and the outcomes still without time flagged, and the button "Done planning time". The button is always enabled: the flag never blocks.
  - `/plan` now runs carry over, choose, then **time**, then "Week N is planned.". The time step shows as soon as three outcomes are chosen (also on a reload) or "Done choosing" is pressed.

- [ ] **Step 1: Write the failing tests**

Create `src/components/plan/PlanTime.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlanTime } from './PlanTime';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json } from '../../test/fetch';
import { SETTINGS, makeBlock, makeOutcome, makeWeekView } from '../../test/fixtures';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';

afterEach(() => vi.unstubAllGlobals());

const office = makeOutcome({ title: 'Supplier plan confirmed', category: 'office', slot: 1 });
const business = makeOutcome({ title: 'Healify beta live', category: 'business', slot: 2 });

function show(blocks: DeepWorkBlock[]) {
  stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : url.startsWith('/api/exec/deep-work?') ? json(blocks) : json([])));
  const onDone = vi.fn();
  renderWithProviders(<PlanTime view={makeWeekView([office, business])} today="2026-09-29" weekStartDate="2026-09-27" onDone={onDone} />);
  return onDone;
}

describe('PlanTime', () => {
  it('asks when the work will happen, flags outcomes without time, and never blocks finishing', async () => {
    const onDone = show([makeBlock({ date: '2026-09-30', outcomeId: office.id })]);
    expect(screen.getByRole('heading', { level: 2, name: 'When will you actually work on these?' })).toBeInTheDocument();
    expect(await screen.findByText('No time yet: Healify beta live')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Done planning time' }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('says every outcome has time once each one has a block', async () => {
    show([makeBlock({ date: '2026-09-30', outcomeId: office.id }), makeBlock({ date: '2026-10-03', context: 'build', plannedStart: '09:00', outcomeId: business.id })]);
    expect(await screen.findByText('Every outcome has time.')).toBeInTheDocument();
  });
});
```

In `src/screens/Plan.test.tsx`:

- **Change the existing tests.** Every existing test that reaches the heading "Week N is planned." or the region "Next Must Ship" after choosing three outcomes, or after pressing "Done choosing", must first click "Done planning time". Add exactly `await userEvent.click(await screen.findByRole('button', { name: 'Done planning time' }));` immediately before that first assertion, in each such test, and change nothing else in them. That covers the tests currently at lines 49 (the three-outcome journey), 97 (fewer than three), 105 and 121 (Next Must Ship).
- In the three-outcome journey test, also add, directly before that click, the step-3 assertion:

```tsx
    expect(await screen.findByRole('heading', { level: 2, name: 'When will you actually work on these?' })).toBeInTheDocument();
    expect(await screen.findByText(/^No time yet: /)).toBeInTheDocument();
```

- Append these tests inside `describe('/plan', …)`:

```tsx
  it('lands on the time step when three outcomes are already chosen, and finishes from there', async () => {
    fakePlanApi(makeLookup({ current: makeWeekView([makeOutcome({ title: 'A', slot: 1 }), makeOutcome({ title: 'B', slot: 2 }), makeOutcome({ title: 'C', slot: 3 })]) }));
    renderRoute('/plan');
    expect(await screen.findByRole('heading', { level: 2, name: 'When will you actually work on these?' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /is planned\./ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Done planning time' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 39 is planned.' })).toBeInTheDocument();
  });

  it('shows the grid with the default blocks from today on', async () => {
    fakePlanApi(makeLookup({ current: makeWeekView([makeOutcome({ title: 'A', slot: 1 }), makeOutcome({ title: 'B', slot: 2 }), makeOutcome({ title: 'C', slot: 3 })]) }));
    renderRoute('/plan');
    const tuesday = await screen.findByRole('region', { name: 'Tuesday 22 September' });
    expect(within(tuesday).getByRole('button', { name: /08:35, 90 minutes, no outcome, suggested/ })).toBeInTheDocument();
    expect(within(await screen.findByRole('region', { name: 'Monday 21 September' })).getAllByRole('button')).toHaveLength(1);
  });
```

In `e2e/week.spec.ts`, in the plan journey, immediately before `await expect(page.getByRole('heading', { level: 2, name: /^Week \d+ is planned\.$/ })).toBeVisible();` add:

```ts
  await expect(page.getByRole('heading', { level: 2, name: 'When will you actually work on these?' })).toBeVisible();
  await page.getByRole('button', { name: 'Done planning time' }).click();
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/plan/PlanTime.test.tsx src/screens/Plan.test.tsx`
Expected: FAIL. `./PlanTime` cannot be resolved, and `/plan` still goes straight to "Week N is planned."

- [ ] **Step 3: Write the step and wire it in**

Create `src/components/plan/PlanTime.tsx`:

```tsx
import type { WeekView } from '../../shared/exec/schemas';
import { WeekDeepWork } from '../week/WeekDeepWork';

type Props = { view: WeekView | null; today: string; weekStartDate: string; onDone: () => void };

/** Step 3 (spec C "Sunday planning"): "if it has no time it is an aspiration". Outcomes without a block are flagged, not blocked. */
export function PlanTime({ view, today, weekStartDate, onDone }: Props) {
  return (
    <section aria-label="Deep work time" className="space-y-3">
      <h2 className="text-xl font-medium">When will you actually work on these?</h2>
      <p className="text-ink-muted">Click a block to give it an outcome. An outcome with no time is an aspiration.</p>
      <WeekDeepWork weekStartDate={weekStartDate} today={today} outcomes={view?.outcomes ?? []} flagMissing />
      <button type="button" onClick={onDone} className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">
        Done planning time
      </button>
    </section>
  );
}
```

In `src/screens/Plan.tsx`:
- Add `import { PlanTime } from '../components/plan/PlanTime';`.
- Change the step type to `type Step = 'carry' | 'choose' | 'time' | 'done';`.
- Replace the `const step: Step = …` line with:

```tsx
  const step: Step =
    chosenStep === 'done' ? 'done' : chosenStep === 'time' || slotted.length === 3 ? 'time' : chosenStep === 'choose' ? 'choose' : natural;
```

- Change `ChooseOutcomes`' `onDone` to `() => setChosenStep('time')`, and add, before the `step === 'done'` line:

```tsx
      {lookup.isSuccess && step === 'time' && <PlanTime view={current} today={today} weekStartDate={startDate} onDone={() => setChosenStep('done')} />}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/plan src/screens/Plan.test.tsx src/app/App.test.tsx`
Expected: PASS.

Run: `npx vitest run && npm run lint && npm run build`
Expected: all green; lint clean; build clean.

Run: `npm run test:e2e`
Expected: 13 passed; then `ls -d "$(node -p 'require("os").tmpdir()')"/taskflow-e2e-* 2>/dev/null | wc -l` prints `0`. If `week.spec.ts` fails on the plan journey, read the Playwright output before changing anything and never loosen an assertion.

- [ ] **Step 5: Commit**

```bash
git add src/components/plan/PlanTime.tsx src/components/plan/PlanTime.test.tsx src/screens/Plan.tsx src/screens/Plan.test.tsx e2e/week.spec.ts
git commit -m "feat: add Sunday planning step 3, assigning deep-work blocks to the week's outcomes"
```

---

### Task 15: The deep-work journeys and README

**Files:**
- Create: `e2e/work-session.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes the running app: `/focus` (Tasks 8–9), the Week grid (Tasks 12–13), and `/api/exec/must-ships`, `/deep-work` and `/tasks`.
- Produces two desktop journeys, in a file that sorts after `week.spec.ts`, whose three outcomes the second journey assigns blocks to: `runs a session …` (start, reload, pause, reload, Blocked) and `assigns a suggested block …`. After this task `npm run test:e2e` runs 15 tests (13 desktop, 2 phone).

- [ ] **Step 1: Write the journeys**

Create `e2e/work-session.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

// These journeys run on the real clock: a block's timestamps come from the server, so a fixed browser
// clock would disagree with them. Whether the session is work or build depends on the hour the suite
// runs, so both of today's Must Ships exist and the assertions never name the context.
// The file sorts after week.spec.ts on purpose: the grid journey assigns blocks to the three outcomes it plans.

const WORK = 'Supplier tracker sent to the top 20';
const BUILD = 'Healify landing page live';
const NEXT = 'Call Bilal about the tracker';

/** Today's date in the server's time zone (Asia/Karachi), as YYYY-MM-DD. */
const todayInKarachi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());
const dayAfter = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
const seconds = (text: string | null) => {
  const [minutes, rest] = (text ?? '').replace('+', '').split(':').map(Number);
  return minutes * 60 + rest;
};

test('runs a session: the timer survives a reload and a pause, and Blocked files a waiting task', async ({ page, request }) => {
  const today = todayInKarachi();
  for (const [title, context] of [[WORK, 'work'], [BUILD, 'build']]) {
    const created = await request.post('/api/exec/must-ships', { data: { title, context, date: today, definitionOfDone: 'It exists' } });
    expect(created.status()).toBe(201);
  }

  await page.goto('/focus');
  const timer = page.getByRole('timer', { name: 'Time remaining' });
  await expect(timer).toBeVisible();
  const first = seconds(await timer.textContent());
  await expect.poll(async () => seconds(await timer.textContent()), { timeout: 10_000 }).toBeLessThan(first);
  const beforeReload = seconds(await timer.textContent());

  await page.reload();
  await expect(timer).toBeVisible();
  expect(seconds(await timer.textContent())).toBeLessThanOrEqual(beforeReload);

  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  const frozen = await timer.textContent();
  await page.waitForTimeout(1500); // a paused timer must not move, and only elapsed time can show that it did not
  await expect(timer).toHaveText(frozen ?? '');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Resume' })).toBeVisible();
  await expect(timer).toHaveText(frozen ?? '');
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();

  await page.getByRole('button', { name: 'Blocked' }).click();
  await page.getByLabel('What blocks it?').fill('Supplier has not replied');
  await page.getByLabel('Who owns the unblock?').fill('Bilal');
  await page.getByLabel('What is the next action?').fill(NEXT);
  await page.getByRole('button', { name: 'File the next action and stop' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Today' })).toBeVisible();

  const waiting = (await (await request.get('/api/exec/tasks?status=waiting')).json()).data;
  expect(waiting).toEqual(expect.arrayContaining([expect.objectContaining({ title: NEXT, ownerName: 'Bilal', status: 'waiting', followUpDate: dayAfter(today) })]));
  const ships = (await (await request.get(`/api/exec/must-ships?date=${today}`)).json()).data as { status: string; blockerOwner: string | null; blockerNextAction: string | null }[];
  const blocked = ships.filter((ship) => ship.status === 'blocked');
  expect(blocked).toHaveLength(1);
  expect(blocked[0]).toMatchObject({ blockerOwner: 'Bilal', blockerNextAction: NEXT });
  const blocks = (await (await request.get(`/api/exec/deep-work?from=${today}&to=${today}`)).json()).data;
  expect(blocks).toHaveLength(1);
  expect(blocks[0]).toMatchObject({ result: 'blocked' });
  expect(blocks[0].endedAt).not.toBeNull();
});

test('assigns a suggested block to an outcome on the Week grid and shows the time on its card', async ({ page }) => {
  await page.goto('/week');
  const grid = page.getByRole('region', { name: 'Deep work', exact: true });
  await expect(grid).toBeVisible();
  await grid.getByRole('button', { name: /suggested$/ }).first().click();
  const outcome = page.getByLabel('Outcome', { exact: true });
  const options = await outcome.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  const chosen = options[1];
  await outcome.selectOption({ label: chosen });
  await page.getByRole('button', { name: 'Save block' }).click();
  await expect(page.getByRole('form', { name: 'Deep work block' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: chosen })).toContainText('min planned');
});
```

- [ ] **Step 2: Run the journeys**

Run: `npm run test:e2e`
Expected: 15 passed (13 desktop, 2 phone). Afterwards `ls -d "$(node -p 'require("os").tmpdir()')"/taskflow-e2e-* 2>/dev/null | wc -l` prints `0` and no server is left running.

If a journey fails, read the Playwright error and trace before changing anything, and never loosen an assertion. A session that starts from `/focus` at an unexpected moment (a weekend, late at night) still has both Must Ships, so a failure there is a real defect: report it as BLOCKED with the output rather than working around it.

- [ ] **Step 3: Update the README**

In `README.md`, after the "Today and the Must Ship" section and before "Checks", add:

```markdown
## Deep work

Opening `/focus` (the "Start deep work" link on Today, or the `f` key) starts
today's block for the moment (work in office hours, build outside them) or
resumes the one already running. The countdown is worked out from the block's
timestamps, so a reload or a second tab loses nothing; past zero it counts up
quietly. Pause when you must, and leave with one of three exits: Completed
ships the Must Ship, Made progress leaves it planned for the shutdown, and
Blocked asks what blocks it, who owns the unblock and the next action, then
files that action as a waiting task to follow up the next day. The grid on
`/week` (and step 3 of `/plan`) lays your default blocks over the week: click
one to give it an outcome, or add another. Outcomes with no block are flagged
as having no time. Allow notifications from Today to get a notice five minutes
before deep work begins.
```

- [ ] **Step 4: Verify and commit**

Run: `npm run lint && npx vitest run`
Expected: clean; all green.

```bash
git add e2e/work-session.spec.ts README.md
git commit -m "test: add the deep-work session journey and the week grid journey"
```

---

### Task 16: Phase 5 verification and report

**Files:** none are created; this is the after-every-phase ritual from the spec (section D).

- [ ] **Step 1: Static checks**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 2: Unit and integration coverage**

Run: `npm run test:coverage`
Expected: every project green, and the 80% line threshold passes. Note the totals and any file under 80% for the report.

- [ ] **Step 3: Journeys**

Run: `npm run test:e2e`
Expected: 15 passed, and `ls -d "$(node -p 'require("os").tmpdir()')"/taskflow-e2e-* 2>/dev/null | wc -l` prints `0`.

- [ ] **Step 4: Manual run against the phase's bar**

The spec's Phase 5 "Done when" is: *A reload mid-session keeps the timer; Blocked files a waiting task; journey: start to Blocked.*

Never touch `data/*.db`. Copy them to a temp directory and point the servers at the copy:
- `D=$(mktemp -d "$(node -p 'require("os").tmpdir()')/taskflow-verify-XXXX")`, then `cp data/execution.db data/taskflow.db "$D"/`.
- Start the API with `DB_PATH="$D/taskflow.db" EXEC_DB_PATH="$D/execution.db" TASKFLOW_API_PORT=4160 npx tsx server/index.ts`.
- Start the web app with `TASKFLOW_API_PORT=4160 npx vite --port 3160 --strictPort`.

Drive it headless with a throwaway Playwright script under `$D`, on the real clock. To make the moment deterministic, set the schedule through the API and restore it afterwards: for a work session `PUT /api/exec/settings` with `officeStart` `00:00`, `officeEnd` `23:59` and today's weekday in `workDays`; for a build session, `workDays` empty. Create a Must Ship for today in the matching context first. Record what you observed at each step, not just pass or fail:
- **Start:** Today's "Start deep work" opens `/focus`, which starts a session (a block is created and started); the subject shows the Must Ship's title, definition and notes; the countdown moves.
- **Reload mid-session:** the countdown carries on from where it was, and reloading while paused stays frozen at the same value.
- **Resume from Today:** while a session is live, Today's card reads "Resume focus" and shows the Must Ship.
- **Exits:**
  - Made progress leaves the Must Ship planned, and Today then offers "Mark shipped" and "Start another session".
  - Completed ships the Must Ship, which Today then shows as Shipped with no "Start deep work".
  - Blocked needs all three answers, and files a waiting task owned by the answer, due tomorrow, linked to the Must Ship, which now reads Blocked.
- **The `f` key:** on Today with a Must Ship, it opens `/focus`.
- **Nothing to do:** with no Must Ship for the moment's context, `/focus` says "Nothing to focus on." and starts nothing.
- **The week grid:** `/week` shows the "Deep work" region with suggestions from today on; assigning a suggestion to an outcome makes the card read "Deep work N min planned"; an outcome with no block reads "No time allocated"; a finished block shows its result.
- **`/plan` step 3:** with three outcomes chosen, the time step appears, lists the outcomes without time, and assigning a block removes one from the list; "Done planning time" ends on "Week N is planned."
- **The five-minute notice:** add an init script that fakes `Notification` with permission `granted` and records calls, set `deepWorkStart` to three minutes from now, open Today, and confirm exactly one call with `Deep work begins in 5 minutes`. Restore the schedule.

Stop both servers (check that `pgrep -af "server/index.ts|vite --port 3160"` shows nothing of yours). Query `"$D/execution.db"` read-only, with better-sqlite3 since the `sqlite3` binary is not installed, for `SELECT date, context, planned_start, planned_minutes, outcome_id IS NOT NULL AS linked, started_at IS NOT NULL AS started, ended_at IS NOT NULL AS ended, result, paused_seconds FROM deep_work_blocks ORDER BY date, planned_start` and `SELECT title, owner_name, follow_up_date, status, must_ship_id IS NOT NULL AS linked FROM tasks WHERE status = 'waiting'`, then run `rm -rf "$D"`.

Reserved for the owner: the phone check over the tailnet from Phases 1–2, and whether the browser notification actually appears on his machine (headless can only prove the call is made). Nothing else in this phase needs the phone.

- [ ] **Step 5: Report**

Write the phase report where the executing skill keeps it. Include:
- the commit list (`git log --oneline main..HEAD`)
- the coverage totals
- the e2e result
- what was verified by hand
- what is reserved for the owner
- anything that did not pass

The spec's Phase 5 row is the reference.

---

## Self-review

**Spec coverage (Phase 5 scope).**
- **"blocks routes":** `GET /deep-work?from&to`, `POST /deep-work`, `PATCH /deep-work/:id`, `POST /:id/start`, `/pause`, `/resume` and `/finish {result, notes, blocker?}` (Tasks 4–6). Finish's rules follow the spec row for row: completed ships the Must Ship; blocked writes the blocker onto it, sets it `blocked`, and files a waiting task owned by the blocker's owner with the follow-up the next day.
- **"`/focus` with the countdown, pause, three exits and the Blocked path":** the derived timer, Pause/Resume, Completed / Made progress / Blocked, and the inline three-question form (Tasks 2, 8, 9). The spec's "starts or resumes today's block for that context" is `planFocus` plus `useFocusSession` (Tasks 3, 8).
- **"the 5-minute notice":** `noticeDue`, the once-a-day hook mounted in the shell, and the once-only permission prompt on Today (Task 11).
- **"the Week grid with block assignment":** `defaultBlocksFor` proposals, the grid, the panel, and minutes on the outcome cards with "No time allocated" (Tasks 2, 12, 13). Drag is left out, with the reason given in Decisions.
- **"`/plan` step 3":** the time step, the flagged outcomes, and the flow order (Task 14).
- **Also delivered:** `f` opens focus (spec C "Keyboard"); the Phase 4 carry-overs (a live-block filter by context, Today's resume and grade cards, the Build card's resume) in Task 10; load and failure states on every new read.
- **Done when:**
  - A reload keeps the timer: `elapsed` tests (Task 2), Focus tests with a paused block (Task 9), the e2e reload (Task 15).
  - Blocked files a waiting task: store (Task 5), route (Task 6), Focus (Task 9), e2e (Task 15).
  - The journey start to Blocked: Task 15.
- **Deferred with their owning phase:** a shutdown that abandons a live block, and Blocked from Today's card (Phase 6); grid accessibility polish and drag (Phase 7).

**Placeholder scan.** There is no TBD or TODO, and every code step carries its code. Where a step edits an existing file it names the exact line to replace or the anchor to insert after; the one rule-based edit (Task 14's existing Plan tests) states the rule and the lines it applies to.

**Type consistency.**
- **Schemas.** `deepWorkSchemas.ts` (Task 1) is the single home of `DeepWorkCreate`/`DeepWorkInput`, `DeepWorkPatch`, `DeepWorkQuery`, `Blocker`, `DeepWorkFinish`/`DeepWorkFinishInput` and `FinishResult`. The store (Task 4), finish (Task 5), routes (Task 6), hooks (Task 7) and components all import them from there. `DeepWorkBlock` and `BLOCK_RESULTS` stay in `todaySchemas.ts`.
- **Timer and grid helpers.** `elapsed`, `countdownLabel`, `defaultBlocksFor`, `withoutPlaced`, `weekRange`, `gridRange`, `blockBox` and `minutesByOutcome` (Task 2) are used unchanged by `FocusTimer` (Task 9), `WeekGrid` and `WeekDeepWork` (Task 12), and `WeekSlots` (Task 13). `ProposedBlock` is produced by `defaultBlocksFor` and consumed by the grid and panel.
- **Focus.** `planFocus` and `newBlockFor` (Task 3) are executed only by `useFocusSession` (Task 8); its `FocusState` is what `Focus.tsx` renders (Task 9). `FocusSubject` flows from Task 3 to Task 9's `FocusSession`.
- **Server.** `invalid` and `pauseFold` are exported by the store (Task 4) and reused by `finish.ts` (Task 5). `finishBlock` returns the `FinishResult` the route serves (Task 6) and the hook types (Task 7).
- **Cache keys.** `deepWorkKey` (Task 7) joins the other keys in `keys.ts`; block writes refresh blocks and the day, and finishing also refreshes Must Ships and tasks.
- **Fixtures.** `makeBlock` (Task 7) is used unchanged in Tasks 8–14.
- **Labels shared with e2e.** These match between the components, the unit tests and `e2e/work-session.spec.ts`:
  - buttons: "Pause", "Resume", "Completed", "Made progress", "Blocked", "File the next action and stop", "Save block", "Done planning time", `Add a block on <day>`
  - fields: "What blocks it?", "Who owns the unblock?", "What is the next action?", "Outcome", "Start", "Minutes"
  - regions: "Deep work", "Focus session", "Deep work notice"
  - the timer named "Time remaining"
  - the texts "Nothing to focus on.", "No time allocated" and "No time yet: …"

**Review Focus coverage.**
1. A reload mid-session, running or paused: `elapsed` (Task 2); the Focus tests with a paused block that stays frozen (Task 9); the e2e pause and reload (Task 15).
2. The same start twice: the store's idempotent start and one-running rule (Task 4); the StrictMode test that yields one create and one start (Task 8).
3. A session left running overnight, or a stale block: the store ignores an earlier date's running block (Task 4); `planFocus` reads only today's blocks (Task 3).
4. Crossing `office_end`: `planFocus` resumes any live block (Task 3); Today's Build card resumes it (Task 10); the work-only `resume` filter (Task 10).
5. Blocked with an empty or over-long field, or a failed finish: the schema (Task 1); the disabled button and whitespace test (Task 9); the store's refusals that change nothing (Task 5); the failed-finish test that keeps the session live (Task 9).
