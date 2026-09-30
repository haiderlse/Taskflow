# Execution System Phase 6: Shutdown and Review — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the loop. `/shutdown` grades today's Must Ship, dispositions everything still open, sets tomorrow's Must Ship and secondaries, and ends on "Tomorrow is ready". `/review` shows the week's scoreboard, the work-day strip and the earlier weeks, and runs the Friday review, grading every outcome and deciding what happens to it. Sunday planning offers the outcomes that review rolled forward.

**Architecture:** Three new server operations follow the Phase 3–5 pattern (zod parse, a store function in one immediate transaction, `insertRow`/`updateRow`): `POST /days/:date/shutdown`, `POST /must-ships/:id/block` and `POST /outcomes/:id/review`, plus the reads `GET /weeks/:id/scoreboard`, `GET /weeks/history` and the stamp `POST /weeks/:id/review`. The numbers come from one pure `scoreboard(rows, schedule)` in `src/shared/exec/`, fed by rows the server gathers, so the timestamp rules are unit-tested without a database. Each ritual step is its own write, so a reload resumes where the data says it stands.

**Tech Stack:** React 19, Vite 6.4, TanStack Query 5, react-router 7, Tailwind v4; Express 5, better-sqlite3 (SQLite 3.53); zod 4.6 (`z.iso.datetime()`, `z.uuid()`); vitest 4.1 (node + jsdom projects), Testing Library, user-event; Playwright 1.63.

**Spec:** `docs/superpowers/specs/2026-09-22-execution-system-design.md` (Phase 6 row in D "Build sequence"; B "Routes", "Scoreboard (§14)", "The limits, as constraints"; C "Shutdown", "Review", "Friday review", "Sunday planning" step 1).

## Global Constraints

Copied from the spec and the earlier plans; every task's requirements include these.

- `/api/exec/*` responses are `{ success: true, data }` or `{ success: false, error, code }` with `code` one of `VALIDATION`, `NOT_FOUND`, `WEEK_FULL`, `DAY_TAKEN`, `SLOT_LIMIT`, `SHUTDOWN_NOT_READY`, `REVIEW_NOT_READY` (new in this phase), `DELETE_NOT_ALLOWED`, `CONSTRAINT`, `INTERNAL`. Error responses never carry a stack, a path, a driver message, or a client-supplied field name or value.
- Every body, query and path parameter is parsed by a zod schema before a store is touched; a route that takes no fields parses its body with `emptyBodySchema`. Schemas for this phase live in `src/shared/exec/reviewSchemas.ts`. Every row write goes through `insertRow`/`updateRow` in `server/exec/rows.ts` or a literal-column parameterised statement. Statements are always parameterised.
- `POST /days/:date/shutdown` is refused with 409 `SHUTDOWN_NOT_READY` while that day's work Must Ship is `planned`. `POST /weeks/:id/review` is refused with 409 `REVIEW_NOT_READY` while a slotted outcome of the week has no `review_grade`. Both are idempotent once they have succeeded.
- Nothing is hard-deleted. A graded outcome keeps its grade, reason and disposition; a rolled or rescheduled one is copied with `rolled_from_id`, and the original keeps its status.
- The scoreboard (spec B "Scoreboard") is computed by the pure `scoreboard()`; timestamps count in the week when their local date in the settings time zone falls inside it.
- Every read shows a loading state and a failure state with a retry. A missing read is never rendered as an empty list or an empty region (`data ?? []` must not decide what the user sees).
- The activity nudge, the one-per-day limits, the two-secondary limit and the deep-work rules from earlier phases are unchanged.
- Time zone Asia/Karachi. All calendar dates are local `YYYY-MM-DD`, timestamps are ISO-8601 UTC set by the server, ids are server-generated UUIDs, and rows are returned camelCase.
- The API always binds `127.0.0.1`. No new environment variables. No new migration: `days.shutdown_at`, `weeks.reviewed_at`, `weeks.review_notes` and the outcome review columns exist in `001_init.sql`.
- New code compiles under `strict: true` with `noUnusedLocals`/`noUnusedParameters` (an unused callback parameter is written `_url`). `npm run lint` is `tsc --noEmit -p tsconfig.app.json`. Legacy code is not modified: `App.tsx`, the root `components/`, `services/`, `utils/`, `server/routes/*` and `server/db/*`.
- Files stay under 400 lines and functions under 50 lines. No `console.log` in application code. Build new objects rather than mutating.
- TDD: the failing test lands before the code that passes it, and the RED run is recorded before the implementation is written. Coverage stays at 80% lines. Phase 5's 725 tests keep passing, except the tests this plan says to change.
- Commit messages follow `<type>: <description>` and contain nothing else: no `Co-Authored-By`, no `Claude-Session`, no trailer of any kind (the user's own git rules disable attribution). Never push.
- Port 3000 on the development machine is held by another project, so `npm run dev` prints another port (3001). The e2e config uses 3100/4150. `os.tmpdir()` is `/mnt/clarus_nvme/tmp`. Manual checks run against a temp copy of `data/`, never the owner's real databases.

## Review Focus

These are the inputs the spec implies but no happy-path test exercises, most likely to bite first. Each has its test in the owning task.

1. **A reload in the middle of a ritual.** Shutdown must land on the first step the data says is unfinished (grade, then the open items); the Friday review must land on the first ungraded outcome. Shutdown screen tests (Task 9), Friday review tests (Task 11).
2. **A roll that cannot land.** Tomorrow already has a Must Ship (`DAY_TAKEN`), or the week a reschedule targets already has three outcomes (`WEEK_FULL`). The grade must still be saved and the refusal said plainly for the Must Ship; the whole review of that outcome must roll back for the reschedule. GradeToday test (Task 7), store test (Task 4).
3. **Timestamps near local midnight.** A kill, roll or delegation at 00:30 Karachi on the week's first Sunday is 19:30 UTC the day before; it belongs to this week, and one at 23:59 on the Saturday before does not. `scoreboard` tests (Task 2).
4. **A session still running at shutdown.** Closing the day ends it as `abandoned`, folds an open pause, and leaves the Must Ship's grade alone. Store test (Task 5).
5. **A second tab or a stale screen.** Grading an outcome twice, blocking a Must Ship that is no longer planned, or closing a day already closed must change nothing and say why (or succeed idempotently for the shutdown and the week stamp). Store tests (Tasks 3, 4, 5).

## Decisions carried into this plan

- **Roll endpoints already exist** (`POST /outcomes/:id/roll`, `/must-ships/:id/roll`, `/tasks/:id/roll`, Phases 3–4). This phase uses them and adds no new roll route.
- **The Friday review writes through one route, `POST /outcomes/:id/review`**, not a sequence of PATCH and POST calls, so a grade and its disposition land together or not at all. Done stands alone and closes the outcome (`status = 'done'`). Partial and Missed need a reason (one of the eleven) and a disposition: **Roll** records `roll_forward` and leaves the outcome for Sunday's carry-over; **Reschedule** copies it now into the later week holding the chosen date, with that date as its target; **Delegate** files a `delegated` task on the named owner with a follow-up date; **Kill** sets `status = 'killed'`, which frees its slot. A graded outcome cannot be graded again. An outcome already `done` can only be graded Done.
- **The scoreboard counts a graded outcome even after Kill frees its slot**: an outcome counts toward the week when it holds a slot or has a `review_grade`. An outcome replaced mid-week (killed with no grade) does not count. Before the review, an outcome already `done` counts as shipped; the spec's rule (`review_grade = 'done'`) takes over once it is graded.
- **Shutdown's Blocked** files the next action as a `waiting` task, as `/focus` does, through `POST /must-ships/:id/block`. Its follow-up is the next work day (a shutdown is at the end of the day). The shared task-filing code moves to `server/exec/tasks/file.ts`, and `deep_work`'s finish uses it too.
- **Closing the day ends a running session as `abandoned`** (Phase 5 reserved that result for this). The Must Ship keeps whatever grade step 1 gave it.
- **Step 2 must be empty before step 3.** Every row offers Tomorrow, Schedule, Delegate, Later and Kill (a waiting row: Tomorrow, Received, Kill), so a row can always be cleared; captured inbox items are only counted, with a link, and may wait.
- **Step 3 is required, step 4 is optional.** The next work day's Must Ship must exist before "Close the day" is offered; a Must Ship rolled in step 1 is already there. The server enforces only the step 1 rule, as the spec says.
- **`GET /weeks/history?before=` lists up to twelve earlier weeks, newest first, each with its scoreboard**, so Review draws its history rows in one read. It is registered before `/weeks/:id` so `history` is never read as an id.
- **Sunday planning step 1** shows last week's numbers in one line. After a Friday review it offers only the outcomes the review rolled forward; before one, every outcome still open (the Phase 3 behaviour).
- **Deferred:** a build block left running into office hours is still not named on Today's work card (Phase 7); editing a grade after the review (never: the review is history).
- **The new e2e spec is `e2e/weekly-loop.spec.ts`.** It runs on a fixed browser clock in June 2027, far from every other journey's dates, and walks Sunday plan → Monday shutdown → Friday review → next Sunday's carry-over.

---

## File Structure

**Shared (`src/shared/exec/`)**
- `api.ts`: `ERROR_CODES` gains `REVIEW_NOT_READY` (Task 1).
- `reviewSchemas.ts` (new): scoreboard, history query, week review, empty body, outcome review and block-result schemas (Task 1).
- `scoreboard.ts` (new): `scoreboard`, `stampInWeek`, `workDaysOf`, `deepWorkLabel`, `scoreLine` (Task 2).
- `shutdown.ts` (new): `openAtShutdown` (Task 6).
- `review.ts` (new): `reviewQueue`, `reviewedOutcomes`, `carryCandidates` (Task 11).

**Server (`server/exec/`)**
- `review/scoreboard.ts`, `review/week.ts` (new); `routes/weeks.ts` (Task 3).
- `tasks/file.ts` (new); `deepWork/finish.ts`; `review/outcome.ts` (new); `routes/outcomes.ts` (Task 4).
- `days/shutdown.ts`, `mustShips/block.ts` (new); `routes/days.ts`, `routes/mustShips.ts` (Task 5).

**Client (`src/`)**
- `api/keys.ts`, `api/review.ts` (new), `api/days.ts`, `api/mustShips.ts`, `api/errors.ts`, `test/fixtures.ts` (Task 6).
- `components/focus/BlockerForm.tsx`, `components/shutdown/GradeToday.tsx` (Task 7).
- `components/shutdown/OpenRow.tsx`, `components/shutdown/OpenItems.tsx` (Task 8).
- `components/shutdown/TomorrowSteps.tsx`, `screens/Shutdown.tsx` (Task 9).
- `components/review/ScoreboardCard.tsx`, `components/review/WeekHistory.tsx`, `screens/Review.tsx` (Task 10).
- `lib/labels.ts`, `components/review/OutcomeReviewForm.tsx`, `components/review/FridayReview.tsx`, `screens/Review.tsx` (Task 11).
- `components/plan/CarryOver.tsx`, `screens/Plan.tsx` (Task 12).

**E2E:** `e2e/weekly-loop.spec.ts` (new) and a README section (Task 13).

---
### Task 1: Review schemas and the REVIEW_NOT_READY code

**Files:**
- Modify: `src/shared/exec/api.ts` (`ERROR_CODES`)
- Create: `src/shared/exec/reviewSchemas.ts`
- Test: `src/shared/exec/reviewSchemas.test.ts`

**Interfaces:**
- Consumes: `calendarDateSchema`, `fields` (`{ uuid, timestamp, longText, … }`), `REVIEW_GRADES`, `REVIEW_DISPOSITIONS`, `reviewReasonSchema`, `taskSchema` from `schemas.ts`; `mustShipSchema`, `mustShipStatusSchema` from `todaySchemas.ts`.
- Produces, all exported from `src/shared/exec/reviewSchemas.ts`:
  - `scoreboardSchema` / `type Scoreboard`: `{ weekId, startDate, reviewedAt: string | null, outcomes: { shipped, total }, mustShips: { shipped, total }, deepWorkMinutes, rolledForward, killed, delegated, strip: { date, status: MustShipStatus | null }[] }`
  - `weekHistoryQuerySchema`: `{ before: string }`
  - `weekReviewSchema` / `type WeekReviewInput`: `{ notes = '' }`
  - `emptyBodySchema`: `{}`, strict
  - `outcomeReviewSchema` / `type OutcomeReview`: `{ grade, reason?, disposition?, date?, owner?, followUpDate? }` with the rules below
  - `mustShipBlockResultSchema` / `type MustShipBlockResult`: `{ mustShip: MustShip, task: Task }`
- `ERROR_CODES` in `api.ts` gains `'REVIEW_NOT_READY'` after `'SHUTDOWN_NOT_READY'`.

- [ ] **Step 1: Write the failing test**

Create `src/shared/exec/reviewSchemas.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { emptyBodySchema, outcomeReviewSchema, scoreboardSchema, weekHistoryQuerySchema, weekReviewSchema } from './reviewSchemas';
import { ERROR_CODES } from './api';

const messages = (input: unknown): string[] => {
  const parsed = outcomeReviewSchema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

describe('outcomeReviewSchema', () => {
  it('takes done on its own', () => {
    expect(outcomeReviewSchema.parse({ grade: 'done' })).toEqual({ grade: 'done' });
    expect(messages({ grade: 'done', reason: 'other' })).toEqual(['reason: a done outcome takes no reason or disposition']);
  });

  it('needs a reason and a disposition for partial and missed', () => {
    expect(messages({ grade: 'partial' })).toEqual([
      'reason: a partial or missed outcome needs a reason',
      'disposition: choose roll, reschedule, delegate or kill',
    ]);
    expect(outcomeReviewSchema.parse({ grade: 'missed', reason: 'procrastination', disposition: 'kill' })).toEqual({
      grade: 'missed',
      reason: 'procrastination',
      disposition: 'kill',
    });
    expect(outcomeReviewSchema.parse({ grade: 'partial', reason: 'insufficient_time', disposition: 'roll_forward' }).disposition).toBe('roll_forward');
  });

  it('takes a date only with a reschedule, and an owner and follow-up only with a delegation', () => {
    const slipped = { grade: 'partial', reason: 'insufficient_time' } as const;
    expect(messages({ ...slipped, disposition: 'reschedule' })).toEqual(['date: a reschedule, and only a reschedule, takes a date']);
    expect(messages({ ...slipped, disposition: 'kill', date: '2026-10-12' })).toEqual(['date: a reschedule, and only a reschedule, takes a date']);
    expect(outcomeReviewSchema.parse({ ...slipped, disposition: 'reschedule', date: '2026-10-12' }).date).toBe('2026-10-12');
    expect(messages({ ...slipped, disposition: 'delegate', owner: 'Bilal' })).toEqual(['owner: a delegation needs an owner and a follow-up date']);
    expect(messages({ ...slipped, disposition: 'roll_forward', owner: 'Bilal' })).toEqual(['owner: only a delegation takes an owner']);
    expect(outcomeReviewSchema.parse({ ...slipped, disposition: 'delegate', owner: '  Bilal ', followUpDate: '2026-10-05' }).owner).toBe('Bilal');
  });

  it('refuses unknown fields, unknown grades and a blank owner', () => {
    expect(outcomeReviewSchema.safeParse({ grade: 'done', extra: 1 }).success).toBe(false);
    expect(outcomeReviewSchema.safeParse({ grade: 'great' }).success).toBe(false);
    expect(
      outcomeReviewSchema.safeParse({ grade: 'missed', reason: 'other', disposition: 'delegate', owner: '  ', followUpDate: '2026-10-05' }).success
    ).toBe(false);
  });
});

describe('the other Phase 6 schemas', () => {
  it('defaults the review notes and refuses stray fields on an empty body', () => {
    expect(weekReviewSchema.parse({})).toEqual({ notes: '' });
    expect(emptyBodySchema.safeParse({}).success).toBe(true);
    expect(emptyBodySchema.safeParse({ date: '2026-09-29' }).success).toBe(false);
    expect(weekHistoryQuerySchema.safeParse({ before: '2026-02-30' }).success).toBe(false);
    expect(weekHistoryQuerySchema.parse({ before: '2026-09-29' })).toEqual({ before: '2026-09-29' });
  });

  it('describes a scoreboard with a nullable day strip status', () => {
    const board = {
      weekId: '20000000-0000-4000-8000-000000000001',
      startDate: '2026-09-27',
      reviewedAt: null,
      outcomes: { shipped: 1, total: 3 },
      mustShips: { shipped: 2, total: 5 },
      deepWorkMinutes: 90,
      rolledForward: 1,
      killed: 0,
      delegated: 2,
      strip: [
        { date: '2026-09-28', status: 'shipped' },
        { date: '2026-09-29', status: null },
      ],
    };
    expect(scoreboardSchema.safeParse(board).success).toBe(true);
    expect(scoreboardSchema.safeParse({ ...board, killed: -1 }).success).toBe(false);
  });

  it('adds REVIEW_NOT_READY to the error codes', () => {
    expect(ERROR_CODES).toContain('REVIEW_NOT_READY');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/exec/reviewSchemas.test.ts`
Expected: FAIL, the suite cannot resolve `./reviewSchemas`.

- [ ] **Step 3: Add the error code**

In `src/shared/exec/api.ts`, change the list so it reads:

```ts
export const ERROR_CODES = [
  'VALIDATION',
  'NOT_FOUND',
  'WEEK_FULL',
  'DAY_TAKEN',
  'SLOT_LIMIT',
  'SHUTDOWN_NOT_READY',
  'REVIEW_NOT_READY',
  'DELETE_NOT_ALLOWED',
  'CONSTRAINT',
  'INTERNAL',
] as const;
```

- [ ] **Step 4: Write the schemas**

Create `src/shared/exec/reviewSchemas.ts`:

```ts
import { z } from 'zod';
import { calendarDateSchema, fields, REVIEW_DISPOSITIONS, REVIEW_GRADES, reviewReasonSchema, taskSchema } from './schemas';
import { mustShipSchema, mustShipStatusSchema } from './todaySchemas';

/** Shutdown, the scoreboard and the Friday review (Phase 6). Every body, query and result of those routes is parsed by one of these. */

const { uuid, timestamp, longText } = fields;
const count = z.number().int().nonnegative();
const fraction = z.object({ shipped: count, total: count });

/** The week's numbers (spec B "Scoreboard"); the strip holds one entry per work day, in order. */
export const scoreboardSchema = z.object({
  weekId: uuid,
  startDate: calendarDateSchema,
  reviewedAt: timestamp.nullable(),
  outcomes: fraction,
  mustShips: fraction,
  deepWorkMinutes: count,
  rolledForward: count,
  killed: count,
  delegated: count,
  strip: z.array(z.object({ date: calendarDateSchema, status: mustShipStatusSchema.nullable() })),
});
export type Scoreboard = z.infer<typeof scoreboardSchema>;

/** Earlier weeks than the one containing `before`, newest first. */
export const weekHistoryQuerySchema = z.strictObject({ before: calendarDateSchema });

/** Stamping a week reviewed can keep a note (weeks.review_notes). */
export const weekReviewSchema = z.strictObject({ notes: longText.default('') });
export type WeekReviewInput = z.input<typeof weekReviewSchema>;

/** A route that takes no fields still parses its body, so a stray field is refused as it is everywhere else. */
export const emptyBodySchema = z.strictObject({});

const owner = z.string().trim().min(1, 'owner is required').max(120, 'owner is too long');
const DONE_ONLY = ['reason', 'disposition', 'date', 'owner', 'followUpDate'] as const;

/**
 * One outcome's Friday grade (spec C "Friday review"): done stands alone; partial and missed need a reason and a
 * disposition. A reschedule carries the date the outcome moves to; a delegation carries the owner and a follow-up date.
 */
export const outcomeReviewSchema = z
  .strictObject({
    grade: z.enum(REVIEW_GRADES),
    reason: reviewReasonSchema.optional(),
    disposition: z.enum(REVIEW_DISPOSITIONS).optional(),
    date: calendarDateSchema.optional(),
    owner: owner.optional(),
    followUpDate: calendarDateSchema.optional(),
  })
  .superRefine((body, context) => {
    const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message });
    if (body.grade === 'done') {
      for (const key of DONE_ONLY) if (body[key] !== undefined) issue(key, 'a done outcome takes no reason or disposition');
      return;
    }
    if (body.reason === undefined) issue('reason', 'a partial or missed outcome needs a reason');
    if (body.disposition === undefined) issue('disposition', 'choose roll, reschedule, delegate or kill');
    if ((body.disposition === 'reschedule') !== (body.date !== undefined)) issue('date', 'a reschedule, and only a reschedule, takes a date');
    const delegating = body.disposition === 'delegate';
    if (delegating && (body.owner === undefined || body.followUpDate === undefined)) issue('owner', 'a delegation needs an owner and a follow-up date');
    if (!delegating && (body.owner !== undefined || body.followUpDate !== undefined)) issue('owner', 'only a delegation takes an owner');
  });
export type OutcomeReview = z.infer<typeof outcomeReviewSchema>;

/** What blocking a Must Ship from Shutdown returns: the Must Ship and the waiting task filed for the next action. */
export const mustShipBlockResultSchema = z.object({ mustShip: mustShipSchema, task: taskSchema });
export type MustShipBlockResult = z.infer<typeof mustShipBlockResultSchema>;
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/shared/exec/reviewSchemas.test.ts && npm run lint`
Expected: PASS (7 tests), lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/exec/api.ts src/shared/exec/reviewSchemas.ts src/shared/exec/reviewSchemas.test.ts
git commit -m "feat: add the review schemas and the REVIEW_NOT_READY code"
```

---

### Task 2: The scoreboard, pure

**Files:**
- Create: `src/shared/exec/scoreboard.ts`
- Test: `src/shared/exec/scoreboard.test.ts`

**Interfaces:**
- Consumes: `addDays` (`dates.ts`), `elapsed` (`deepWork.ts`), `localClock` (`time.ts`); types `Outcome`, `Settings`, `Task`, `Week` (`schemas.ts`), `DeepWorkBlock`, `MustShip` (`todaySchemas.ts`), `Scoreboard` (`reviewSchemas.ts`, Task 1). The test uses the fixtures `makeOutcome`, `makeMustShip`, `makeTask`, `makeBlock`, `makeWeekView` from `src/test/fixtures.ts`.
- Produces, exported from `src/shared/exec/scoreboard.ts`:
  - `type ScoreboardRows = { week: Week; outcomes: Outcome[]; mustShips: MustShip[]; tasks: Task[]; blocks: DeepWorkBlock[] }`
  - `scoreboard(rows: ScoreboardRows, schedule: Pick<Settings, 'timezone' | 'workDays'>): Scoreboard`
  - `stampInWeek(stamp: string | null, startDate: string, timeZone: string): boolean`
  - `workDaysOf(startDate: string, workDays: readonly number[]): string[]`
  - `deepWorkLabel(minutes: number): string` ("0 min", "45 min", "1 h", "3 h 20 min")
  - `scoreLine(board: Scoreboard): string` ("1 of 3 outcomes · 2 of 5 Must Ships · 1 h 30 min deep work")

- [ ] **Step 1: Write the failing test**

Create `src/shared/exec/scoreboard.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { deepWorkLabel, scoreboard, scoreLine, stampInWeek, workDaysOf, type ScoreboardRows } from './scoreboard';
import { scoreboardSchema } from './reviewSchemas';
import { makeBlock, makeMustShip, makeOutcome, makeTask, makeWeekView } from '../../test/fixtures';

const SCHEDULE = { timezone: 'Asia/Karachi', workDays: [1, 2, 3, 4, 5] };
const week = makeWeekView([], { startDate: '2026-09-27' }).week;
const OTHER_WEEK = '20000000-0000-4000-8000-000000000009';
/** Karachi is UTC+5. */
const IN = '2026-09-28T06:00:00.000Z'; // Monday 11:00
const EDGE = '2026-09-26T19:00:00.000Z'; // Sunday 27 Sep 00:00, the week's first minute
const BEFORE = '2026-09-26T18:59:00.000Z'; // Saturday 26 Sep 23:59, the week before
const AFTER = '2026-10-03T19:00:00.000Z'; // Sunday 4 Oct 00:00, the next week

const rows = (overrides: Partial<ScoreboardRows> = {}): ScoreboardRows => ({ week, outcomes: [], mustShips: [], tasks: [], blocks: [], ...overrides });

describe('scoreboard', () => {
  it('names its week, says whether it was reviewed, and matches the schema', () => {
    const board = scoreboard(rows({ week: { ...week, reviewedAt: IN } }), SCHEDULE);
    expect(board).toMatchObject({ weekId: week.id, startDate: '2026-09-27', reviewedAt: IN, outcomes: { shipped: 0, total: 0 }, deepWorkMinutes: 0 });
    expect(scoreboardSchema.parse(board)).toEqual(board);
  });

  it('counts the outcomes that hold a slot or were graded, and the done ones', () => {
    const board = scoreboard(
      rows({
        outcomes: [
          makeOutcome({ slot: 1, reviewGrade: 'done', status: 'done' }),
          makeOutcome({ slot: 2, status: 'done' }), // done during the week, not yet reviewed
          makeOutcome({ slot: null, status: 'killed', reviewGrade: 'missed', reviewDisposition: 'kill' }), // killed at the review
          makeOutcome({ slot: null, status: 'killed' }), // replaced mid-week: not counted
          makeOutcome({ slot: 3, reviewGrade: 'partial', reviewDisposition: 'roll_forward' }),
          makeOutcome({ slot: 1, weekId: OTHER_WEEK }),
        ],
      }),
      SCHEDULE
    );
    expect(board.outcomes).toEqual({ shipped: 2, total: 4 });
  });

  it('counts work Must Ships on the work days and draws the strip', () => {
    const board = scoreboard(
      rows({
        mustShips: [
          makeMustShip({ date: '2026-09-28', status: 'shipped' }),
          makeMustShip({ date: '2026-09-29', status: 'partial' }),
          makeMustShip({ date: '2026-09-29', context: 'build', status: 'shipped' }),
          makeMustShip({ date: '2026-10-03', status: 'shipped' }), // Saturday is not a work day
          makeMustShip({ date: null, status: 'planned' }), // a candidate
        ],
      }),
      SCHEDULE
    );
    expect(board.mustShips).toEqual({ shipped: 1, total: 2 });
    expect(board.strip).toEqual([
      { date: '2026-09-28', status: 'shipped' },
      { date: '2026-09-29', status: 'partial' },
      { date: '2026-09-30', status: null },
      { date: '2026-10-01', status: null },
      { date: '2026-10-02', status: null },
    ]);
  });

  it('adds up the minutes of finished blocks dated in the week, less their pauses', () => {
    const board = scoreboard(
      rows({
        blocks: [
          makeBlock({ date: '2026-09-28', startedAt: '2026-09-28T03:35:00.000Z', endedAt: '2026-09-28T05:05:00.000Z', pausedSeconds: 600 }),
          makeBlock({ date: '2026-09-29', startedAt: '2026-09-29T03:35:00.000Z', endedAt: '2026-09-29T04:05:30.000Z' }),
          makeBlock({ date: '2026-09-30', startedAt: '2026-09-30T03:35:00.000Z' }), // still running
          makeBlock({ date: '2026-10-04', startedAt: '2026-10-04T03:35:00.000Z', endedAt: '2026-10-04T05:05:00.000Z' }), // next week
        ],
      }),
      SCHEDULE
    );
    expect(board.deepWorkMinutes).toBe(111); // 80 min + 30.5 min, rounded
  });

  it('counts rolled, killed and delegated by the local day of their timestamps', () => {
    const board = scoreboard(
      rows({
        outcomes: [makeOutcome({ weekId: OTHER_WEEK, rolledFromId: '10000000-0000-4000-8000-000000000999', createdAt: EDGE })],
        mustShips: [
          makeMustShip({ date: '2026-09-29', rolledFromId: '40000000-0000-4000-8000-000000000999', createdAt: IN }),
          makeMustShip({ date: null, status: 'killed', closedAt: IN }),
          makeMustShip({ date: null, rolledFromId: '40000000-0000-4000-8000-000000000998', createdAt: BEFORE }),
        ],
        tasks: [
          makeTask({ rolledAt: IN }),
          makeTask({ status: 'killed', closedAt: AFTER }),
          makeTask({ status: 'killed', closedAt: IN }),
          makeTask({ status: 'delegated', ownerName: 'Bilal', delegatedAt: EDGE }),
          makeTask({ status: 'waiting', ownerName: 'Bilal', delegatedAt: BEFORE }),
        ],
      }),
      SCHEDULE
    );
    expect(board).toMatchObject({ rolledForward: 3, killed: 2, delegated: 1 });
  });
});

describe('scoreboard helpers', () => {
  it('places a timestamp on its Karachi day', () => {
    expect(stampInWeek(EDGE, '2026-09-27', 'Asia/Karachi')).toBe(true);
    expect(stampInWeek(BEFORE, '2026-09-27', 'Asia/Karachi')).toBe(false);
    expect(stampInWeek(AFTER, '2026-09-27', 'Asia/Karachi')).toBe(false);
    expect(stampInWeek(null, '2026-09-27', 'Asia/Karachi')).toBe(false);
  });

  it('lists the work days of a week', () => {
    expect(workDaysOf('2026-09-27', [0, 6])).toEqual(['2026-09-27', '2026-10-03']);
  });

  it('writes minutes as hours and minutes, and the week as one line', () => {
    expect([0, 45, 60, 200].map((minutes) => deepWorkLabel(minutes))).toEqual(['0 min', '45 min', '1 h', '3 h 20 min']);
    const board = scoreboard(rows({ mustShips: [makeMustShip({ date: '2026-09-28', status: 'shipped' })] }), SCHEDULE);
    expect(scoreLine(board)).toBe('0 of 0 outcomes · 1 of 1 Must Ships · 0 min deep work');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/shared/exec/scoreboard.test.ts`
Expected: FAIL, the suite cannot resolve `./scoreboard`.

- [ ] **Step 3: Write the scoreboard**

Create `src/shared/exec/scoreboard.ts`:

```ts
import { addDays } from './dates';
import { elapsed } from './deepWork';
import { localClock } from './time';
import type { Outcome, Settings, Task, Week } from './schemas';
import type { DeepWorkBlock, MustShip } from './todaySchemas';
import type { Scoreboard } from './reviewSchemas';

/** The rows the scoreboard reads. The server may pass extra rows; each number filters for itself. */
export type ScoreboardRows = { week: Week; outcomes: Outcome[]; mustShips: MustShip[]; tasks: Task[]; blocks: DeepWorkBlock[] };
type Schedule = Pick<Settings, 'timezone' | 'workDays'>;

const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();
const inRange = (date: string, startDate: string): boolean => date >= startDate && date <= addDays(startDate, 6);

/** True when a UTC timestamp falls on a local calendar day of the week that starts at `startDate`. */
export function stampInWeek(stamp: string | null, startDate: string, timeZone: string): boolean {
  return stamp !== null && inRange(localClock(new Date(stamp), timeZone).date, startDate);
}

/** The week's work days, in order. */
export const workDaysOf = (startDate: string, workDays: readonly number[]): string[] =>
  [0, 1, 2, 3, 4, 5, 6].map((offset) => addDays(startDate, offset)).filter((date) => workDays.includes(weekdayOf(date)));

/** An outcome counts toward its week while it holds a slot, or once graded even after Kill freed the slot. */
const counted = (outcome: Outcome, weekId: string): boolean => outcome.weekId === weekId && (outcome.slot !== null || outcome.reviewGrade !== null);

/** Graded done, or done during the week and not graded yet. */
const shipped = (outcome: Outcome): boolean => outcome.reviewGrade === 'done' || (outcome.reviewGrade === null && outcome.status === 'done');

function deepWorkMinutes(blocks: DeepWorkBlock[], startDate: string): number {
  const seconds = blocks
    .filter((block) => block.endedAt !== null && inRange(block.date, startDate))
    .reduce((sum, block) => sum + elapsed(block, new Date(block.endedAt as string)).seconds, 0);
  return Math.round(seconds / 60);
}

/** Spec B "Scoreboard": the week's numbers and its day strip, from rows the server gathered. */
export function scoreboard(rows: ScoreboardRows, schedule: Schedule): Scoreboard {
  const { week } = rows;
  const inWeek = (stamp: string | null) => stampInWeek(stamp, week.startDate, schedule.timezone);
  const outcomes = rows.outcomes.filter((outcome) => counted(outcome, week.id));
  const days = workDaysOf(week.startDate, schedule.workDays);
  const ships = rows.mustShips.filter((ship) => ship.context === 'work' && ship.date !== null && days.includes(ship.date));
  const lineage = [...rows.outcomes, ...rows.mustShips].filter((row) => row.rolledFromId !== null && inWeek(row.createdAt));
  const killed = [...rows.outcomes, ...rows.mustShips, ...rows.tasks].filter((row) => row.status === 'killed' && inWeek(row.closedAt));
  return {
    weekId: week.id,
    startDate: week.startDate,
    reviewedAt: week.reviewedAt,
    outcomes: { shipped: outcomes.filter(shipped).length, total: outcomes.length },
    mustShips: { shipped: ships.filter((ship) => ship.status === 'shipped').length, total: ships.length },
    deepWorkMinutes: deepWorkMinutes(rows.blocks, week.startDate),
    rolledForward: lineage.length + rows.tasks.filter((task) => inWeek(task.rolledAt)).length,
    killed: killed.length,
    delegated: rows.tasks.filter((task) => inWeek(task.delegatedAt)).length,
    strip: days.map((date) => ({ date, status: ships.find((ship) => ship.date === date)?.status ?? null })),
  };
}

/** "0 min", "45 min", "2 h", "3 h 20 min". */
export function deepWorkLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** The week in one line: "1 of 3 outcomes · 2 of 5 Must Ships · 1 h 30 min deep work". */
export const scoreLine = (board: Scoreboard): string =>
  `${board.outcomes.shipped} of ${board.outcomes.total} outcomes · ${board.mustShips.shipped} of ${board.mustShips.total} Must Ships · ${deepWorkLabel(board.deepWorkMinutes)} deep work`;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/shared/exec/scoreboard.test.ts && npm run lint`
Expected: PASS (8 tests), lint clean.

- [ ] **Step 5: Commit**

```bash
git add src/shared/exec/scoreboard.ts src/shared/exec/scoreboard.test.ts
git commit -m "feat: compute the week's scoreboard and day strip from its rows"
```

---
### Task 3: Server scoreboard, history and the week review stamp

**Files:**
- Create: `server/exec/review/scoreboard.ts`, `server/exec/review/week.ts`
- Modify: `server/exec/routes/weeks.ts`
- Test: `server/exec/__tests__/review-week.test.ts`, `server/exec/__tests__/review-routes.test.ts`

**Interfaces:**
- Consumes: `scoreboard` (Task 2); `weekHistoryQuerySchema`, `weekReviewSchema` (Task 1); `listBlocks` (`deepWork/store.ts`); `getWeek` (`weeks/store.ts`); `toEntity`, `updateRow` (`rows.ts`); `getSettings`; `ApiError`.
- Produces:
  - `weekScoreboard(db, week: Week, settings: Settings): Scoreboard` and `weekHistory(db, before: string, settings: Settings): Scoreboard[]` in `server/exec/review/scoreboard.ts`
  - `reviewWeek(db, id: string, notes: string, now: string): Week | null` in `server/exec/review/week.ts` (throws 409 `REVIEW_NOT_READY`)
  - Routes: `GET /api/exec/weeks/history?before=YYYY-MM-DD` → `Scoreboard[]` (at most 12, newest first, weeks starting before the week holding `before`); `GET /api/exec/weeks/:id/scoreboard` → `Scoreboard` (404 `no such week`); `POST /api/exec/weeks/:id/review` `{ notes? }` → `Week` (404, 409)

- [ ] **Step 1: Write the failing store test**

Create `server/exec/__tests__/review-week.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek } from '../weeks/store';
import { addOutcome, patchOutcome } from '../outcomes/store';
import { createMustShip, patchMustShip, rollMustShip } from '../mustShips/store';
import { createBlock, pauseBlock, resumeBlock, startBlock } from '../deepWork/store';
import { finishBlock } from '../deepWork/finish';
import { createTask, patchTask, rollTask } from '../tasks/store';
import { getSettings } from '../settings/store';
import { weekHistory, weekScoreboard } from '../review/scoreboard';
import { reviewWeek } from '../review/week';
import { ApiError } from '../http';
import type { Week } from '../../../src/shared/exec/schemas';

/** A Karachi wall-clock time as the UTC timestamp the server would store. */
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00+05:00`).toISOString();
let db: Database.Database;
let week: Week;

const outcome = (title: string, category: 'office' | 'business' = 'office') =>
  addOutcome(db, week.id, { title, category, description: '', definitionOfDone: '', targetDate: null, projectId: null, notes: '' }, at('2026-09-27', '10:00'));
const ship = (date: string | null, title: string) =>
  createMustShip(db, { title, context: 'work', date, definitionOfDone: '', outcomeId: null, projectId: null, notes: '' }, at('2026-09-27', '10:30'));
type Times = { start: string; end: string; pause?: [string, string] };
const session = (date: string, times: Times, result: 'completed' | 'progress') => {
  const block = createBlock(db, { date, context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null }, at(date, '08:00'));
  startBlock(db, block.id, at(date, times.start));
  if (times.pause) {
    pauseBlock(db, block.id, at(date, times.pause[0]));
    resumeBlock(db, block.id, at(date, times.pause[1]));
  }
  finishBlock(db, block.id, { result, notes: '' }, at(date, times.end));
};

beforeEach(() => {
  db = prepareExecDb(':memory:');
  week = ensureWeek(db, '2026-09-29', 0, at('2026-09-27', '09:00')).view.week;
});

/** The fixture week of 27 Sep 2026 (spec D: "scoreboard matches the fixture"). */
function playTheWeek(): void {
  const [a, b, c] = [outcome('Supplier plan confirmed'), outcome('Haleon target signed'), outcome('Pinkbox P&L live', 'business')];
  ship('2026-09-28', 'Tracker sent');
  session('2026-09-28', { start: '08:35', end: '10:05', pause: ['09:00', '09:10'] }, 'completed'); // 80 min; ships Monday
  const tuesday = ship('2026-09-29', 'Price list sent');
  session('2026-09-29', { start: '08:35', end: '09:05' }, 'progress'); // 30 min
  patchMustShip(db, tuesday.id, { status: 'partial' }, at('2026-09-29', '17:05'));
  rollMustShip(db, tuesday.id, '2026-09-30', at('2026-09-29', '17:06')); // rolled 1; Wednesday planned
  const friday = ship('2026-10-02', 'Venue booked');
  patchMustShip(db, friday.id, { status: 'blocked', blockerWhat: 'No quote', blockerOwner: 'Sana', blockerNextAction: 'Chase the quote' }, at('2026-10-02', '17:00'));
  const candidate = ship(null, 'Old idea');
  patchMustShip(db, candidate.id, { status: 'killed' }, at('2026-09-30', '12:00')); // killed 1
  const [memo, deck, survey, early] = ['Memo', 'Deck', 'Survey', 'Early'].map((title) => createTask(db, { title, context: 'work', notes: '' }, at('2026-09-27', '11:00')));
  rollTask(db, memo.id, '2026-09-30', at('2026-09-29', '17:10')); // rolled 2
  patchTask(db, deck.id, { status: 'delegated', ownerName: 'Bilal' }, at('2026-09-30', '11:00')); // delegated 1
  patchTask(db, survey.id, { status: 'killed' }, at('2026-10-01', '12:00')); // killed 2
  patchTask(db, early.id, { status: 'waiting', ownerName: 'Sana' }, at('2026-09-26', '23:30')); // the Saturday before: not this week
  patchOutcome(db, a.id, { reviewGrade: 'done', status: 'done' }, at('2026-10-02', '16:00'));
  patchOutcome(db, b.id, { reviewGrade: 'partial', reviewReason: 'insufficient_time', reviewDisposition: 'roll_forward' }, at('2026-10-02', '16:05'));
  patchOutcome(db, c.id, { reviewGrade: 'missed', reviewReason: 'priority_changed', reviewDisposition: 'kill', status: 'killed' }, at('2026-10-02', '16:10')); // killed 3
}

describe('weekScoreboard', () => {
  it('matches the fixture week', () => {
    playTheWeek();
    expect(weekScoreboard(db, week, getSettings(db))).toEqual({
      weekId: week.id,
      startDate: '2026-09-27',
      reviewedAt: null,
      outcomes: { shipped: 1, total: 3 },
      mustShips: { shipped: 1, total: 4 },
      deepWorkMinutes: 110,
      rolledForward: 2,
      killed: 3,
      delegated: 1,
      strip: [
        { date: '2026-09-28', status: 'shipped' },
        { date: '2026-09-29', status: 'partial' },
        { date: '2026-09-30', status: 'planned' },
        { date: '2026-10-01', status: null },
        { date: '2026-10-02', status: 'blocked' },
      ],
    });
  });

  it('lists earlier weeks newest first, each with its numbers', () => {
    const older = ensureWeek(db, '2026-09-15', 0, at('2026-09-13', '09:00')).view.week;
    const oldest = ensureWeek(db, '2026-09-08', 0, at('2026-09-06', '09:00')).view.week;
    const history = weekHistory(db, '2026-09-30', getSettings(db));
    expect(history.map((board) => board.startDate)).toEqual([older.startDate, oldest.startDate]);
    expect(history[0]).toMatchObject({ weekId: older.id, outcomes: { shipped: 0, total: 0 } });
    expect(weekHistory(db, '2026-09-13', getSettings(db))).toEqual([expect.objectContaining({ startDate: '2026-09-06' })]);
  });
});

describe('reviewWeek', () => {
  it('refuses while an outcome is ungraded and writes nothing', () => {
    outcome('Supplier plan confirmed');
    let refusal: unknown = null;
    try {
      reviewWeek(db, week.id, 'notes', at('2026-10-02', '17:00'));
    } catch (error) {
      refusal = error;
    }
    expect(refusal).toBeInstanceOf(ApiError);
    expect(refusal).toMatchObject({ status: 409, code: 'REVIEW_NOT_READY', message: 'grade every outcome before the review is done' });
    expect(weekScoreboard(db, week, getSettings(db)).reviewedAt).toBeNull();
  });

  it('stamps the week once every slotted outcome is graded, and a second call changes nothing', () => {
    const made = outcome('Supplier plan confirmed');
    patchOutcome(db, made.id, { reviewGrade: 'done', status: 'done' }, at('2026-10-02', '16:00'));
    const stamped = reviewWeek(db, week.id, 'A good week', at('2026-10-02', '17:00'));
    expect(stamped).toMatchObject({ reviewedAt: at('2026-10-02', '17:00'), reviewNotes: 'A good week' });
    expect(reviewWeek(db, week.id, 'Again', at('2026-10-02', '18:00'))).toEqual(stamped);
  });

  it('reviews a week with no outcomes, and answers null for a missing week', () => {
    expect(reviewWeek(db, week.id, '', at('2026-10-02', '17:00'))?.reviewedAt).toBe(at('2026-10-02', '17:00'));
    expect(reviewWeek(db, '20000000-0000-4000-8000-00000000dead', '', at('2026-10-02', '17:00'))).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing route test**

Create `server/exec/__tests__/review-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { scoreboardSchema } from '../../../src/shared/exec/reviewSchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const MISSING = '20000000-0000-4000-8000-00000000dead';
const weekFor = async (date: string) => (await request(app).post('/api/exec/weeks').send({ date })).body.data.week.id as string;
const addOutcome = async (weekId: string, title: string) =>
  (await request(app).post(`/api/exec/weeks/${weekId}/outcomes`).send({ title, category: 'office' })).body.data.id as string;

describe('/api/exec/weeks, the review routes', () => {
  it("reads a week's scoreboard, and 404s an unknown week", async () => {
    const id = await weekFor('2026-09-29');
    const res = await request(app).get(`/api/exec/weeks/${id}/scoreboard`);
    expect(res.status).toBe(200);
    expect(scoreboardSchema.parse(res.body.data)).toMatchObject({ weekId: id, startDate: '2026-09-27' });
    expect(res.body.data.strip).toHaveLength(5);
    const missing = await request(app).get(`/api/exec/weeks/${MISSING}/scoreboard`);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: 'no such week', code: 'NOT_FOUND' });
  });

  it('lists earlier weeks newest first and refuses a bad date', async () => {
    await weekFor('2026-09-15');
    await weekFor('2026-09-22');
    await weekFor('2026-09-29');
    const res = await request(app).get('/api/exec/weeks/history?before=2026-09-29');
    expect(res.status).toBe(200);
    expect(res.body.data.map((board: { startDate: string }) => board.startDate)).toEqual(['2026-09-20', '2026-09-13']);
    const bad = await request(app).get('/api/exec/weeks/history?before=soon');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION');
  });

  it('refuses the review until every outcome is graded, then stamps it', async () => {
    const id = await weekFor('2026-09-29');
    const outcomeId = await addOutcome(id, 'Supplier plan confirmed');
    const early = await request(app).post(`/api/exec/weeks/${id}/review`).send({});
    expect(early.status).toBe(409);
    expect(early.body).toEqual({ success: false, error: 'grade every outcome before the review is done', code: 'REVIEW_NOT_READY' });
    await request(app).patch(`/api/exec/outcomes/${outcomeId}`).send({ reviewGrade: 'done', status: 'done' });
    const done = await request(app).post(`/api/exec/weeks/${id}/review`).send({ notes: 'Good week' });
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ id, reviewNotes: 'Good week', reviewedAt: expect.any(String) });
  });

  it('refuses a stray field without echoing it, and 404s an unknown week on review', async () => {
    const id = await weekFor('2026-09-29');
    const stray = await request(app).post(`/api/exec/weeks/${id}/review`).send({ reviewedAt: 'now' });
    expect(stray.status).toBe(400);
    expect(stray.body.code).toBe('VALIDATION');
    expect(JSON.stringify(stray.body)).not.toContain('reviewedAt');
    const missing = await request(app).post(`/api/exec/weeks/${MISSING}/review`).send({});
    expect(missing.status).toBe(404);
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/review-week.test.ts server/exec/__tests__/review-routes.test.ts`
Expected: FAIL. The store suite cannot resolve `../review/scoreboard`; the route suite gets 404 `no such endpoint` or `no such week` where it expects 200 and 409.

- [ ] **Step 4: Write the scoreboard reads**

Create `server/exec/review/scoreboard.ts`:

```ts
import type Database from 'better-sqlite3';
import { toEntity } from '../rows';
import { listBlocks } from '../deepWork/store';
import { addDays } from '../../../src/shared/exec/dates';
import { weekStartOf } from '../../../src/shared/exec/time';
import { scoreboard } from '../../../src/shared/exec/scoreboard';
import type { Outcome, Settings, Task, Week } from '../../../src/shared/exec/schemas';
import type { MustShip } from '../../../src/shared/exec/todaySchemas';
import type { Scoreboard } from '../../../src/shared/exec/reviewSchemas';

const HISTORY_WEEKS = 12;

/** A UTC window a day wider than the week on each side: every local timestamp of the week falls inside it, whatever the zone. */
const stampWindow = (startDate: string): [string, string] => [`${addDays(startDate, -1)}T00:00:00.000Z`, `${addDays(startDate, 8)}T00:00:00.000Z`];

const rowsOf = <T>(db: Database.Database, sql: string, params: string[]): T[] => db.prepare(sql).all(...params).map((row) => toEntity<T>(row));

/** The rows the week's numbers read (spec B "Scoreboard"); the pure scoreboard() then filters each number exactly. */
export function weekScoreboard(db: Database.Database, week: Week, settings: Settings): Scoreboard {
  const [low, high] = stampWindow(week.startDate);
  const end = addDays(week.startDate, 6);
  const outcomes = rowsOf<Outcome>(
    db,
    `SELECT * FROM outcomes WHERE week_id = ?
       OR (rolled_from_id IS NOT NULL AND created_at >= ? AND created_at < ?)
       OR (status = 'killed' AND closed_at >= ? AND closed_at < ?)`,
    [week.id, low, high, low, high]
  );
  const mustShips = rowsOf<MustShip>(
    db,
    `SELECT * FROM must_ships WHERE date BETWEEN ? AND ?
       OR (rolled_from_id IS NOT NULL AND created_at >= ? AND created_at < ?)
       OR (status = 'killed' AND closed_at >= ? AND closed_at < ?)`,
    [week.startDate, end, low, high, low, high]
  );
  const tasks = rowsOf<Task>(
    db,
    'SELECT * FROM tasks WHERE (rolled_at >= ? AND rolled_at < ?) OR (closed_at >= ? AND closed_at < ?) OR (delegated_at >= ? AND delegated_at < ?)',
    [low, high, low, high, low, high]
  );
  const blocks = listBlocks(db, { from: week.startDate, to: end });
  return scoreboard({ week, outcomes, mustShips, tasks, blocks }, settings);
}

/** Up to twelve weeks before the one containing `before`, newest first, each with its numbers (spec C "Review" item 2). */
export function weekHistory(db: Database.Database, before: string, settings: Settings): Scoreboard[] {
  return db
    .prepare('SELECT * FROM weeks WHERE start_date < ? ORDER BY start_date DESC LIMIT ?')
    .all(weekStartOf(before, settings.weekStartDay), HISTORY_WEEKS)
    .map((row) => weekScoreboard(db, toEntity<Week>(row), settings));
}
```

- [ ] **Step 5: Write the week review stamp**

Create `server/exec/review/week.ts`:

```ts
import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { updateRow } from '../rows';
import { getWeek } from '../weeks/store';
import type { Week } from '../../../src/shared/exec/schemas';

/** Stamps the week reviewed once every slotted outcome has a grade (spec B, POST /weeks/:id/review). A second call changes nothing. */
export function reviewWeek(db: Database.Database, id: string, notes: string, now: string): Week | null {
  return db
    .transaction((): Week | null => {
      const week = getWeek(db, id);
      if (!week || week.reviewedAt !== null) return week;
      const ungraded = db.prepare('SELECT COUNT(*) FROM outcomes WHERE week_id = ? AND slot IS NOT NULL AND review_grade IS NULL').pluck().get(id) as number;
      if (ungraded > 0) throw new ApiError(409, 'REVIEW_NOT_READY', 'grade every outcome before the review is done');
      updateRow(db, 'weeks', id, { reviewedAt: now, reviewNotes: notes, updatedAt: now });
      return getWeek(db, id);
    })
    .immediate();
}
```

- [ ] **Step 6: Mount the routes**

Replace `server/exec/routes/weeks.ts` with:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { ensureWeek, getWeek, getWeekView, lookupWeek } from '../weeks/store';
import { addOutcome } from '../outcomes/store';
import { weekHistory, weekScoreboard } from '../review/scoreboard';
import { reviewWeek } from '../review/week';
import { outcomeCreateSchema, weekCreateSchema, weekQuerySchema } from '../../../src/shared/exec/schemas';
import { weekHistoryQuerySchema, weekReviewSchema } from '../../../src/shared/exec/reviewSchemas';

export function weeksRouter(db: Database.Database, clock: () => string = nowIso): Router {
  const router = Router();
  const notFound = () => new ApiError(404, 'NOT_FOUND', 'no such week');
  const weekStartDay = () => getSettings(db).weekStartDay;

  router.get('/', (req, res) => {
    const { date } = weekQuerySchema.parse(req.query);
    ok(res, lookupWeek(db, date, weekStartDay()));
  });

  // Registered before '/:id', or "history" would be read as a week id.
  router.get('/history', (req, res) => {
    const { before } = weekHistoryQuerySchema.parse(req.query);
    ok(res, weekHistory(db, before, getSettings(db)));
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

  router.get('/:id/scoreboard', (req, res) => {
    const week = getWeek(db, req.params.id);
    if (!week) throw notFound();
    ok(res, weekScoreboard(db, week, getSettings(db)));
  });

  router.post('/:id/review', (req, res) => {
    const { notes } = weekReviewSchema.parse(req.body ?? {});
    const week = reviewWeek(db, req.params.id, notes, clock());
    if (!week) throw notFound();
    ok(res, week);
  });

  router.post('/:id/outcomes', (req, res) => {
    const input = outcomeCreateSchema.parse(req.body);
    if (!getWeek(db, req.params.id)) throw notFound();
    ok(res, addOutcome(db, req.params.id, input, clock()), 201);
  });

  return router;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/review-week.test.ts server/exec/__tests__/review-routes.test.ts server/exec/__tests__/weeks-routes.test.ts && npm run lint`
Expected: PASS (5 + 4 new tests; the Phase 3 weeks route tests still pass), lint clean.

- [ ] **Step 8: Commit**

```bash
git add server/exec/review/scoreboard.ts server/exec/review/week.ts server/exec/routes/weeks.ts server/exec/__tests__/review-week.test.ts server/exec/__tests__/review-routes.test.ts
git commit -m "feat: serve the week's scoreboard and history and stamp the week reviewed"
```

---
### Task 4: The Friday grade of one outcome

**Files:**
- Create: `server/exec/tasks/file.ts`, `server/exec/review/outcome.ts`
- Modify: `server/exec/deepWork/finish.ts` (file the blocker's task through `tasks/file.ts`), `server/exec/routes/outcomes.ts`
- Test: `server/exec/__tests__/review-outcome.test.ts`, `server/exec/__tests__/outcome-review-routes.test.ts`

**Interfaces:**
- Consumes: `outcomeReviewSchema`, `type OutcomeReview` (Task 1); `getOutcome`, `patchOutcome`, `rollOutcome` (`outcomes/store.ts`); `ensureWeek`, `getWeek` (`weeks/store.ts`); `getTask` (`tasks/store.ts`); `insertRow`, `updateRow` (`rows.ts`); `contextOf` (`week.ts`); `addDays`.
- Produces:
  - `type HandedOff` and `fileHandedOffTask(db, fields: HandedOff, now: string): Task` in `server/exec/tasks/file.ts`: inserts a task already out of the inbox (`capturedAt`, `processedAt`, `delegatedAt`, `createdAt`, `updatedAt` all `now`)
  - `reviewOutcome(db, id: string, review: OutcomeReview, now: string, weekStartDay: number): Outcome | null` in `server/exec/review/outcome.ts`
  - Route: `POST /api/exec/outcomes/:id/review` → the graded `Outcome` (400 `VALIDATION`, 404 `no such outcome`, 409 `WEEK_FULL` from a reschedule)

- [ ] **Step 1: Write the failing store test**

Create `server/exec/__tests__/review-outcome.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { ensureWeek, findWeekByStart, listOutcomes } from '../weeks/store';
import { addOutcome, getOutcome, patchOutcome } from '../outcomes/store';
import { listTasks } from '../tasks/store';
import { reviewOutcome } from '../review/outcome';
import { ApiError } from '../http';
import type { OutcomeCategory } from '../../../src/shared/exec/schemas';
import type { OutcomeReview } from '../../../src/shared/exec/reviewSchemas';

const T0 = '2026-09-27T05:00:00.000Z';
const FRIDAY = '2026-10-02T11:00:00.000Z';
let db: Database.Database;
let weekId: string;

const outcome = (title: string, category: OutcomeCategory = 'office', weekOf = weekId) =>
  addOutcome(db, weekOf, { title, category, description: '', definitionOfDone: 'Signed by both', targetDate: null, projectId: null, notes: '' }, T0);
const review = (id: string, input: OutcomeReview) => reviewOutcome(db, id, input, FRIDAY, 0);

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

describe('reviewOutcome', () => {
  it('closes a done outcome', () => {
    const made = outcome('Supplier plan confirmed');
    expect(review(made.id, { grade: 'done' })).toMatchObject({ reviewGrade: 'done', status: 'done', progress: 100, closedAt: FRIDAY, slot: 1 });
  });

  it('records a roll forward and leaves the outcome for Sunday', () => {
    const made = outcome('Haleon target signed');
    expect(review(made.id, { grade: 'partial', reason: 'insufficient_time', disposition: 'roll_forward' })).toMatchObject({
      reviewGrade: 'partial',
      reviewReason: 'insufficient_time',
      reviewDisposition: 'roll_forward',
      status: 'active',
      slot: 1,
    });
  });

  it('kills an outcome and keeps its grade', () => {
    const made = outcome('Pinkbox P&L live', 'business');
    expect(review(made.id, { grade: 'missed', reason: 'priority_changed', disposition: 'kill' })).toMatchObject({
      reviewGrade: 'missed',
      reviewDisposition: 'kill',
      status: 'killed',
      slot: null,
      closedAt: FRIDAY,
    });
  });

  it('reschedules into the later week holding the date, with that date as the target', () => {
    const made = outcome('Distributor terms signed');
    const graded = review(made.id, { grade: 'missed', reason: 'dependency_blocker', disposition: 'reschedule', date: '2026-10-14' });
    expect(graded).toMatchObject({ reviewDisposition: 'reschedule', status: 'active' });
    const target = findWeekByStart(db, '2026-10-11');
    expect(target).not.toBeNull();
    expect(listOutcomes(db, target?.id ?? '')).toEqual([
      expect.objectContaining({ title: 'Distributor terms signed', rolledFromId: made.id, targetDate: '2026-10-14', slot: 1 }),
    ]);
  });

  it('delegates by filing a task on the owner', () => {
    const made = outcome('Healify beta shipped', 'personal');
    review(made.id, { grade: 'partial', reason: 'too_many_meetings', disposition: 'delegate', owner: 'Sana', followUpDate: '2026-10-06' });
    expect(listTasks(db, { status: ['delegated'] })).toEqual([
      expect.objectContaining({
        title: 'Healify beta shipped',
        ownerName: 'Sana',
        followUpDate: '2026-10-06',
        expectedOutput: 'Signed by both',
        outcomeId: made.id,
        context: 'build',
        processedAt: FRIDAY,
        delegatedAt: FRIDAY,
      }),
    ]);
    expect(getOutcome(db, made.id)).toMatchObject({ reviewDisposition: 'delegate', status: 'active' });
  });

  it('refuses a second grade, a killed outcome, and a done outcome graded otherwise', () => {
    const first = outcome('A');
    review(first.id, { grade: 'done' });
    expect(refusal(() => review(first.id, { grade: 'done' })).message).toBe('that outcome is already reviewed');
    const replaced = outcome('B');
    patchOutcome(db, replaced.id, { status: 'killed' }, T0);
    expect(refusal(() => review(replaced.id, { grade: 'done' })).message).toBe('a killed outcome is not reviewed');
    const finished = outcome('C');
    patchOutcome(db, finished.id, { status: 'done' }, T0);
    expect(refusal(() => review(finished.id, { grade: 'partial', reason: 'other', disposition: 'kill' })).message).toBe('a finished outcome is graded done');
  });

  it('refuses a reschedule inside its own week and writes nothing', () => {
    const made = outcome('Distributor terms signed');
    const refused = refusal(() => review(made.id, { grade: 'missed', reason: 'other', disposition: 'reschedule', date: '2026-10-03' }));
    expect(refused.message).toBe('reschedule to a later week');
    expect(getOutcome(db, made.id)?.reviewGrade).toBeNull();
  });

  it('rolls the whole grade back when the target week is full', () => {
    const later = ensureWeek(db, '2026-10-14', 0, T0).view.week.id;
    ['X', 'Y', 'Z'].forEach((title) => outcome(title, 'office', later));
    const made = outcome('Distributor terms signed');
    const refused = refusal(() => review(made.id, { grade: 'missed', reason: 'other', disposition: 'reschedule', date: '2026-10-14' }));
    expect(refused.code).toBe('WEEK_FULL');
    expect(getOutcome(db, made.id)?.reviewGrade).toBeNull();
    expect(listOutcomes(db, later)).toHaveLength(3);
  });

  it('answers null for a missing outcome', () => {
    expect(review('10000000-0000-4000-8000-00000000dead', { grade: 'done' })).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing route test**

Create `server/exec/__tests__/outcome-review-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';

let app: Express;
const MISSING = '10000000-0000-4000-8000-00000000dead';

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

describe('POST /api/exec/outcomes/:id/review', () => {
  it('grades an outcome once', async () => {
    const weekId = (await request(app).post('/api/exec/weeks').send({ date: '2026-09-29' })).body.data.week.id;
    const id = (await request(app).post(`/api/exec/weeks/${weekId}/outcomes`).send({ title: 'Supplier plan confirmed', category: 'office' })).body.data.id;
    const res = await request(app).post(`/api/exec/outcomes/${id}/review`).send({ grade: 'partial', reason: 'insufficient_time', disposition: 'roll_forward' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, reviewGrade: 'partial', reviewDisposition: 'roll_forward' });
    const again = await request(app).post(`/api/exec/outcomes/${id}/review`).send({ grade: 'done' });
    expect(again.status).toBe(400);
    expect(again.body).toEqual({ success: false, error: 'that outcome is already reviewed', code: 'VALIDATION' });
  });

  it('refuses an incomplete grade with the reasons, and 404s an unknown outcome', async () => {
    const bad = await request(app).post(`/api/exec/outcomes/${MISSING}/review`).send({ grade: 'missed' });
    expect(bad.status).toBe(400);
    expect(bad.body.details).toEqual([
      { path: 'reason', message: 'a partial or missed outcome needs a reason' },
      { path: 'disposition', message: 'choose roll, reschedule, delegate or kill' },
    ]);
    const missing = await request(app).post(`/api/exec/outcomes/${MISSING}/review`).send({ grade: 'done' });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: 'no such outcome', code: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/review-outcome.test.ts server/exec/__tests__/outcome-review-routes.test.ts`
Expected: FAIL. The store suite cannot resolve `../review/outcome`; the route suite gets 404 `no such endpoint`.

- [ ] **Step 4: Move task filing into its own module**

Create `server/exec/tasks/file.ts`:

```ts
import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { insertRow } from '../rows';
import { getTask } from './store';
import type { Context, Task } from '../../../src/shared/exec/schemas';

/** A task born in someone else's hands: a blocker's next action, or an outcome handed off at the review. */
export type HandedOff = {
  title: string;
  notes: string;
  context: Context;
  status: 'delegated' | 'waiting';
  ownerName: string;
  expectedOutput: string | null;
  followUpDate: string;
  projectId: string | null;
  outcomeId: string | null;
  mustShipId: string | null;
};

/** Files it already processed and handed off: it never passes through the inbox. */
export function fileHandedOffTask(db: Database.Database, fields: HandedOff, now: string): Task {
  const id = randomUUID();
  insertRow(db, 'tasks', { ...fields, id, capturedAt: now, processedAt: now, delegatedAt: now, createdAt: now, updatedAt: now });
  return getTask(db, id) as Task;
}
```

Replace `server/exec/deepWork/finish.ts` with (only the imports and `fileBlockerTask` change; its behaviour does not):

```ts
import type Database from 'better-sqlite3';
import { updateRow } from '../rows';
import { getMustShip, patchMustShip } from '../mustShips/store';
import { fileHandedOffTask } from '../tasks/file';
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
  return fileHandedOffTask(
    db,
    {
      title: blocker.nextAction,
      notes: `Blocked: ${blocker.what}`,
      context: block.context,
      status: 'waiting',
      ownerName: blocker.owner,
      expectedOutput: null,
      followUpDate: addDays(block.date, 1),
      projectId: mustShip?.projectId ?? null,
      outcomeId: block.outcomeId ?? mustShip?.outcomeId ?? null,
      mustShipId: mustShip?.id ?? block.mustShipId,
    },
    now
  );
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

- [ ] **Step 5: Write the grade**

Create `server/exec/review/outcome.ts`:

```ts
import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { updateRow } from '../rows';
import { ensureWeek, getWeek } from '../weeks/store';
import { getOutcome, patchOutcome, rollOutcome } from '../outcomes/store';
import { fileHandedOffTask } from '../tasks/file';
import { addDays } from '../../../src/shared/exec/dates';
import { contextOf } from '../../../src/shared/exec/week';
import type { Outcome, OutcomePatch } from '../../../src/shared/exec/schemas';
import type { OutcomeReview } from '../../../src/shared/exec/reviewSchemas';

const invalid = (message: string): ApiError => new ApiError(400, 'VALIDATION', message);

/** Reschedule: carry the outcome into the later week that holds `date`, with that date as its target. */
function reschedule(db: Database.Database, outcome: Outcome, date: string, weekStartDay: number, now: string): void {
  const week = getWeek(db, outcome.weekId);
  if (!week || date <= addDays(week.startDate, 6)) throw invalid('reschedule to a later week');
  const target = ensureWeek(db, date, weekStartDay, now).view.week;
  const rolled = rollOutcome(db, outcome.id, target.id, now);
  if (rolled) updateRow(db, 'outcomes', rolled.outcome.id, { targetDate: date, updatedAt: now });
}

/** Delegate: the outcome becomes a task in the owner's hands, followed up on the chosen day. */
function delegate(db: Database.Database, outcome: Outcome, owner: string, followUpDate: string, now: string): void {
  fileHandedOffTask(
    db,
    {
      title: outcome.title,
      notes: 'Delegated at the weekly review',
      context: contextOf(outcome.category),
      status: 'delegated',
      ownerName: owner,
      expectedOutput: outcome.definitionOfDone || null,
      followUpDate,
      projectId: outcome.projectId,
      outcomeId: outcome.id,
      mustShipId: null,
    },
    now
  );
}

function assertReviewable(outcome: Outcome, review: OutcomeReview): void {
  if (outcome.reviewGrade !== null) throw invalid('that outcome is already reviewed');
  if (outcome.slot === null) throw invalid('a killed outcome is not reviewed');
  if (outcome.status === 'done' && review.grade !== 'done') throw invalid('a finished outcome is graded done');
}

/** Done closes the outcome; Kill frees its slot; the other dispositions leave it active in its week. */
function gradePatch(review: OutcomeReview): OutcomePatch {
  if (review.grade === 'done') return { reviewGrade: 'done', status: 'done' };
  const graded: OutcomePatch = { reviewGrade: review.grade, reviewReason: review.reason ?? null, reviewDisposition: review.disposition ?? null };
  return review.disposition === 'kill' ? { ...graded, status: 'killed' } : graded;
}

/** One outcome's Friday review, all or nothing (spec C "Friday review" step 1). Null when the outcome does not exist. */
export function reviewOutcome(db: Database.Database, id: string, review: OutcomeReview, now: string, weekStartDay: number): Outcome | null {
  return db
    .transaction((): Outcome | null => {
      const outcome = getOutcome(db, id);
      if (!outcome) return null;
      assertReviewable(outcome, review);
      if (review.disposition === 'reschedule' && review.date) reschedule(db, outcome, review.date, weekStartDay, now);
      if (review.disposition === 'delegate' && review.owner && review.followUpDate) delegate(db, outcome, review.owner, review.followUpDate, now);
      return patchOutcome(db, id, gradePatch(review), now);
    })
    .immediate();
}
```

- [ ] **Step 6: Mount the route**

Replace `server/exec/routes/outcomes.ts` with:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { patchOutcome, rollOutcome } from '../outcomes/store';
import { reviewOutcome } from '../review/outcome';
import { outcomePatchSchema, outcomeRollSchema } from '../../../src/shared/exec/schemas';
import { outcomeReviewSchema } from '../../../src/shared/exec/reviewSchemas';

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

  router.post('/:id/review', (req, res) => {
    const review = outcomeReviewSchema.parse(req.body);
    const outcome = reviewOutcome(db, req.params.id, review, clock(), getSettings(db).weekStartDay);
    if (!outcome) throw notFound();
    ok(res, outcome);
  });

  return router;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/review-outcome.test.ts server/exec/__tests__/outcome-review-routes.test.ts server/exec/__tests__/deep-work-finish.test.ts server/exec/__tests__/deep-work-routes.test.ts && npm run lint`
Expected: PASS (9 + 2 new tests; the Phase 5 finish and deep-work route tests still pass unchanged), lint clean.

- [ ] **Step 8: Commit**

```bash
git add server/exec/tasks/file.ts server/exec/deepWork/finish.ts server/exec/review/outcome.ts server/exec/routes/outcomes.ts server/exec/__tests__/review-outcome.test.ts server/exec/__tests__/outcome-review-routes.test.ts
git commit -m "feat: grade an outcome at the Friday review and carry out its disposition"
```

---
### Task 5: Closing the day and blocking a Must Ship from Shutdown

**Files:**
- Create: `server/exec/days/shutdown.ts`, `server/exec/mustShips/block.ts`
- Modify: `server/exec/routes/days.ts`, `server/exec/routes/mustShips.ts`
- Test: `server/exec/__tests__/shutdown.test.ts`, `server/exec/__tests__/shutdown-routes.test.ts`

**Interfaces:**
- Consumes: `emptyBodySchema`, `type MustShipBlockResult`, `mustShipBlockResultSchema` (Task 1); `fileHandedOffTask` (Task 4); `finishBlock` (`deepWork/finish.ts`); `getDayView` (`days/store.ts`); `getMustShip`, `patchMustShip` (`mustShips/store.ts`); `blockerSchema`, `type Blocker` (`deepWorkSchemas.ts`); `nextWorkDay` (`today.ts`); `getSettings`.
- Produces:
  - `shutDown(db, date: string, now: string, weekStartDay: number): DayView` in `server/exec/days/shutdown.ts` (throws 409 `SHUTDOWN_NOT_READY`)
  - `blockMustShip(db, id: string, blocker: Blocker, workDays: readonly number[], now: string): MustShipBlockResult | null` in `server/exec/mustShips/block.ts`
  - Routes: `POST /api/exec/days/:date/shutdown` `{}` → `DayView`; `POST /api/exec/must-ships/:id/block` `{ what, owner, nextAction }` → `{ mustShip, task }` (400, 404 `no such must ship`)

- [ ] **Step 1: Write the failing store test**

Create `server/exec/__tests__/shutdown.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import { prepareExecDb } from '../db/prepare';
import { createMustShip, getMustShip, patchMustShip } from '../mustShips/store';
import { createBlock, getBlock, pauseBlock, startBlock } from '../deepWork/store';
import { createTask, listTasks } from '../tasks/store';
import { setDaySlots } from '../days/store';
import { shutDown } from '../days/shutdown';
import { blockMustShip } from '../mustShips/block';
import { ApiError } from '../http';
import type { Context } from '../../../src/shared/exec/schemas';

const DATE = '2026-09-29'; // a Tuesday
const T0 = '2026-09-29T03:00:00.000Z';
const CLOSE = '2026-09-29T12:05:00.000Z'; // 17:05 in Karachi
const LATER = '2026-09-29T13:00:00.000Z';
const BLOCKER = { what: 'No quote from the venue', owner: 'Sana', nextAction: 'Chase the venue quote' };
const WORK_DAYS = [1, 2, 3, 4, 5];
let db: Database.Database;

const ship = (context: Context = 'work', date: string | null = DATE) =>
  createMustShip(db, { title: 'Venue booked', context, date, definitionOfDone: '', outcomeId: null, projectId: null, notes: '' }, T0);

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

describe('shutDown', () => {
  it('refuses while the work Must Ship is planned and writes nothing', () => {
    ship();
    expect(refusal(() => shutDown(db, DATE, CLOSE, 0))).toMatchObject({
      status: 409,
      code: 'SHUTDOWN_NOT_READY',
      message: "grade today's Must Ship before closing the day",
    });
    expect(db.prepare('SELECT COUNT(*) FROM days').pluck().get()).toBe(0);
  });

  it('closes a graded day and a day with no Must Ship, whatever the build Must Ship says', () => {
    const work = ship();
    ship('build');
    patchMustShip(db, work.id, { status: 'partial' }, CLOSE);
    expect(shutDown(db, DATE, CLOSE, 0).day).toMatchObject({ date: DATE, shutdownAt: CLOSE });
    expect(shutDown(db, '2026-09-30', CLOSE, 0).day?.shutdownAt).toBe(CLOSE);
  });

  it("keeps the first stamp and the day's secondaries on a second call", () => {
    const task = createTask(db, { title: 'Memo', context: 'work', notes: '' }, T0);
    setDaySlots(db, DATE, [task.id], T0, 0);
    shutDown(db, DATE, CLOSE, 0);
    const again = shutDown(db, DATE, LATER, 0);
    expect(again.day?.shutdownAt).toBe(CLOSE);
    expect(again.secondaries.map((secondary) => secondary.task.id)).toEqual([task.id]);
  });

  it('ends a session still running as abandoned, folding its pause, and leaves the grade alone', () => {
    const work = ship();
    const block = createBlock(db, { date: DATE, context: 'work', plannedStart: '08:35', plannedMinutes: 90, outcomeId: null, mustShipId: null }, T0);
    startBlock(db, block.id, '2026-09-29T03:35:00.000Z');
    pauseBlock(db, block.id, '2026-09-29T04:00:00.000Z');
    patchMustShip(db, work.id, { status: 'missed' }, CLOSE);
    shutDown(db, DATE, CLOSE, 0);
    expect(getBlock(db, block.id)).toMatchObject({ result: 'abandoned', endedAt: CLOSE, pauseStartedAt: null, pausedSeconds: 29_100 });
    expect(getMustShip(db, work.id)?.status).toBe('missed');
  });
});

describe('blockMustShip', () => {
  it('writes the blocker and files the next action for the next work day', () => {
    const friday = ship('work', '2026-10-02');
    const result = blockMustShip(db, friday.id, BLOCKER, WORK_DAYS, CLOSE);
    expect(result?.mustShip).toMatchObject({
      status: 'blocked',
      blockerWhat: BLOCKER.what,
      blockerOwner: 'Sana',
      blockerNextAction: BLOCKER.nextAction,
      closedAt: CLOSE,
    });
    expect(result?.task).toMatchObject({
      title: BLOCKER.nextAction,
      notes: `Blocked: ${BLOCKER.what}`,
      status: 'waiting',
      ownerName: 'Sana',
      followUpDate: '2026-10-05',
      mustShipId: friday.id,
      context: 'work',
    });
  });

  it('refuses a Must Ship that is not planned or has no day, and writes nothing', () => {
    const shipped = ship();
    patchMustShip(db, shipped.id, { status: 'shipped' }, CLOSE);
    expect(refusal(() => blockMustShip(db, shipped.id, BLOCKER, WORK_DAYS, CLOSE)).message).toBe('only a planned must ship can be blocked');
    const candidate = ship('work', null);
    expect(refusal(() => blockMustShip(db, candidate.id, BLOCKER, WORK_DAYS, CLOSE)).message).toBe('a candidate has no day to be blocked on');
    expect(listTasks(db, {})).toHaveLength(0);
  });

  it('answers null for a missing Must Ship', () => {
    expect(blockMustShip(db, '40000000-0000-4000-8000-00000000dead', BLOCKER, WORK_DAYS, CLOSE)).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing route test**

Create `server/exec/__tests__/shutdown-routes.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { dayViewSchema } from '../../../src/shared/exec/todaySchemas';
import { mustShipBlockResultSchema } from '../../../src/shared/exec/reviewSchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const tuesdayShip = async () =>
  (await request(app).post('/api/exec/must-ships').send({ title: 'Venue booked', context: 'work', date: '2026-09-29' })).body.data.id as string;

describe('the shutdown routes', () => {
  it('refuses to close the day while the Must Ship is planned, then closes it once graded', async () => {
    const id = await tuesdayShip();
    const early = await request(app).post('/api/exec/days/2026-09-29/shutdown').send({});
    expect(early.status).toBe(409);
    expect(early.body).toEqual({ success: false, error: "grade today's Must Ship before closing the day", code: 'SHUTDOWN_NOT_READY' });
    await request(app).patch(`/api/exec/must-ships/${id}`).send({ status: 'shipped' });
    const closed = await request(app).post('/api/exec/days/2026-09-29/shutdown').send({});
    expect(closed.status).toBe(200);
    expect(dayViewSchema.parse(closed.body.data).day?.shutdownAt).toEqual(expect.any(String));
  });

  it('refuses a stray field without echoing it, and a date that is not a date', async () => {
    const stray = await request(app).post('/api/exec/days/2026-09-29/shutdown').send({ force: true });
    expect(stray.status).toBe(400);
    expect(JSON.stringify(stray.body)).not.toContain('force');
    const bad = await request(app).post('/api/exec/days/2026-02-30/shutdown').send({});
    expect(bad.status).toBe(400);
  });

  it('blocks a Must Ship and files its next action, refusing an incomplete blocker', async () => {
    const id = await tuesdayShip();
    const incomplete = await request(app).post(`/api/exec/must-ships/${id}/block`).send({ what: 'No quote', owner: '' });
    expect(incomplete.status).toBe(400);
    const res = await request(app).post(`/api/exec/must-ships/${id}/block`).send({ what: 'No quote', owner: 'Sana', nextAction: 'Chase the quote' });
    expect(res.status).toBe(200);
    expect(mustShipBlockResultSchema.parse(res.body.data)).toMatchObject({
      mustShip: { status: 'blocked' },
      task: { status: 'waiting', followUpDate: '2026-09-30' },
    });
    const missing = await request(app).post('/api/exec/must-ships/40000000-0000-4000-8000-00000000dead/block').send({ what: 'a', owner: 'b', nextAction: 'c' });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: 'no such must ship', code: 'NOT_FOUND' });
  });
});
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `npx vitest run server/exec/__tests__/shutdown.test.ts server/exec/__tests__/shutdown-routes.test.ts`
Expected: FAIL. The store suite cannot resolve `../days/shutdown`; the route suite gets 404 `no such endpoint`.

- [ ] **Step 4: Write the shutdown stamp**

Create `server/exec/days/shutdown.ts`:

```ts
import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { finishBlock } from '../deepWork/finish';
import { getDayView } from './store';
import type { DayView } from '../../../src/shared/exec/todaySchemas';

/**
 * Closes the day (spec B, POST /days/:date/shutdown). Refused while the work Must Ship is still planned, so step 1 cannot
 * be skipped. A session still running that day ends as abandoned. A second call changes nothing.
 */
export function shutDown(db: Database.Database, date: string, now: string, weekStartDay: number): DayView {
  db.transaction(() => {
    if (db.prepare('SELECT shutdown_at FROM days WHERE date = ?').pluck().get(date)) return;
    const status = db.prepare("SELECT status FROM must_ships WHERE date = ? AND context = 'work'").pluck().get(date);
    if (status === 'planned') throw new ApiError(409, 'SHUTDOWN_NOT_READY', "grade today's Must Ship before closing the day");
    const live = db.prepare('SELECT id FROM deep_work_blocks WHERE date = ? AND started_at IS NOT NULL AND ended_at IS NULL').pluck().all(date) as string[];
    for (const id of live) finishBlock(db, id, { result: 'abandoned', notes: '' }, now);
    db.prepare(
      `INSERT INTO days (date, shutdown_at, created_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (date) DO UPDATE SET shutdown_at = excluded.shutdown_at, updated_at = excluded.updated_at`
    ).run(date, now, now, now);
  }).immediate();
  return getDayView(db, date, weekStartDay);
}
```

- [ ] **Step 5: Write Shutdown's Blocked**

Create `server/exec/mustShips/block.ts`:

```ts
import type Database from 'better-sqlite3';
import { ApiError } from '../http';
import { getMustShip, patchMustShip } from './store';
import { fileHandedOffTask } from '../tasks/file';
import { nextWorkDay } from '../../../src/shared/exec/today';
import type { Blocker } from '../../../src/shared/exec/deepWorkSchemas';
import type { MustShip } from '../../../src/shared/exec/todaySchemas';
import type { MustShipBlockResult } from '../../../src/shared/exec/reviewSchemas';

const invalid = (message: string): ApiError => new ApiError(400, 'VALIDATION', message);

/**
 * Shutdown's Blocked (spec C "Shutdown" step 1): the blocker goes on the Must Ship and the next action becomes a task
 * waiting on its owner, followed up the next work day. All or nothing; null when the Must Ship does not exist.
 */
export function blockMustShip(db: Database.Database, id: string, blocker: Blocker, workDays: readonly number[], now: string): MustShipBlockResult | null {
  return db
    .transaction((): MustShipBlockResult | null => {
      const current = getMustShip(db, id);
      if (!current) return null;
      if (current.status !== 'planned') throw invalid('only a planned must ship can be blocked');
      if (current.date === null) throw invalid('a candidate has no day to be blocked on');
      const blocked = { status: 'blocked' as const, blockerWhat: blocker.what, blockerOwner: blocker.owner, blockerNextAction: blocker.nextAction };
      const mustShip = patchMustShip(db, id, blocked, now) as MustShip;
      const task = fileHandedOffTask(
        db,
        {
          title: blocker.nextAction,
          notes: `Blocked: ${blocker.what}`,
          context: current.context,
          status: 'waiting',
          ownerName: blocker.owner,
          expectedOutput: null,
          followUpDate: nextWorkDay(current.date, workDays),
          projectId: current.projectId,
          outcomeId: current.outcomeId,
          mustShipId: current.id,
        },
        now
      );
      return { mustShip, task };
    })
    .immediate();
}
```

- [ ] **Step 6: Mount the routes**

Replace `server/exec/routes/days.ts` with:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { getDayView, setDaySlots } from '../days/store';
import { shutDown } from '../days/shutdown';
import { dayParamsSchema, daySlotsSchema } from '../../../src/shared/exec/todaySchemas';
import { emptyBodySchema } from '../../../src/shared/exec/reviewSchemas';

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

  router.post('/:date/shutdown', (req, res) => {
    const { date } = dayParamsSchema.parse(req.params);
    emptyBodySchema.parse(req.body ?? {});
    ok(res, shutDown(db, date, clock(), weekStartDay()));
  });

  return router;
}
```

Replace `server/exec/routes/mustShips.ts` with:

```ts
import { Router } from 'express';
import type Database from 'better-sqlite3';
import { ok, ApiError } from '../http';
import { nowIso } from '../clock';
import { getSettings } from '../settings/store';
import { createMustShip, listMustShips, patchMustShip, rollMustShip } from '../mustShips/store';
import { blockMustShip } from '../mustShips/block';
import { mustShipCreateSchema, mustShipPatchSchema, mustShipQuerySchema, mustShipRollSchema } from '../../../src/shared/exec/todaySchemas';
import { blockerSchema } from '../../../src/shared/exec/deepWorkSchemas';

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

  router.post('/:id/block', (req, res) => {
    const blocker = blockerSchema.parse(req.body);
    const result = blockMustShip(db, req.params.id, blocker, getSettings(db).workDays, clock());
    if (!result) throw notFound();
    ok(res, result);
  });

  return router;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run server/exec/__tests__/shutdown.test.ts server/exec/__tests__/shutdown-routes.test.ts server/exec/__tests__/days-routes.test.ts server/exec/__tests__/must-ships-routes.test.ts && npm run lint`
Expected: PASS (7 + 3 new tests; the Phase 4 day and Must Ship route tests still pass), lint clean.

- [ ] **Step 8: Commit**

```bash
git add server/exec/days/shutdown.ts server/exec/mustShips/block.ts server/exec/routes/days.ts server/exec/routes/mustShips.ts server/exec/__tests__/shutdown.test.ts server/exec/__tests__/shutdown-routes.test.ts
git commit -m "feat: close the day once its Must Ship is graded, and block a Must Ship from the shutdown"
```

---
### Task 6: What stays open at shutdown, and the client hooks

**Files:**
- Create: `src/shared/exec/shutdown.ts`, `src/api/review.ts`
- Modify: `src/api/keys.ts`, `src/api/days.ts`, `src/api/mustShips.ts`, `src/api/errors.ts`, `src/test/fixtures.ts`
- Test: `src/shared/exec/shutdown.test.ts`, `src/api/review.test.tsx`

**Interfaces:**
- Consumes: `WAITING_STATUSES`, `type Task`, `type TaskStatus` (`schemas.ts`); `type Scoreboard`, `type OutcomeReview`, `type MustShipBlockResult` (Task 1); `type Blocker` (`deepWorkSchemas.ts`); the routes of Tasks 3–5.
- Produces:
  - `openAtShutdown(date: string, secondaries: Task[], scheduled: Task[], waiting: Task[]): { tasks: Task[]; waiting: Task[] }` in `src/shared/exec/shutdown.ts`
  - `scoreboardKey = ['exec', 'scoreboard']` in `src/api/keys.ts`
  - In `src/api/review.ts`: `useScoreboard(weekId: string | null)`, `useWeekHistory(before: string, { enabled?: boolean })`, `useWeekView(weekId: string | null)` (key `[...weeksKey, 'view', weekId]`), `useReviewOutcome()` (variables `{ id, input: OutcomeReview }`), `useFinishReview()` (variables `{ weekId, notes }`)
  - `useShutdown()` in `src/api/days.ts` (variables: the date string)
  - `useBlockMustShip()` in `src/api/mustShips.ts` (variables `{ id, blocker }`)
  - Friendly messages: `SHUTDOWN_NOT_READY` → "grade today's Must Ship first", `REVIEW_NOT_READY` → "grade every outcome first"
  - `makeScoreboard(overrides?: Partial<Scoreboard>): Scoreboard` in `src/test/fixtures.ts` (week `WEEK_ID` of 20 Sep 2026, all zero, a five-day strip of `null`)

- [ ] **Step 1: Write the failing tests**

Create `src/shared/exec/shutdown.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { openAtShutdown } from './shutdown';
import { makeTask } from '../../test/fixtures';

const DATE = '2026-09-29';

describe('openAtShutdown', () => {
  it("keeps today's secondaries not done and the tasks scheduled today, each once", () => {
    const secondary = makeTask({ title: 'Memo', status: 'this_week', scheduledDate: DATE });
    const chosen = makeTask({ title: 'Captured and chosen', status: 'inbox' });
    const scheduled = makeTask({ title: 'Call the bank', status: 'this_week', scheduledDate: DATE });
    const done = makeTask({ title: 'Done already', status: 'done', scheduledDate: DATE });
    const open = openAtShutdown(DATE, [secondary, chosen, done], [secondary, scheduled], []);
    expect(open.tasks.map((task) => task.title)).toEqual(['Memo', 'Captured and chosen', 'Call the bank']);
    expect(open.waiting).toEqual([]);
  });

  it('drops a task moved to a later day, parked, handed off or closed', () => {
    const moved = makeTask({ status: 'this_week', scheduledDate: '2026-09-30' });
    const parked = makeTask({ status: 'later', scheduledDate: null });
    const parkedForToday = makeTask({ title: 'Parked for today', status: 'later', scheduledDate: DATE });
    const handed = makeTask({ status: 'delegated', ownerName: 'Bilal', scheduledDate: DATE, followUpDate: '2026-10-01' });
    const killed = makeTask({ status: 'killed', scheduledDate: DATE });
    const open = openAtShutdown(DATE, [moved, parked, handed], [parkedForToday, killed], []);
    expect(open.tasks.map((task) => task.title)).toEqual(['Parked for today']);
  });

  it('lists waiting items due by today, not later ones or closed ones', () => {
    const due = makeTask({ title: 'Quote from Sana', status: 'waiting', ownerName: 'Sana', followUpDate: DATE });
    const overdue = makeTask({ title: 'Deck from Bilal', status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-25' });
    const later = makeTask({ status: 'waiting', ownerName: 'Sana', followUpDate: '2026-09-30' });
    const received = makeTask({ status: 'done', ownerName: 'Sana', followUpDate: DATE });
    const open = openAtShutdown(DATE, [], [], [due, overdue, later, received]);
    expect(open.waiting.map((task) => task.title)).toEqual(['Quote from Sana', 'Deck from Bilal']);
  });
});
```

Create `src/api/review.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createQueryClient } from './queryClient';
import { useFinishReview, useReviewOutcome, useScoreboard, useWeekHistory, useWeekView } from './review';
import { useShutdown } from './days';
import { useBlockMustShip } from './mustShips';
import { useTasks } from './tasks';
import { ApiError } from './client';
import { errorMessage } from './errors';
import { stubFetch, json } from '../test/fetch';
import { WEEK_ID, makeScoreboard } from '../test/fixtures';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={createQueryClient({ retry: false })}>{children}</QueryClientProvider>
);

afterEach(() => vi.unstubAllGlobals());

describe('review hooks', () => {
  it('reads nothing until there is a week, then its scoreboard and outcomes', async () => {
    const calls = stubFetch(() => json(makeScoreboard()));
    const { rerender } = renderHook(({ id }) => ({ board: useScoreboard(id), view: useWeekView(id) }), {
      wrapper,
      initialProps: { id: null as string | null },
    });
    expect(calls).toHaveLength(0);
    rerender({ id: WEEK_ID });
    await waitFor(() => expect(calls.map((c) => c.url).sort()).toEqual([`/api/exec/weeks/${WEEK_ID}`, `/api/exec/weeks/${WEEK_ID}/scoreboard`]));
  });

  it('reads the earlier weeks before a date once enabled', async () => {
    const calls = stubFetch(() => json([]));
    const { rerender } = renderHook(({ enabled }) => useWeekHistory('2026-10-02', { enabled }), { wrapper, initialProps: { enabled: false } });
    expect(calls).toHaveLength(0);
    rerender({ enabled: true });
    await waitFor(() => expect(calls.map((c) => c.url)).toEqual(['/api/exec/weeks/history?before=2026-10-02']));
  });

  it('grades an outcome and refreshes the scoreboard', async () => {
    const calls = stubFetch(() => json(makeScoreboard()));
    const { result } = renderHook(() => ({ board: useScoreboard(WEEK_ID), grade: useReviewOutcome() }), { wrapper });
    await waitFor(() => expect(result.current.board.isSuccess).toBe(true));
    await act(async () => {
      await result.current.grade.mutateAsync({ id: 'o1', input: { grade: 'done' } });
    });
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/outcomes/o1/review', body: { grade: 'done' } });
    await waitFor(() => expect(calls.filter((c) => c.url.endsWith('/scoreboard'))).toHaveLength(2));
  });

  it('stamps the week with its notes', async () => {
    const calls = stubFetch(() => json({}));
    const { result } = renderHook(() => useFinishReview(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ weekId: WEEK_ID, notes: 'Good week' });
    });
    expect(calls[0]).toMatchObject({ method: 'POST', url: `/api/exec/weeks/${WEEK_ID}/review`, body: { notes: 'Good week' } });
  });
});

describe('shutdown hooks', () => {
  it('closes the day with an empty body', async () => {
    const calls = stubFetch(() => json({}));
    const { result } = renderHook(() => useShutdown(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync('2026-09-29');
    });
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/exec/days/2026-09-29/shutdown', body: {} });
  });

  it('blocks a Must Ship and refreshes the task lists', async () => {
    const calls = stubFetch(() => json([]));
    const { result } = renderHook(() => ({ tasks: useTasks({ status: ['waiting'] }), block: useBlockMustShip() }), { wrapper });
    await waitFor(() => expect(result.current.tasks.isSuccess).toBe(true));
    const blocker = { what: 'No quote', owner: 'Sana', nextAction: 'Chase the quote' };
    await act(async () => {
      await result.current.block.mutateAsync({ id: 'm1', blocker });
    });
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/api/exec/must-ships/m1/block', body: blocker });
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/exec/tasks?status=waiting')).toHaveLength(2));
  });

  it('says the two refusals in plain words', () => {
    expect(errorMessage(new ApiError(409, 'SHUTDOWN_NOT_READY', 'x'))).toBe("grade today's Must Ship first");
    expect(errorMessage(new ApiError(409, 'REVIEW_NOT_READY', 'x'))).toBe('grade every outcome first');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/exec/shutdown.test.ts src/api/review.test.tsx`
Expected: FAIL, the suites cannot resolve `./shutdown`, `./review` or `makeScoreboard`.

- [ ] **Step 3: Write what stays open**

Create `src/shared/exec/shutdown.ts`:

```ts
import { WAITING_STATUSES } from './schemas';
import type { Task, TaskStatus } from './schemas';

export type OpenAtShutdown = { tasks: Task[]; waiting: Task[] };

const OPEN: readonly TaskStatus[] = ['inbox', 'this_week', 'later'];

/** Still due today: not done, not handed off, not moved to a later day, and not parked without a date. */
function stillToday(task: Task, date: string): boolean {
  if (!OPEN.includes(task.status)) return false;
  if (task.scheduledDate !== null && task.scheduledDate > date) return false;
  return !(task.status === 'later' && task.scheduledDate === null);
}

/**
 * Spec C "Shutdown" step 2: today's secondaries not done and the tasks scheduled today, then the waiting items due for
 * follow-up. A task in both lists shows once, and each row drops out as soon as it has been dealt with.
 */
export function openAtShutdown(date: string, secondaries: Task[], scheduled: Task[], waiting: Task[]): OpenAtShutdown {
  const tasks = [...secondaries, ...scheduled].filter(
    (task, index, all) => all.findIndex((other) => other.id === task.id) === index && stillToday(task, date)
  );
  const due = waiting.filter(
    (task) => WAITING_STATUSES.includes(task.status) && task.followUpDate !== null && task.followUpDate <= date && !tasks.some((other) => other.id === task.id)
  );
  return { tasks, waiting: due };
}
```

- [ ] **Step 4: Add the key, the hooks, the messages and the fixture**

In `src/api/keys.ts`, add as the last line:

```ts
export const scoreboardKey = ['exec', 'scoreboard'] as const;
```

Create `src/api/review.ts`:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Outcome, Week, WeekView } from '../shared/exec/schemas';
import type { OutcomeReview, Scoreboard } from '../shared/exec/reviewSchemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { daysKey, projectsKey, scoreboardKey, tasksKey, weeksKey } from './keys';

export { scoreboardKey };

/** A week's numbers; nothing is read until there is a week. */
export function useScoreboard(weekId: string | null) {
  return useQuery<Scoreboard, ApiError>({
    queryKey: [...scoreboardKey, weekId],
    queryFn: () => api.get<Scoreboard>(`/weeks/${weekId}/scoreboard`),
    enabled: weekId !== null,
  });
}

/** Up to twelve earlier weeks with their numbers. Pass `enabled: false` until the date is trustworthy. */
export function useWeekHistory(before: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery<Scoreboard[], ApiError>({
    queryKey: [...scoreboardKey, 'history', before],
    queryFn: () => api.get<Scoreboard[]>(`/weeks/history${toQueryString({ before })}`),
    enabled,
  });
}

/** A week and its outcomes by id: the Friday review can run on any week, not only the current one. */
export function useWeekView(weekId: string | null) {
  return useQuery<WeekView, ApiError>({
    queryKey: [...weeksKey, 'view', weekId],
    queryFn: () => api.get<WeekView>(`/weeks/${weekId}`),
    enabled: weekId !== null,
  });
}

/** A grade can close, kill, roll or delegate an outcome, so everything that shows outcomes, tasks or numbers refreshes. */
function useReviewMutation<TVariables, TData>(mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient();
  return useMutation<TData, ApiError, TVariables>({
    mutationFn,
    onSuccess: () => Promise.all([weeksKey, scoreboardKey, daysKey, projectsKey, tasksKey].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export const useReviewOutcome = () =>
  useReviewMutation(({ id, input }: { id: string; input: OutcomeReview }) => api.post<Outcome>(`/outcomes/${id}/review`, input));

export const useFinishReview = () =>
  useReviewMutation(({ weekId, notes }: { weekId: string; notes: string }) => api.post<Week>(`/weeks/${weekId}/review`, { notes }));
```

Replace `src/api/days.ts` with:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { DayView } from '../shared/exec/todaySchemas';
import { api, ApiError } from './client';
import { daysKey, deepWorkKey, scoreboardKey, tasksKey } from './keys';

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

/** Closing the day can end a running session, so the blocks and the week's numbers refresh with the day. */
export function useShutdown() {
  const queryClient = useQueryClient();
  return useMutation<DayView, ApiError, string>({
    mutationFn: (date) => api.post<DayView>(`/days/${date}/shutdown`, {}),
    onSuccess: () => Promise.all([daysKey, deepWorkKey, scoreboardKey].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
```

Replace `src/api/mustShips.ts` with:

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Context } from '../shared/exec/schemas';
import type { MustShip, MustShipInput, MustShipPatch, MustShipStatus } from '../shared/exec/todaySchemas';
import type { Blocker } from '../shared/exec/deepWorkSchemas';
import type { MustShipBlockResult } from '../shared/exec/reviewSchemas';
import { api, ApiError } from './client';
import { toQueryString } from './query';
import { daysKey, mustShipsKey, projectsKey, tasksKey } from './keys';

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

/** Shutdown's Blocked: the blocker lands on the Must Ship and a waiting task is filed, so the task lists refresh too. */
export function useBlockMustShip() {
  const queryClient = useQueryClient();
  return useMutation<MustShipBlockResult, ApiError, { id: string; blocker: Blocker }>({
    mutationFn: ({ id, blocker }) => api.post<MustShipBlockResult>(`/must-ships/${id}/block`, blocker),
    onSuccess: () => Promise.all([mustShipsKey, daysKey, projectsKey, tasksKey].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
```

In `src/api/errors.ts`, replace the `FRIENDLY` constant with:

```ts
const FRIENDLY: Partial<Record<ApiError['code'], string>> = {
  NETWORK: 'the local API is not reachable',
  WEEK_FULL: 'this week already has three outcomes',
  CONSTRAINT: 'that conflicts with saved data',
  DAY_TAKEN: 'that day already has a Must Ship',
  SLOT_LIMIT: 'a day holds at most two secondary tasks',
  SHUTDOWN_NOT_READY: "grade today's Must Ship first",
  REVIEW_NOT_READY: 'grade every outcome first',
};
```

In `src/test/fixtures.ts`, add to the imports:

```ts
import type { Scoreboard } from '../shared/exec/reviewSchemas';
```

and append at the end of the file:

```ts
/** The numbers of the week of 20 Sep 2026, all zero and a strip with no Must Ships, unless overridden. */
export const makeScoreboard = (overrides: Partial<Scoreboard> = {}): Scoreboard => ({
  weekId: WEEK_ID,
  startDate: '2026-09-20',
  reviewedAt: null,
  outcomes: { shipped: 0, total: 0 },
  mustShips: { shipped: 0, total: 0 },
  deepWorkMinutes: 0,
  rolledForward: 0,
  killed: 0,
  delegated: 0,
  strip: ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'].map((date) => ({ date, status: null })),
  ...overrides,
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/shared/exec/shutdown.test.ts src/api && npm run lint`
Expected: PASS (3 + 7 new tests; every existing `src/api` test still passes), lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/shared/exec/shutdown.ts src/shared/exec/shutdown.test.ts src/api/keys.ts src/api/review.ts src/api/review.test.tsx src/api/days.ts src/api/mustShips.ts src/api/errors.ts src/test/fixtures.ts
git commit -m "feat: add the shutdown and review hooks and work out what stays open at shutdown"
```

---
### Task 7: Shutdown step 1, grading today's Must Ship

**Files:**
- Modify: `src/components/focus/BlockerForm.tsx` (an optional `submitLabel`)
- Create: `src/components/shutdown/GradeToday.tsx`
- Test: `src/components/shutdown/GradeToday.test.tsx`

**Interfaces:**
- Consumes: `useUpdateMustShip`, `useRollMustShip`, `useBlockMustShip` (Task 6) from `src/api/mustShips.ts`; `useReportError`; `dayLabel` (`today.ts`); `BlockerForm`.
- Produces:
  - `BlockerForm` takes `submitLabel?: string` (default `'File the next action and stop'`, so `/focus` is unchanged)
  - `GradeToday({ next, mustShip }: { next: string; mustShip: MustShip })`: a region named "What shipped today?" with a "Grade" group of four toggle buttons (Shipped, Partial, Missed, Blocked), a "Roll to <day label>" checkbox (on) for Partial and Missed, a Save button, and for Blocked the blocker form with the submit label "Record the blocker". Partial and Missed roll first, then grade.

- [ ] **Step 1: Write the failing test**

Create `src/components/shutdown/GradeToday.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GradeToday } from './GradeToday';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json, failure } from '../../test/fetch';
import { makeMustShip } from '../../test/fixtures';

afterEach(() => vi.unstubAllGlobals());

const ship = makeMustShip({ title: 'Delivery tracker sent', date: '2026-09-29' });
const writes = (calls: { method: string; url: string; body?: unknown }[]) => calls.filter((c) => c.method !== 'GET');
const render = () => renderWithProviders(<GradeToday next="2026-09-30" mustShip={ship} />);

describe('GradeToday', () => {
  it('keeps Save disabled until a grade is chosen, then grades Shipped without rolling', async () => {
    const calls = stubFetch(() => json({}));
    render();
    expect(screen.getByRole('region', { name: 'What shipped today?' })).toHaveTextContent('Delivery tracker sent');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Shipped' }));
    expect(screen.getByRole('button', { name: 'Shipped' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('checkbox')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toEqual([{ method: 'PATCH', url: `/api/exec/must-ships/${ship.id}`, body: { status: 'shipped' } }]));
  });

  it('rolls a partial one to the next work day before grading it', async () => {
    const calls = stubFetch(() => json({}));
    render();
    await userEvent.click(screen.getByRole('button', { name: 'Partial' }));
    expect(screen.getByRole('checkbox', { name: 'Roll to Wednesday 30 September' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(writes(calls)).toEqual([
        { method: 'POST', url: `/api/exec/must-ships/${ship.id}/roll`, body: { date: '2026-09-30' } },
        { method: 'PATCH', url: `/api/exec/must-ships/${ship.id}`, body: { status: 'partial' } },
      ])
    );
  });

  it('grades a missed one without rolling when the box is unticked', async () => {
    const calls = stubFetch(() => json({}));
    render();
    await userEvent.click(screen.getByRole('button', { name: 'Missed' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Roll to Wednesday 30 September' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writes(calls)).toEqual([{ method: 'PATCH', url: `/api/exec/must-ships/${ship.id}`, body: { status: 'missed' } }]));
  });

  it('still grades when the roll is refused, and says why', async () => {
    const calls = stubFetch((url) => (url.endsWith('/roll') ? failure(409, 'DAY_TAKEN', 'that day already has a must ship') : json({})));
    render();
    await userEvent.click(screen.getByRole('button', { name: 'Partial' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Could not roll it to Wednesday 30 September: that day already has a Must Ship')).toBeInTheDocument();
    await waitFor(() => expect(writes(calls).at(-1)).toEqual({ method: 'PATCH', url: `/api/exec/must-ships/${ship.id}`, body: { status: 'partial' } }));
  });

  it('records a blocker and files its next action', async () => {
    const calls = stubFetch(() => json({}));
    render();
    await userEvent.click(screen.getByRole('button', { name: 'Blocked' }));
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    await userEvent.type(screen.getByLabelText('What blocks it?'), 'No quote from the venue');
    await userEvent.type(screen.getByLabelText('Who owns the unblock?'), 'Sana');
    await userEvent.type(screen.getByLabelText('What is the next action?'), 'Chase the venue quote');
    await userEvent.click(screen.getByRole('button', { name: 'Record the blocker' }));
    await waitFor(() =>
      expect(writes(calls)).toEqual([
        {
          method: 'POST',
          url: `/api/exec/must-ships/${ship.id}/block`,
          body: { what: 'No quote from the venue', owner: 'Sana', nextAction: 'Chase the venue quote' },
        },
      ])
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/shutdown/GradeToday.test.tsx`
Expected: FAIL, the suite cannot resolve `./GradeToday`.

- [ ] **Step 3: Let the blocker form name its button**

In `src/components/focus/BlockerForm.tsx`, change the props type and the signature so they read:

```tsx
type Props = { pending: boolean; submitLabel?: string; onSubmit: (blocker: Blocker) => void; onCancel: () => void };
```

```tsx
export function BlockerForm({ pending, submitLabel = 'File the next action and stop', onSubmit, onCancel }: Props) {
```

and replace the submit button's text `File the next action and stop` with `{submitLabel}`.

- [ ] **Step 4: Write the step**

Create `src/components/shutdown/GradeToday.tsx`:

```tsx
import { useState } from 'react';
import { useBlockMustShip, useRollMustShip, useUpdateMustShip } from '../../api/mustShips';
import { useReportError } from '../../api/errors';
import type { ApiError } from '../../api/client';
import { dayLabel } from '../../shared/exec/today';
import type { Blocker } from '../../shared/exec/deepWorkSchemas';
import type { MustShip } from '../../shared/exec/todaySchemas';
import { BlockerForm } from '../focus/BlockerForm';

type Props = { next: string; mustShip: MustShip };
type Grade = 'shipped' | 'partial' | 'missed' | 'blocked';

const GRADES: { grade: Grade; label: string }[] = [
  { grade: 'shipped', label: 'Shipped' },
  { grade: 'partial', label: 'Partial' },
  { grade: 'missed', label: 'Missed' },
  { grade: 'blocked', label: 'Blocked' },
];
const CHOICE =
  'rounded border border-line px-3 py-1.5 aria-pressed:bg-ink aria-pressed:text-paper dark:border-ink-muted dark:aria-pressed:bg-paper dark:aria-pressed:text-ink';
const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

/** Shutdown step 1 (spec C): grade today's Must Ship. Partial and Missed roll it to the next work day unless unticked. */
export function GradeToday({ next, mustShip }: Props) {
  const update = useUpdateMustShip();
  const roll = useRollMustShip();
  const block = useBlockMustShip();
  const report = useReportError();
  const [grade, setGrade] = useState<Grade | null>(null);
  const [rollOn, setRollOn] = useState(true);
  const pending = update.isPending || roll.isPending || block.isPending;
  const slipped = grade === 'partial' || grade === 'missed';

  // Roll first, then grade: the grade moves Shutdown on to step 2, and a roll must not be left to a step that has gone.
  const save = async () => {
    if (grade === null || grade === 'blocked') return;
    if (slipped && rollOn) await roll.mutateAsync({ id: mustShip.id, date: next }).catch((error: ApiError) => report(`roll it to ${dayLabel(next)}`)(error));
    await update.mutateAsync({ id: mustShip.id, patch: { status: grade } }).catch((error: ApiError) => report('grade the Must Ship')(error));
  };
  const saveBlocked = (blocker: Blocker) => block.mutateAsync({ id: mustShip.id, blocker }).catch((error: ApiError) => report('record the blocker')(error));

  return (
    <section aria-label="What shipped today?" className="space-y-3">
      <h2 className="text-xl font-medium">What shipped today?</h2>
      <p className="text-2xl font-semibold">{mustShip.title}</p>
      {mustShip.definitionOfDone && <p className="text-ink-muted">{mustShip.definitionOfDone}</p>}
      <div role="group" aria-label="Grade" className="flex flex-wrap gap-2">
        {GRADES.map((choice) => (
          <button key={choice.grade} type="button" aria-pressed={grade === choice.grade} onClick={() => setGrade(choice.grade)} className={CHOICE}>
            {choice.label}
          </button>
        ))}
      </div>
      {slipped && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={rollOn} onChange={(event) => setRollOn(event.target.checked)} />
          Roll to {dayLabel(next)}
        </label>
      )}
      {grade === 'blocked' ? (
        <BlockerForm pending={pending} submitLabel="Record the blocker" onCancel={() => setGrade(null)} onSubmit={(blocker) => void saveBlocked(blocker)} />
      ) : (
        <button type="button" disabled={grade === null || pending} onClick={() => void save()} className={PRIMARY}>
          Save
        </button>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/shutdown src/components/focus src/screens/Focus.test.tsx && npm run lint`
Expected: PASS (5 new tests; the Phase 5 focus tests, which use the default button label, still pass), lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/focus/BlockerForm.tsx src/components/shutdown/GradeToday.tsx src/components/shutdown/GradeToday.test.tsx
git commit -m "feat: grade today's Must Ship at shutdown, rolling a partial or missed one to the next work day"
```

---

### Task 8: Shutdown step 2, what remains open

**Files:**
- Create: `src/components/shutdown/OpenRow.tsx`, `src/components/shutdown/OpenItems.tsx`
- Test: `src/components/shutdown/OpenItems.test.tsx`

**Interfaces:**
- Consumes: `openAtShutdown` (Task 6); `useTasks`, `useUpdateTask`, `useRollTask` (`src/api/tasks.ts`); `useReportError`; `scheduleStatus` (`src/lib/inboxRules.ts`); `DelegatePanel`, `SchedulePanel` (`src/components/inbox/`); `LoadError`.
- Produces:
  - `OpenRow({ task, today, next, weekStartDay })`: one list item with five buttons, named `Move "<title>" to tomorrow`, `Schedule "<title>"`, `Delegate "<title>"`, `Park "<title>" for later`, `Kill "<title>"` (visible text Tomorrow, Schedule, Delegate, Later, Kill)
  - `OpenItems({ today, next, weekStartDay, view, onNext })`: a region named "What remains open?" with the lists "Open tasks" and "Waiting on others" (buttons `Follow up on "<title>" tomorrow`, `Received "<title>"`, `Kill "<title>"`), the captured-items line with a "Process now" link to `/inbox`, and "Next: tomorrow's Must Ship", disabled until nothing is open

- [ ] **Step 1: Write the failing test**

Create `src/components/shutdown/OpenItems.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { OpenItems } from './OpenItems';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json, failure, type FetchCall } from '../../test/fetch';
import { makeDayView, makeTask } from '../../test/fixtures';
import type { DayView } from '../../shared/exec/todaySchemas';
import type { Task } from '../../shared/exec/schemas';

afterEach(() => vi.unstubAllGlobals());

const TODAY = '2026-09-29';
const NEXT = '2026-09-30';
const memo = makeTask({ title: 'Pricing memo', status: 'this_week', scheduledDate: TODAY });
const call = makeTask({ title: 'Call the bank', status: 'this_week', scheduledDate: TODAY });
const quote = makeTask({ title: 'Venue quote', status: 'waiting', ownerName: 'Sana', followUpDate: TODAY });

function render(view: DayView, onNext = vi.fn()) {
  renderWithProviders(
    <MemoryRouter>
      <OpenItems today={TODAY} next={NEXT} weekStartDay={0} view={view} onNext={onNext} />
    </MemoryRouter>
  );
  return onNext;
}
/** The last write: a write refreshes the task list, so the last call of all is often a read. */
const lastWrite = (calls: FetchCall[]) => calls.filter((c) => c.method !== 'GET').at(-1);
const api = (scheduled: Task[]) => stubFetch((url) => (url === `/api/exec/tasks?week=${TODAY}` ? json(scheduled) : json({})));

describe('OpenItems', () => {
  it('lists the open secondaries, the tasks scheduled today and the waiting items, and holds Next', async () => {
    api([memo, call]);
    render(makeDayView({ secondaries: [{ slot: 1, task: memo }], waiting: [quote], inboxCount: 3 }));
    const open = await screen.findByRole('list', { name: 'Open tasks' });
    expect(within(open).getAllByRole('listitem').map((item) => item.firstChild?.textContent)).toEqual(['Pricing memo', 'Call the bank']);
    expect(within(screen.getByRole('list', { name: 'Waiting on others' })).getByText('Venue quote — Sana')).toBeInTheDocument();
    expect(screen.getByText('3 still open.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: "Next: tomorrow's Must Ship" })).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Process now' })).toHaveAttribute('href', '/inbox');
    expect(screen.getByText(/^3 captured items/)).toBeInTheDocument();
  });

  it('moves, parks and kills rows with one click each', async () => {
    const calls = api([memo, call]);
    render(makeDayView({ waiting: [quote] }));
    await userEvent.click(await screen.findByRole('button', { name: 'Move "Pricing memo" to tomorrow' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'POST', url: `/api/exec/tasks/${memo.id}/roll`, body: { date: NEXT } }));
    await userEvent.click(screen.getByRole('button', { name: 'Park "Call the bank" for later' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', url: `/api/exec/tasks/${call.id}`, body: { status: 'later', scheduledDate: null } }));
    await userEvent.click(screen.getByRole('button', { name: 'Kill "Call the bank"' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', body: { status: 'killed' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Follow up on "Venue quote" tomorrow' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', url: `/api/exec/tasks/${quote.id}`, body: { followUpDate: NEXT } }));
    await userEvent.click(screen.getByRole('button', { name: 'Received "Venue quote"' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', body: { status: 'done' } }));
  });

  it('schedules and delegates through their panels', async () => {
    const calls = api([memo]);
    render(makeDayView());
    await userEvent.click(await screen.findByRole('button', { name: 'Schedule "Pricing memo"' }));
    const schedule = screen.getByRole('form', { name: 'Schedule Pricing memo' });
    await userEvent.clear(within(schedule).getByLabelText('On'));
    await userEvent.type(within(schedule).getByLabelText('On'), '2026-10-07');
    await userEvent.click(within(schedule).getByRole('button', { name: 'Schedule' }));
    await waitFor(() => expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', body: { status: 'later', scheduledDate: '2026-10-07' } }));
    await userEvent.click(screen.getByRole('button', { name: 'Delegate "Pricing memo"' }));
    const delegate = screen.getByRole('form', { name: 'Delegate Pricing memo' });
    await userEvent.type(within(delegate).getByLabelText('Owner'), 'Bilal');
    await userEvent.click(within(delegate).getByRole('button', { name: 'Delegate' }));
    await waitFor(() =>
      expect(lastWrite(calls)).toMatchObject({ method: 'PATCH', body: { status: 'delegated', ownerName: 'Bilal', expectedOutput: null, followUpDate: NEXT } })
    );
  });

  it('moves on once nothing is open', async () => {
    api([makeTask({ status: 'this_week', scheduledDate: NEXT })]);
    const onNext = render(makeDayView());
    expect(await screen.findByText('Nothing left open today.')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Process now' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: "Next: tomorrow's Must Ship" }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("says so when today's tasks cannot be read, and holds Next", async () => {
    stubFetch(() => failure(500, 'INTERNAL', 'internal server error'));
    render(makeDayView());
    expect(await screen.findByRole('alert')).toHaveTextContent("Could not load today's tasks: internal server error");
    expect(screen.getByRole('button', { name: "Next: tomorrow's Must Ship" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/shutdown/OpenItems.test.tsx`
Expected: FAIL, the suite cannot resolve `./OpenItems`.

- [ ] **Step 3: Write a row**

Create `src/components/shutdown/OpenRow.tsx`:

```tsx
import { useState } from 'react';
import { useRollTask, useUpdateTask } from '../../api/tasks';
import { useReportError } from '../../api/errors';
import { scheduleStatus } from '../../lib/inboxRules';
import type { Task, TaskPatch } from '../../shared/exec/schemas';
import { DelegatePanel } from '../inbox/DelegatePanel';
import { SchedulePanel } from '../inbox/SchedulePanel';

type Props = { task: Task; today: string; next: string; weekStartDay: number };

const SMALL = 'rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-40 dark:border-ink-muted dark:hover:text-paper';

/** One open task at shutdown (spec C step 2): Tomorrow, Schedule, Delegate, Later or Kill. */
export function OpenRow({ task, today, next, weekStartDay }: Props) {
  const update = useUpdateTask();
  const roll = useRollTask();
  const report = useReportError();
  const [panel, setPanel] = useState<'schedule' | 'delegate' | null>(null);
  const patch = (fields: TaskPatch) => update.mutate({ id: task.id, patch: fields }, { onSuccess: () => setPanel(null), onError: report('update the task') });
  const actions: { label: string; name: string; act: () => void }[] = [
    { label: 'Tomorrow', name: `Move "${task.title}" to tomorrow`, act: () => roll.mutate({ id: task.id, date: next }, { onError: report('move it to tomorrow') }) },
    { label: 'Schedule', name: `Schedule "${task.title}"`, act: () => setPanel('schedule') },
    { label: 'Delegate', name: `Delegate "${task.title}"`, act: () => setPanel('delegate') },
    { label: 'Later', name: `Park "${task.title}" for later`, act: () => patch({ status: 'later', scheduledDate: null }) },
    { label: 'Kill', name: `Kill "${task.title}"`, act: () => patch({ status: 'killed' }) },
  ];
  return (
    <li className="space-y-2 border-t border-line py-2 dark:border-ink-muted">
      <span className="block">{task.title}</span>
      <div className="flex flex-wrap gap-1">
        {actions.map((action) => (
          <button key={action.label} type="button" aria-label={action.name} disabled={update.isPending || roll.isPending} onClick={action.act} className={SMALL}>
            {action.label}
          </button>
        ))}
      </div>
      {panel === 'schedule' && (
        <SchedulePanel task={task} defaultDate={next} onCancel={() => setPanel(null)} onSubmit={(date) => patch({ status: scheduleStatus(date, today, weekStartDay), scheduledDate: date })} />
      )}
      {panel === 'delegate' && (
        <DelegatePanel task={task} defaultFollowUp={next} onCancel={() => setPanel(null)} onSubmit={(fields) => patch({ status: 'delegated', ...fields })} />
      )}
    </li>
  );
}
```

- [ ] **Step 4: Write the step**

Create `src/components/shutdown/OpenItems.tsx`:

```tsx
import { Link } from 'react-router-dom';
import { useTasks, useUpdateTask } from '../../api/tasks';
import { useReportError } from '../../api/errors';
import { openAtShutdown } from '../../shared/exec/shutdown';
import type { Task, TaskPatch } from '../../shared/exec/schemas';
import type { DayView } from '../../shared/exec/todaySchemas';
import { LoadError } from '../LoadError';
import { OpenRow } from './OpenRow';

type Props = { today: string; next: string; weekStartDay: number; view: DayView; onNext: () => void };

const SMALL = 'rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink dark:border-ink-muted dark:hover:text-paper';
const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

/** A delegated or waiting item due for follow-up: follow up tomorrow, mark it received, or kill it. */
function WaitingRow({ task, next }: { task: Task; next: string }) {
  const update = useUpdateTask();
  const report = useReportError();
  const act = (patch: TaskPatch, verb: string) => update.mutate({ id: task.id, patch }, { onError: report(verb) });
  return (
    <li className="flex flex-wrap items-center gap-2 border-t border-line py-2 dark:border-ink-muted">
      <span className="flex-1">{task.title} — {task.ownerName}</span>
      <button type="button" aria-label={`Follow up on "${task.title}" tomorrow`} onClick={() => act({ followUpDate: next }, 'move the follow-up')} className={SMALL}>Tomorrow</button>
      <button type="button" aria-label={`Received "${task.title}"`} onClick={() => act({ status: 'done' }, 'mark it received')} className={SMALL}>Received</button>
      <button type="button" aria-label={`Kill "${task.title}"`} onClick={() => act({ status: 'killed' }, 'kill it')} className={SMALL}>Kill</button>
    </li>
  );
}

const captured = (count: number): string => (count === 1 ? '1 captured item' : `${count} captured items`);

/** Shutdown step 2 (spec C): every open row is dealt with before tomorrow is chosen. Captures are counted and may wait. */
export function OpenItems({ today, next, weekStartDay, view, onNext }: Props) {
  const week = useTasks({ week: today });
  const scheduled = week.isSuccess ? week.data.filter((task) => task.scheduledDate === today) : [];
  const open = openAtShutdown(today, view.secondaries.map((secondary) => secondary.task), scheduled, view.waiting);
  const remaining = open.tasks.length + open.waiting.length;
  return (
    <section aria-label="What remains open?" className="space-y-3">
      <h2 className="text-xl font-medium">What remains open?</h2>
      {week.isError && <LoadError what="today's tasks" error={week.error} onRetry={() => void week.refetch()} />}
      {week.isPending && <p className="text-ink-muted">Loading today's tasks…</p>}
      {week.isSuccess && remaining === 0 && <p className="text-ink-muted">Nothing left open today.</p>}
      {week.isSuccess && open.tasks.length > 0 && (
        <ul aria-label="Open tasks">
          {open.tasks.map((task) => <OpenRow key={task.id} task={task} today={today} next={next} weekStartDay={weekStartDay} />)}
        </ul>
      )}
      {week.isSuccess && open.waiting.length > 0 && (
        <ul aria-label="Waiting on others">
          {open.waiting.map((task) => <WaitingRow key={task.id} task={task} next={next} />)}
        </ul>
      )}
      {view.inboxCount > 0 && (
        <p>
          {captured(view.inboxCount)} in the Inbox. <Link to="/inbox" className="underline">Process now</Link>, or leave them for tomorrow.
        </p>
      )}
      <div className="flex items-center gap-3">
        <button type="button" disabled={!week.isSuccess || remaining > 0} onClick={onNext} className={PRIMARY}>Next: tomorrow's Must Ship</button>
        {week.isSuccess && remaining > 0 && <p className="text-sm text-ink-muted">{remaining} still open.</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/components/shutdown && npm run lint`
Expected: PASS (5 new tests plus Task 7's 5), lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/shutdown/OpenRow.tsx src/components/shutdown/OpenItems.tsx src/components/shutdown/OpenItems.test.tsx
git commit -m "feat: list what remains open at shutdown and dispose of each row"
```

---
### Task 9: The Shutdown screen, tomorrow's plan and "Tomorrow is ready"

**Files:**
- Create: `src/components/shutdown/TomorrowSteps.tsx`
- Modify: `src/screens/Shutdown.tsx` (replace the Phase 1 shell)
- Test: `src/screens/Shutdown.test.tsx`

**Interfaces:**
- Consumes: `GradeToday` (Task 7), `OpenItems` (Task 8), `useDay`, `useShutdown` (Task 6); `MustShipPicker`, `Secondaries`, `TomorrowCard`, `LoadError`, `ScreenShell`; `useToday`; `dayLabel`, `nextWorkDay` (`today.ts`); `contextOf` (`week.ts`); `MUST_SHIP_STATUS_LABELS`.
- Produces:
  - `TomorrowMustShip({ view, onNext })`: region "Tomorrow's Must Ship", heading "Must Ship for <day label>"; the Must Ship with "Rolled forward once" / "Rolled forward N times" and a Continue button, or the picker (no Continue) when there is none
  - `TomorrowSecondaries({ view, pending, onFinish })`: region "Tomorrow's secondaries" holding the `Secondaries` editor for that date, and a "Close the day" button
  - `/shutdown`: step 1 while today's work Must Ship is `planned`; otherwise a line "Today: <title> · <status>" and steps 2 → 3 → 4 in order; once the day has `shutdownAt`, `TomorrowCard` ("Tomorrow is ready"), the list "Tomorrow's secondaries" and a "Back to Today" link

- [ ] **Step 1: Write the failing test**

Create `src/screens/Shutdown.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeDayView, makeMustShip, makeTask } from '../test/fixtures';
import type { DayView, MustShip } from '../shared/exec/todaySchemas';
import type { Task } from '../shared/exec/schemas';

const TODAY = '2026-09-29';
const NEXT = '2026-09-30';
const CLOSED = '2026-09-29T12:40:00.000Z';
const ship = makeMustShip({ title: 'Delivery tracker sent', date: TODAY });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Tuesday 29 September, 17:30 in Karachi. */
const at530pm = () => vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-09-29T12:30:00Z') });
const closedDay = { date: TODAY, shutdownAt: CLOSED, notes: '', createdAt: CLOSED, updatedAt: CLOSED };

type World = { today: DayView; tomorrow: DayView; tasks: Task[] };

/** A stateful fake of the routes Shutdown reads and writes. */
function fakeShutdownApi(start: Partial<World> = {}) {
  const world: World = { today: makeDayView({ date: TODAY }), tomorrow: makeDayView({ date: NEXT }), tasks: [], ...start };
  return stubFetch((url, init) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const current = world.today.mustShip as MustShip;
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url === `/api/exec/days/${TODAY}`) return json(world.today);
    if (url === `/api/exec/days/${NEXT}`) return json(world.tomorrow);
    if (url.startsWith('/api/exec/tasks?')) return json(world.tasks);
    if (method === 'POST' && url.startsWith('/api/exec/tasks/')) {
      world.tasks = world.tasks.map((task) => (url.includes(task.id) ? { ...task, scheduledDate: body.date } : task));
      return json({});
    }
    if (method === 'POST' && url.endsWith('/roll')) {
      const rolled = { ...current, id: '40000000-0000-4000-8000-000000000777', date: NEXT, rolledFromId: current.id, rollCount: 1 };
      world.tomorrow = { ...world.tomorrow, mustShip: rolled };
      return json(rolled, 201);
    }
    if (method === 'PATCH' && url.includes('/must-ships/')) {
      world.today = { ...world.today, mustShip: { ...current, ...body } };
      return json(world.today.mustShip);
    }
    if (method === 'POST' && url.endsWith('/shutdown')) {
      world.today = { ...world.today, day: closedDay };
      return json(world.today);
    }
    return json([]);
  });
}

const clickWhenEnabled = async (name: string) => {
  const button = await screen.findByRole('button', { name });
  await waitFor(() => expect(button).toBeEnabled());
  await userEvent.click(button);
};

describe('/shutdown', () => {
  it('walks the four steps and ends on "Tomorrow is ready"', async () => {
    at530pm();
    const memo = makeTask({ title: 'Pricing memo', status: 'this_week', scheduledDate: TODAY });
    const calls = fakeShutdownApi({ today: makeDayView({ date: TODAY, mustShip: ship }), tasks: [memo] });
    renderRoute('/shutdown');
    expect(await screen.findByText('Tuesday 29 September')).toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Partial' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    const open = await screen.findByRole('region', { name: 'What remains open?' });
    expect(screen.getByText('Today: Delivery tracker sent · Partial')).toBeInTheDocument();
    await userEvent.click(await within(open).findByRole('button', { name: 'Move "Pricing memo" to tomorrow' }));
    await clickWhenEnabled("Next: tomorrow's Must Ship");

    const next = await screen.findByRole('region', { name: "Tomorrow's Must Ship" });
    expect(within(next).getByText('Delivery tracker sent')).toBeInTheDocument();
    expect(within(next).getByText('Rolled forward once')).toBeInTheDocument();
    await userEvent.click(within(next).getByRole('button', { name: 'Continue' }));
    await clickWhenEnabled('Close the day');

    expect(await screen.findByRole('heading', { level: 2, name: 'Tomorrow is ready' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday 30 September: Delivery tracker sent')).toBeInTheDocument();
    expect(calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.url}`)).toEqual([
      `POST /api/exec/must-ships/${ship.id}/roll`,
      `PATCH /api/exec/must-ships/${ship.id}`,
      `POST /api/exec/tasks/${memo.id}/roll`,
      `POST /api/exec/days/${TODAY}/shutdown`,
    ]);
  });

  it("lands on step 2 when today's Must Ship is already graded, and step 3 asks for tomorrow's", async () => {
    at530pm();
    fakeShutdownApi({ today: makeDayView({ date: TODAY, mustShip: { ...ship, status: 'shipped' } }) });
    renderRoute('/shutdown');
    const open = await screen.findByRole('region', { name: 'What remains open?' });
    expect(await within(open).findByText('Nothing left open today.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What shipped today?' })).toBeNull();
    await clickWhenEnabled("Next: tomorrow's Must Ship");
    const next = await screen.findByRole('region', { name: "Tomorrow's Must Ship" });
    expect(within(next).getByRole('heading', { name: 'Must Ship for Wednesday 30 September' })).toBeInTheDocument();
    expect(within(next).getByRole('button', { name: 'Set Must Ship' })).toBeInTheDocument();
    expect(within(next).queryByRole('button', { name: 'Continue' })).toBeNull();
  });

  it('shows "Tomorrow is ready" when the day is already closed', async () => {
    at530pm();
    fakeShutdownApi({
      today: makeDayView({ date: TODAY, day: closedDay }),
      tomorrow: makeDayView({
        date: NEXT,
        mustShip: makeMustShip({ title: 'Price list sent', date: NEXT }),
        secondaries: [{ slot: 1, task: makeTask({ title: 'Book the venue' }) }],
      }),
    });
    renderRoute('/shutdown');
    expect(await screen.findByRole('heading', { level: 2, name: 'Tomorrow is ready' })).toBeInTheDocument();
    expect(screen.getByText('Wednesday 30 September: Price list sent')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: "Tomorrow's secondaries" })).getByText('Book the venue')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Today' })).toHaveAttribute('href', '/');
  });

  it('says so when the server refuses to close the day', async () => {
    at530pm();
    stubFetch((url) => {
      if (url.endsWith('/settings')) return json(SETTINGS);
      if (url === `/api/exec/days/${TODAY}`) return json(makeDayView({ date: TODAY }));
      if (url === `/api/exec/days/${NEXT}`) return json(makeDayView({ date: NEXT, mustShip: makeMustShip({ title: 'Price list sent', date: NEXT }) }));
      if (url.endsWith('/shutdown')) return failure(409, 'SHUTDOWN_NOT_READY', "grade today's Must Ship before closing the day");
      return json([]);
    });
    renderRoute('/shutdown');
    await clickWhenEnabled("Next: tomorrow's Must Ship");
    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await clickWhenEnabled('Close the day');
    expect(await screen.findByText("Could not close the day: grade today's Must Ship first")).toBeInTheDocument();
  });

  it('says so when today cannot be read', async () => {
    at530pm();
    stubFetch((url) => (url.endsWith('/settings') ? json(SETTINGS) : url.includes('/days/') ? failure(500, 'INTERNAL', 'internal server error') : json([])));
    renderRoute('/shutdown');
    expect(await screen.findByText('Could not load today: internal server error')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'What shipped today?' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/screens/Shutdown.test.tsx`
Expected: FAIL, the Phase 1 shell only says "Arrives in Phase 6." and every test times out finding its first element.

- [ ] **Step 3: Write steps 3 and 4**

Create `src/components/shutdown/TomorrowSteps.tsx`:

```tsx
import { contextOf } from '../../shared/exec/week';
import { dayLabel } from '../../shared/exec/today';
import type { DayView } from '../../shared/exec/todaySchemas';
import { MustShipPicker } from '../mustShip/MustShipPicker';
import { Secondaries } from '../today/Secondaries';

const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

const rolled = (count: number): string => (count === 1 ? 'Rolled forward once' : `Rolled forward ${count} times`);

/** Step 3 (spec C): tomorrow's Must Ship is required; one rolled in step 1 is already there. */
export function TomorrowMustShip({ view, onNext }: { view: DayView; onNext: () => void }) {
  // A week with no plan yet has no outcomes: the picker then offers "No outcome" only.
  const work = (view.week?.outcomes ?? []).filter((outcome) => outcome.slot !== null && outcome.status === 'active' && contextOf(outcome.category) === 'work');
  return (
    <section aria-label="Tomorrow's Must Ship" className="space-y-3">
      <h2 className="text-xl font-medium">Must Ship for {dayLabel(view.date)}</h2>
      {view.mustShip ? (
        <>
          <p className="text-2xl font-semibold">{view.mustShip.title}</p>
          {view.mustShip.rollCount > 0 && <p className="text-sm text-ink-muted">{rolled(view.mustShip.rollCount)}</p>}
          <button type="button" onClick={onNext} className={PRIMARY}>Continue</button>
        </>
      ) : (
        <MustShipPicker date={view.date} context="work" outcomes={work} />
      )}
    </section>
  );
}

/** Step 4 (spec C): up to two secondaries for tomorrow, optional; then the day closes. */
export function TomorrowSecondaries({ view, pending, onFinish }: { view: DayView; pending: boolean; onFinish: () => void }) {
  return (
    <section aria-label="Tomorrow's secondaries" className="space-y-3">
      <h2 className="text-xl font-medium">Secondary priorities for {dayLabel(view.date)}</h2>
      <p className="text-ink-muted">Optional. At most two.</p>
      <Secondaries date={view.date} secondaries={view.secondaries} />
      <button type="button" disabled={pending} onClick={onFinish} className={PRIMARY}>Close the day</button>
    </section>
  );
}
```

- [ ] **Step 4: Write the screen**

Replace `src/screens/Shutdown.tsx` with:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { LoadError } from '../components/LoadError';
import { GradeToday } from '../components/shutdown/GradeToday';
import { OpenItems } from '../components/shutdown/OpenItems';
import { TomorrowMustShip, TomorrowSecondaries } from '../components/shutdown/TomorrowSteps';
import { TomorrowCard } from '../components/today/TomorrowCard';
import { useDay, useShutdown } from '../api/days';
import { useReportError } from '../api/errors';
import { useToday } from '../lib/useToday';
import { MUST_SHIP_STATUS_LABELS } from '../lib/labels';
import { dayLabel, nextWorkDay } from '../shared/exec/today';
import type { DayView } from '../shared/exec/todaySchemas';

type After = 'open' | 'tomorrow' | 'secondaries';
const WAIT = 'text-ink-muted';

/** "Tomorrow is ready" with tomorrow's plan (spec C, §12). */
function Ready({ tomorrow }: { tomorrow: DayView }) {
  return (
    <div className="space-y-3">
      <TomorrowCard date={tomorrow.date} mustShip={tomorrow.mustShip} />
      {tomorrow.secondaries.length > 0 && (
        <ul aria-label="Tomorrow's secondaries" className="list-disc pl-5">
          {tomorrow.secondaries.map(({ task }) => <li key={task.id}>{task.title}</li>)}
        </ul>
      )}
      <Link to="/" className="underline">Back to Today</Link>
    </div>
  );
}

type StepsProps = { today: DayView; tomorrow: DayView; weekStartDay: number; after: After; onAfter: (step: After) => void; closing: boolean; onClose: () => void };

/** Steps 2 to 4. Step 1 is behind them once today's Must Ship is graded, or when there is none. */
function LaterSteps({ today, tomorrow, weekStartDay, after, onAfter, closing, onClose }: StepsProps) {
  return (
    <>
      {today.mustShip && <p className={WAIT}>Today: {today.mustShip.title} · {MUST_SHIP_STATUS_LABELS[today.mustShip.status]}</p>}
      {after === 'open' && <OpenItems today={today.date} next={tomorrow.date} weekStartDay={weekStartDay} view={today} onNext={() => onAfter('tomorrow')} />}
      {after === 'tomorrow' && <TomorrowMustShip view={tomorrow} onNext={() => onAfter('secondaries')} />}
      {after === 'secondaries' && <TomorrowSecondaries view={tomorrow} pending={closing} onFinish={onClose} />}
    </>
  );
}

/** Shutdown (spec C, §12): four steps, each saved as it is taken, then "Tomorrow is ready". A reload resumes from the data. */
export default function Shutdown() {
  const { today, weekStartDay, ready, settings } = useToday();
  const next = settings ? nextWorkDay(today, settings.workDays) : today;
  const day = useDay(today, { enabled: ready });
  const tomorrow = useDay(next, { enabled: ready });
  const shutdown = useShutdown();
  const report = useReportError();
  const [after, setAfter] = useState<After>('open');
  const loaded = day.data && tomorrow.data ? { today: day.data, tomorrow: tomorrow.data } : null;
  const todays = loaded ? loaded.today.mustShip : null;
  const toGrade = todays?.status === 'planned' ? todays : null;
  const close = () => shutdown.mutate(today, { onError: report('close the day') });
  return (
    <ScreenShell title="Shutdown">
      <p className={WAIT}>{dayLabel(today)}</p>
      {day.isError && <LoadError what="today" error={day.error} onRetry={() => void day.refetch()} />}
      {tomorrow.isError && <LoadError what="tomorrow" error={tomorrow.error} onRetry={() => void tomorrow.refetch()} />}
      {!loaded && !day.isError && !tomorrow.isError && <p className={WAIT}>Loading…</p>}
      {loaded && loaded.today.day?.shutdownAt && <Ready tomorrow={loaded.tomorrow} />}
      {loaded && !loaded.today.day?.shutdownAt && toGrade && <GradeToday next={next} mustShip={toGrade} />}
      {loaded && !loaded.today.day?.shutdownAt && !toGrade && (
        <LaterSteps today={loaded.today} tomorrow={loaded.tomorrow} weekStartDay={weekStartDay} after={after} onAfter={setAfter} closing={shutdown.isPending} onClose={close} />
      )}
    </ScreenShell>
  );
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/screens/Shutdown.test.tsx src/app/App.test.tsx && npm run lint`
Expected: PASS (5 new tests; the shell test still finds the "Shutdown" heading full screen), lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/shutdown/TomorrowSteps.tsx src/screens/Shutdown.tsx src/screens/Shutdown.test.tsx
git commit -m "feat: run the shutdown's four steps and end on Tomorrow is ready"
```

---
### Task 10: The Review screen, its scoreboard and earlier weeks

**Files:**
- Create: `src/components/review/ScoreboardCard.tsx`, `src/components/review/WeekHistory.tsx`
- Modify: `src/screens/Review.tsx` (replace the Phase 1 shell)
- Test: `src/screens/Review.test.tsx`

**Interfaces:**
- Consumes: `useScoreboard`, `useWeekHistory` (Task 6); `useWeekLookup` (`src/api/weeks.ts`); `deepWorkLabel`, `scoreLine` (Task 2); `weekNumber`, `weekRangeLabel` (`week.ts`); `MUST_SHIP_STATUS_LABELS`; `LoadError`, `ScreenShell`; `useToday`.
- Produces:
  - `ScoreboardCard({ board })`: region "Scoreboard" with a definition list (terms "Outcomes shipped", "Must Ships shipped", "Deep work", "Rolled forward", "Killed", "Delegated") and the list "Day strip" (items "Mon · Shipped", "Wed · None", …)
  - `WeekHistory({ before, enabled, selected, onSelect })`: region "Earlier weeks"; one toggle button per week, its name starting "Week N · <range>" and its text ending "<scoreLine> · N rolled · N killed · N delegated"
  - `/review`: the selected week's heading "Week N · <range>" and scoreboard (default the current week; "Back to this week" when another is chosen), "This week has no plan yet." with a "Plan this week" link, then the earlier weeks. Task 11 adds the Friday review between them.

- [ ] **Step 1: Write the failing test**

Create `src/screens/Review.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';
import { stubFetch, json, failure } from '../test/fetch';
import { SETTINGS, makeLookup, makeOutcome, makeScoreboard, makeWeekView } from '../test/fixtures';

const OLDER = '20000000-0000-4000-8000-000000000002';
const current = makeWeekView([makeOutcome({ title: 'Supplier plan confirmed' })], { startDate: '2026-09-27' });
const thisWeek = makeScoreboard({
  startDate: '2026-09-27',
  outcomes: { shipped: 1, total: 3 },
  mustShips: { shipped: 3, total: 5 },
  deepWorkMinutes: 200,
  rolledForward: 1,
  killed: 2,
  delegated: 1,
  strip: [
    { date: '2026-09-28', status: 'shipped' },
    { date: '2026-09-29', status: 'partial' },
    { date: '2026-09-30', status: null },
    { date: '2026-10-01', status: 'shipped' },
    { date: '2026-10-02', status: 'shipped' },
  ],
});
const lastWeek = makeScoreboard({ weekId: OLDER, startDate: '2026-09-20', outcomes: { shipped: 2, total: 3 }, mustShips: { shipped: 4, total: 5 }, deepWorkMinutes: 450 });

type Answers = { lookup?: () => Response; board?: () => Response; history?: () => Response };

function api(answers: Answers = {}) {
  return stubFetch((url) => {
    if (url.endsWith('/settings')) return json(SETTINGS);
    if (url.startsWith('/api/exec/weeks?')) return answers.lookup?.() ?? json(makeLookup({ current }));
    if (url.startsWith('/api/exec/weeks/history')) return answers.history?.() ?? json([lastWeek]);
    const board = url.match(/\/weeks\/([^/]+)\/scoreboard$/)?.[1];
    if (board) return answers.board?.() ?? json(board === OLDER ? lastWeek : thisWeek);
    if (/\/weeks\/[^/?]+$/.test(url)) return json(current); // the Friday review (Task 11) reads the week by id
    return json([]);
  });
}

const valueOf = (term: string) => screen.getByText(term).nextElementSibling?.textContent;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, now: new Date('2026-10-02T11:00:00Z') });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('/review', () => {
  it("shows this week's scoreboard and strip, and the earlier weeks", async () => {
    api();
    renderRoute('/review');
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 40 · 27 Sep – 3 Oct' })).toBeInTheDocument();
    expect(valueOf('Outcomes shipped')).toBe('1 of 3');
    expect(valueOf('Must Ships shipped')).toBe('3 of 5');
    expect(valueOf('Deep work')).toBe('3 h 20 min');
    expect(valueOf('Rolled forward')).toBe('1');
    expect(valueOf('Killed')).toBe('2');
    expect(valueOf('Delegated')).toBe('1');
    expect(within(screen.getByRole('list', { name: 'Day strip' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Mon · Shipped',
      'Tue · Partial',
      'Wed · None',
      'Thu · Shipped',
      'Fri · Shipped',
    ]);
    const earlier = await screen.findByRole('region', { name: 'Earlier weeks' });
    expect(await within(earlier).findByRole('button', { name: /^Week 39 · 20–26 Sep/ })).toHaveTextContent(
      '2 of 3 outcomes · 4 of 5 Must Ships · 7 h 30 min deep work · 0 rolled · 0 killed · 0 delegated'
    );
  });

  it('shows an earlier week when chosen, and comes back', async () => {
    api();
    renderRoute('/review');
    await userEvent.click(await screen.findByRole('button', { name: /^Week 39/ }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 39 · 20–26 Sep' })).toBeInTheDocument();
    expect(valueOf('Outcomes shipped')).toBe('2 of 3');
    await userEvent.click(screen.getByRole('button', { name: 'Back to this week' }));
    expect(await screen.findByRole('heading', { level: 2, name: 'Week 40 · 27 Sep – 3 Oct' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to this week' })).toBeNull();
  });

  it('says when this week has no plan and when there are no earlier weeks', async () => {
    api({ lookup: () => json(makeLookup()), history: () => json([]) });
    renderRoute('/review');
    expect(await screen.findByRole('link', { name: 'Plan this week' })).toHaveAttribute('href', '/plan');
    expect(await screen.findByText('No earlier weeks yet.')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Scoreboard' })).toBeNull();
  });

  it('says so when the scoreboard or the history cannot be read', async () => {
    const broken = () => failure(500, 'INTERNAL', 'internal server error');
    api({ board: broken, history: broken });
    renderRoute('/review');
    expect(await screen.findByText('Could not load the scoreboard: internal server error')).toBeInTheDocument();
    expect(await screen.findByText('Could not load earlier weeks: internal server error')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/screens/Review.test.tsx`
Expected: FAIL, the Phase 1 shell only says "Arrives in Phase 6." and every test times out finding its first element.

- [ ] **Step 3: Write the scoreboard card**

Create `src/components/review/ScoreboardCard.tsx`:

```tsx
import { MUST_SHIP_STATUS_LABELS } from '../../lib/labels';
import { deepWorkLabel } from '../../shared/exec/scoreboard';
import type { Scoreboard } from '../../shared/exec/reviewSchemas';

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const shortDay = (date: string): string => SHORT_DAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** Spec C "Review" item 1: the week's numbers, and the strip of its work days' Must Ships. */
export function ScoreboardCard({ board }: { board: Scoreboard }) {
  const numbers: [string, string][] = [
    ['Outcomes shipped', `${board.outcomes.shipped} of ${board.outcomes.total}`],
    ['Must Ships shipped', `${board.mustShips.shipped} of ${board.mustShips.total}`],
    ['Deep work', deepWorkLabel(board.deepWorkMinutes)],
    ['Rolled forward', String(board.rolledForward)],
    ['Killed', String(board.killed)],
    ['Delegated', String(board.delegated)],
  ];
  return (
    <section aria-label="Scoreboard" className="space-y-4 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {numbers.map(([term, value]) => (
          <div key={term}>
            <dt className="text-sm text-ink-muted">{term}</dt>
            <dd className="text-2xl font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <ol aria-label="Day strip" className="flex flex-wrap gap-2">
        {board.strip.map((day) => (
          <li key={day.date} className="rounded border border-line px-2 py-1 text-sm dark:border-ink-muted">
            {shortDay(day.date)} · {day.status ? MUST_SHIP_STATUS_LABELS[day.status] : 'None'}
          </li>
        ))}
      </ol>
    </section>
  );
}
```

- [ ] **Step 4: Write the earlier weeks**

Create `src/components/review/WeekHistory.tsx`:

```tsx
import { useWeekHistory } from '../../api/review';
import { scoreLine } from '../../shared/exec/scoreboard';
import { weekNumber, weekRangeLabel } from '../../shared/exec/week';
import { LoadError } from '../LoadError';

type Props = { before: string; enabled: boolean; selected: string | null; onSelect: (weekId: string) => void };

const ROW = 'w-full rounded-lg border border-line px-4 py-3 text-left hover:border-ink aria-pressed:border-ink dark:border-ink-muted';

/** Spec C "Review" item 2: earlier weeks as rows; choosing one shows its scoreboard. */
export function WeekHistory({ before, enabled, selected, onSelect }: Props) {
  const history = useWeekHistory(before, { enabled });
  return (
    <section aria-label="Earlier weeks" className="space-y-2">
      <h2 className="text-xl font-medium">Earlier weeks</h2>
      {history.isError && <LoadError what="earlier weeks" error={history.error} onRetry={() => void history.refetch()} />}
      {history.isPending && <p className="text-ink-muted">Loading earlier weeks…</p>}
      {history.isSuccess && history.data.length === 0 && <p className="text-ink-muted">No earlier weeks yet.</p>}
      {history.isSuccess && history.data.length > 0 && (
        <ul className="space-y-2">
          {history.data.map((board) => (
            <li key={board.weekId}>
              <button type="button" aria-pressed={selected === board.weekId} onClick={() => onSelect(board.weekId)} className={ROW}>
                <span className="block font-medium">Week {weekNumber(board.startDate)} · {weekRangeLabel(board.startDate)}</span>
                <span className="block text-sm text-ink-muted">
                  {scoreLine(board)} · {board.rolledForward} rolled · {board.killed} killed · {board.delegated} delegated
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

- [ ] **Step 5: Write the screen**

Replace `src/screens/Review.tsx` with:

```tsx
import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { UseQueryResult } from '@tanstack/react-query';
import { ScreenShell } from '../components/ScreenShell';
import { LoadError } from '../components/LoadError';
import { ScoreboardCard } from '../components/review/ScoreboardCard';
import { WeekHistory } from '../components/review/WeekHistory';
import { useWeekLookup } from '../api/weeks';
import { useScoreboard } from '../api/review';
import type { ApiError } from '../api/client';
import { useToday } from '../lib/useToday';
import { weekNumber, weekRangeLabel } from '../shared/exec/week';
import type { Scoreboard } from '../shared/exec/reviewSchemas';

const WAIT = 'text-ink-muted';

type SelectedProps = { board: UseQueryResult<Scoreboard, ApiError>; current: boolean; onBack: () => void };

/** The selected week's heading and numbers, with a way back when it is not the current week. */
function SelectedWeek({ board, current, onBack }: SelectedProps) {
  if (board.isError) return <LoadError what="the scoreboard" error={board.error} onRetry={() => void board.refetch()} />;
  if (!board.isSuccess) return <p className={WAIT}>Loading the scoreboard…</p>;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-medium">Week {weekNumber(board.data.startDate)} · {weekRangeLabel(board.data.startDate)}</h2>
        {!current && <button type="button" onClick={onBack} className="text-sm underline">Back to this week</button>}
      </div>
      <ScoreboardCard board={board.data} />
    </div>
  );
}

/** Review (spec C): what shipped, what slipped, and why. The selected week defaults to the current one. */
export default function Review() {
  const { today, ready } = useToday();
  const lookup = useWeekLookup(today, { enabled: ready });
  const [picked, setPicked] = useState<string | null>(null);
  const currentId = lookup.data?.current?.week.id ?? null;
  const weekId = picked ?? currentId;
  const board = useScoreboard(weekId);
  return (
    <ScreenShell title="Review">
      {lookup.isError && <LoadError what="the week" error={lookup.error} onRetry={() => void lookup.refetch()} />}
      {!lookup.isSuccess && !lookup.isError && <p className={WAIT}>Loading the week…</p>}
      {lookup.isSuccess && weekId === null && (
        <p>
          This week has no plan yet. <Link to="/plan" className="underline">Plan this week</Link>
        </p>
      )}
      {weekId !== null && <SelectedWeek board={board} current={weekId === currentId} onBack={() => setPicked(null)} />}
      <WeekHistory before={today} enabled={ready} selected={picked} onSelect={setPicked} />
    </ScreenShell>
  );
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/screens/Review.test.tsx src/app/App.test.tsx && npm run lint`
Expected: PASS (4 new tests; the shell test still finds the "Review" heading inside the shell), lint clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/review/ScoreboardCard.tsx src/components/review/WeekHistory.tsx src/screens/Review.tsx src/screens/Review.test.tsx
git commit -m "feat: show the week's scoreboard, the day strip and earlier weeks on Review"
```

---

### Task 11: The Friday review

**Files:**
- Create: `src/shared/exec/review.ts`, `src/components/review/OutcomeReviewForm.tsx`, `src/components/review/FridayReview.tsx`
- Modify: `src/lib/labels.ts`, `src/screens/Review.tsx`
- Test: `src/shared/exec/review.test.ts`, `src/components/review/FridayReview.test.tsx`, `src/screens/Review.test.tsx` (one test added)

**Interfaces:**
- Consumes: `useWeekView`, `useReviewOutcome`, `useFinishReview` (Task 6); `type OutcomeReview` (Task 1); `REVIEW_GRADES`, `REVIEW_DISPOSITIONS` (`schemas.ts`); `ReasonSelect` (`src/components/outcomes/ReasonSelect.tsx`, label and value props); `CATEGORY_LABELS`; `addDays`; `LoadError`.
- Produces:
  - In `src/shared/exec/review.ts`: `reviewedOutcomes(outcomes: Outcome[]): Outcome[]` (slotted, or graded with no slot), `reviewQueue(outcomes: Outcome[]): Outcome[]` (slotted and ungraded, in slot order), `carryCandidates(previous: WeekView | null, current: Outcome[]): Outcome[]` (used by Task 12)
  - In `src/lib/labels.ts`: `GRADE_LABELS` (`Done`, `Partial`, `Missed`) and `DISPOSITION_LABELS` (`Roll into next week`, `Reschedule`, `Delegate`, `Kill`)
  - `OutcomeReviewForm({ outcome, weekStartDate, today, position })`: form named `Review "<title>"`, radios for the grade (only Done enabled, and checked, for an outcome already `done`); for Partial and Missed the select "Why did it slip?" (default Not enough time), the disposition radios, "Move to" (a date, at least the next week's first day, default the Monday after it) for a reschedule, "Owner" and "Follow up on" (default three days after today) for a delegation; "Save grade" is disabled until the grade is complete
  - `FridayReview({ weekId, today })`: region "Friday review": the form for the first ungraded outcome ("Outcome k of n · <category>"); then "Every outcome is graded." (or "No outcomes to grade this week."), the list "Graded outcomes", "Notes (optional)" and "Review done"; once stamped, "Reviewed.", the notes and the list
  - `/review` renders `FridayReview` for the selected week, below its scoreboard

- [ ] **Step 1: Write the failing tests**

Create `src/shared/exec/review.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { carryCandidates, reviewedOutcomes, reviewQueue } from './review';
import { makeOutcome, makeWeekView } from '../../test/fixtures';

const PREVIOUS = '20000000-0000-4000-8000-000000000002';

describe('reviewQueue and reviewedOutcomes', () => {
  it('grades the slotted outcomes in slot order, and covers the ones killed at the review', () => {
    const third = makeOutcome({ title: 'Third', slot: 3 });
    const first = makeOutcome({ title: 'First', slot: 1, reviewGrade: 'done', status: 'done' });
    const second = makeOutcome({ title: 'Second', slot: 2 });
    const killedAtReview = makeOutcome({ title: 'Killed at review', slot: null, status: 'killed', reviewGrade: 'missed' });
    const replaced = makeOutcome({ title: 'Replaced', slot: null, status: 'killed' });
    const all = [third, first, second, killedAtReview, replaced];
    expect(reviewQueue(all).map((outcome) => outcome.title)).toEqual(['Second', 'Third']);
    expect(reviewedOutcomes(all).map((outcome) => outcome.title)).toEqual(['Third', 'First', 'Second', 'Killed at review']);
  });
});

describe('carryCandidates', () => {
  it('offers every open outcome of a week not yet reviewed, less the ones already carried', () => {
    const open = makeOutcome({ title: 'Open', weekId: PREVIOUS });
    const carried = makeOutcome({ title: 'Carried', weekId: PREVIOUS, slot: 2 });
    const done = makeOutcome({ title: 'Done', weekId: PREVIOUS, slot: 3, status: 'done' });
    const previous = makeWeekView([open, carried, done], { id: PREVIOUS });
    const mine = [makeOutcome({ title: 'Carried', rolledFromId: carried.id })];
    expect(carryCandidates(previous, mine).map((outcome) => outcome.title)).toEqual(['Open']);
  });

  it('offers only what a Friday review rolled forward, and nothing without a last week', () => {
    const rolled = makeOutcome({ title: 'Rolled', weekId: PREVIOUS, reviewGrade: 'partial', reviewDisposition: 'roll_forward' });
    const rescheduled = makeOutcome({ title: 'Rescheduled', weekId: PREVIOUS, slot: 2, reviewGrade: 'missed', reviewDisposition: 'reschedule' });
    const killed = makeOutcome({ title: 'Killed', weekId: PREVIOUS, slot: null, status: 'killed', reviewGrade: 'missed', reviewDisposition: 'kill' });
    const previous = makeWeekView([rolled, rescheduled, killed], { id: PREVIOUS, reviewedAt: '2026-09-25T11:00:00.000Z' });
    expect(carryCandidates(previous, []).map((outcome) => outcome.title)).toEqual(['Rolled']);
    expect(carryCandidates(null, [])).toEqual([]);
  });
});
```

Create `src/components/review/FridayReview.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FridayReview } from './FridayReview';
import { renderWithProviders } from '../../test/render';
import { stubFetch, json, failure, type FetchCall } from '../../test/fetch';
import { WEEK_ID, makeOutcome, makeWeekView } from '../../test/fixtures';
import type { Outcome, WeekView } from '../../shared/exec/schemas';

afterEach(() => vi.unstubAllGlobals());

const TODAY = '2026-10-02';
const supplier = makeOutcome({ title: 'Supplier plan confirmed', slot: 1 });
const haleon = makeOutcome({ title: 'Haleon target signed', slot: 2 });
const pinkbox = makeOutcome({ title: 'Pinkbox P&L live', slot: 3, category: 'business' });
const weekOf = (outcomes: Outcome[]) => makeWeekView(outcomes, { startDate: '2026-09-27' });

/** A stateful fake: a grade updates its outcome, and the stamp updates the week. */
function fakeReviewApi(start: WeekView) {
  let view = start;
  return stubFetch((url, init) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (method === 'GET') return json(view);
    const graded = url.match(/\/outcomes\/([^/]+)\/review$/)?.[1];
    if (graded) {
      view = { ...view, outcomes: view.outcomes.map((o) => (o.id === graded ? { ...o, reviewGrade: body.grade, reviewDisposition: body.disposition ?? null } : o)) };
      return json(view.outcomes.find((o) => o.id === graded));
    }
    view = { ...view, week: { ...view.week, reviewedAt: '2026-10-02T12:00:00.000Z', reviewNotes: body.notes } };
    return json(view.week);
  });
}

const render = () => renderWithProviders(<FridayReview weekId={WEEK_ID} today={TODAY} />);
const writes = (calls: FetchCall[]) => calls.filter((c) => c.method !== 'GET').map((c) => ({ url: c.url, body: c.body }));

describe('FridayReview', () => {
  it('grades each outcome in turn, then stamps the review with its note', async () => {
    const calls = fakeReviewApi(weekOf([supplier, haleon, pinkbox]));
    render();
    let form = await screen.findByRole('form', { name: 'Review "Supplier plan confirmed"' });
    expect(within(form).getByText('Outcome 1 of 3 · Office')).toBeInTheDocument();
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeDisabled();
    await userEvent.click(within(form).getByRole('radio', { name: 'Done' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Save grade' }));

    form = await screen.findByRole('form', { name: 'Review "Haleon target signed"' });
    expect(within(form).getByText('Outcome 2 of 3 · Office')).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('radio', { name: 'Partial' }));
    await userEvent.selectOptions(within(form).getByLabelText('Why did it slip?'), 'Priority changed');
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeDisabled();
    await userEvent.click(within(form).getByRole('radio', { name: 'Roll into next week' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Save grade' }));

    form = await screen.findByRole('form', { name: 'Review "Pinkbox P&L live"' });
    expect(within(form).getByText('Outcome 3 of 3 · Business')).toBeInTheDocument();
    await userEvent.click(within(form).getByRole('radio', { name: 'Missed' }));
    await userEvent.click(within(form).getByRole('radio', { name: 'Delegate' }));
    await userEvent.type(within(form).getByLabelText('Owner'), 'Sana');
    await userEvent.click(within(form).getByRole('button', { name: 'Save grade' }));

    expect(await screen.findByText('Every outcome is graded.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Notes (optional)'), 'Too many meetings');
    await userEvent.click(screen.getByRole('button', { name: 'Review done' }));
    expect(await screen.findByText('Reviewed.')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Graded outcomes' })).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Supplier plan confirmed: Done',
      'Haleon target signed: Partial · Roll into next week',
      'Pinkbox P&L live: Missed · Delegate',
    ]);
    expect(writes(calls)).toEqual([
      { url: `/api/exec/outcomes/${supplier.id}/review`, body: { grade: 'done' } },
      { url: `/api/exec/outcomes/${haleon.id}/review`, body: { grade: 'partial', reason: 'priority_changed', disposition: 'roll_forward' } },
      {
        url: `/api/exec/outcomes/${pinkbox.id}/review`,
        body: { grade: 'missed', reason: 'insufficient_time', disposition: 'delegate', owner: 'Sana', followUpDate: '2026-10-05' },
      },
      { url: `/api/exec/weeks/${WEEK_ID}/review`, body: { notes: 'Too many meetings' } },
    ]);
  });

  it('resumes at the first ungraded outcome, and offers only Done for a finished one', async () => {
    fakeReviewApi(weekOf([{ ...supplier, reviewGrade: 'done', status: 'done' }, { ...haleon, status: 'done' }, pinkbox]));
    render();
    const form = await screen.findByRole('form', { name: 'Review "Haleon target signed"' });
    expect(within(form).getByText('Outcome 2 of 3 · Office')).toBeInTheDocument();
    expect(within(form).getByRole('radio', { name: 'Done' })).toBeChecked();
    expect(within(form).getByRole('radio', { name: 'Partial' })).toBeDisabled();
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeEnabled();
  });

  it('holds a reschedule until its date lands in a later week', async () => {
    fakeReviewApi(weekOf([supplier]));
    render();
    const form = await screen.findByRole('form', { name: 'Review "Supplier plan confirmed"' });
    await userEvent.click(within(form).getByRole('radio', { name: 'Missed' }));
    await userEvent.click(within(form).getByRole('radio', { name: 'Reschedule' }));
    const date = within(form).getByLabelText('Move to');
    expect(date).toHaveValue('2026-10-05');
    expect(date).toHaveAttribute('min', '2026-10-04');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-02');
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeDisabled();
    await userEvent.clear(date);
    await userEvent.type(date, '2026-10-14');
    expect(within(form).getByRole('button', { name: 'Save grade' })).toBeEnabled();
  });

  it('says so when a grade is refused', async () => {
    stubFetch((_url, init) => (init?.method === 'POST' ? failure(400, 'VALIDATION', 'that outcome is already reviewed') : json(weekOf([supplier]))));
    render();
    const form = await screen.findByRole('form', { name: 'Review "Supplier plan confirmed"' });
    await userEvent.click(within(form).getByRole('radio', { name: 'Done' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Save grade' }));
    expect(await screen.findByText('Could not save the grade: that outcome is already reviewed')).toBeInTheDocument();
  });

  it('says so when the week cannot be read, and finishes a week with nothing to grade', async () => {
    stubFetch(() => failure(500, 'INTERNAL', 'internal server error'));
    const { unmount } = render();
    expect(await screen.findByRole('alert')).toHaveTextContent("Could not load the week's outcomes: internal server error");
    unmount();
    fakeReviewApi(weekOf([]));
    render();
    expect(await screen.findByText('No outcomes to grade this week.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review done' })).toBeEnabled();
  });
});
```

Add this test inside the `describe('/review', …)` block of `src/screens/Review.test.tsx`:

```tsx
  it('runs the Friday review for the selected week', async () => {
    api();
    renderRoute('/review');
    const review = await screen.findByRole('region', { name: 'Friday review' });
    expect(await within(review).findByRole('form', { name: 'Review "Supplier plan confirmed"' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/shared/exec/review.test.ts src/components/review src/screens/Review.test.tsx`
Expected: FAIL. The new suites cannot resolve `./review` and `./FridayReview`; the new Review test cannot find the "Friday review" region.

- [ ] **Step 3: Write the pure review helpers**

Create `src/shared/exec/review.ts`:

```ts
import type { Outcome, WeekView } from './schemas';

const bySlot = (a: Outcome, b: Outcome): number => (a.slot ?? 4) - (b.slot ?? 4);

/** The outcomes the Friday review covers: those holding a slot, and those graded before Kill freed theirs. */
export const reviewedOutcomes = (outcomes: Outcome[]): Outcome[] => outcomes.filter((outcome) => outcome.slot !== null || outcome.reviewGrade !== null);

/** The outcomes still to grade, in slot order: after a reload the review resumes at the first of them. */
export const reviewQueue = (outcomes: Outcome[]): Outcome[] =>
  outcomes.filter((outcome) => outcome.slot !== null && outcome.reviewGrade === null).sort(bySlot);

/**
 * Sunday planning step 1 (spec C): after a Friday review, the outcomes it rolled forward; before one, every outcome still
 * open. Either way, not one already carried into this week.
 */
export function carryCandidates(previous: WeekView | null, current: Outcome[]): Outcome[] {
  if (previous === null) return [];
  const carried = (outcome: Outcome) => current.some((mine) => mine.slot !== null && mine.rolledFromId === outcome.id);
  const offered =
    previous.week.reviewedAt === null
      ? previous.outcomes.filter((outcome) => outcome.status === 'active' && outcome.slot !== null)
      : previous.outcomes.filter((outcome) => outcome.status === 'active' && outcome.reviewDisposition === 'roll_forward');
  return offered.filter((outcome) => !carried(outcome));
}
```

- [ ] **Step 4: Add the labels**

In `src/lib/labels.ts`, change the schemas import to:

```ts
import type { Outcome, OutcomeCategory, ProjectStatus, ReviewReason } from '../shared/exec/schemas';
```

and append:

```ts
export const GRADE_LABELS: Record<NonNullable<Outcome['reviewGrade']>, string> = {
  done: 'Done',
  partial: 'Partial',
  missed: 'Missed',
};

export const DISPOSITION_LABELS: Record<NonNullable<Outcome['reviewDisposition']>, string> = {
  roll_forward: 'Roll into next week',
  reschedule: 'Reschedule',
  delegate: 'Delegate',
  kill: 'Kill',
};
```

- [ ] **Step 5: Write the grade form**

Create `src/components/review/OutcomeReviewForm.tsx`:

```tsx
import { useId, useState, type FormEvent } from 'react';
import { useReviewOutcome } from '../../api/review';
import { useReportError } from '../../api/errors';
import { CATEGORY_LABELS, DISPOSITION_LABELS, GRADE_LABELS } from '../../lib/labels';
import { addDays } from '../../shared/exec/dates';
import { REVIEW_DISPOSITIONS, REVIEW_GRADES } from '../../shared/exec/schemas';
import type { Outcome, ReviewReason } from '../../shared/exec/schemas';
import type { OutcomeReview } from '../../shared/exec/reviewSchemas';
import { ReasonSelect } from '../outcomes/ReasonSelect';

type Grade = OutcomeReview['grade'];
type Disposition = NonNullable<OutcomeReview['disposition']>;
type Slip = { reason: ReviewReason; disposition: Disposition | null; date: string; owner: string; followUpDate: string };
type Props = { outcome: Outcome; weekStartDate: string; today: string; position: string };

const FIELD = 'rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink';
const CHOICE = 'mr-4 inline-flex items-center gap-1';
const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

/** The body this form would send, or null while it is incomplete. A reschedule must land in a later week. */
function toReview(grade: Grade | null, slip: Slip, nextWeek: string): OutcomeReview | null {
  if (grade === null) return null;
  if (grade === 'done') return { grade };
  const { reason, disposition } = slip;
  if (disposition === 'reschedule') return slip.date >= nextWeek ? { grade, reason, disposition, date: slip.date } : null;
  if (disposition === 'delegate') {
    const owner = slip.owner.trim();
    return owner && slip.followUpDate ? { grade, reason, disposition, owner, followUpDate: slip.followUpDate } : null;
  }
  return disposition === null ? null : { grade, reason, disposition };
}

/** Why it slipped, and what happens to it (spec C "Friday review": Roll / Reschedule / Delegate / Kill). */
function SlipFields({ id, slip, nextWeek, onChange }: { id: string; slip: Slip; nextWeek: string; onChange: (slip: Slip) => void }) {
  const set = (fields: Partial<Slip>) => onChange({ ...slip, ...fields });
  return (
    <div className="space-y-3">
      <ReasonSelect label="Why did it slip?" value={slip.reason} onChange={(reason) => set({ reason })} />
      <fieldset className="space-y-1">
        <legend className="text-sm">What happens to it?</legend>
        {REVIEW_DISPOSITIONS.map((value) => (
          <label key={value} className={CHOICE}>
            <input type="radio" name={`${id}-disposition`} checked={slip.disposition === value} onChange={() => set({ disposition: value })} />
            {DISPOSITION_LABELS[value]}
          </label>
        ))}
      </fieldset>
      {slip.disposition === 'reschedule' && (
        <div className="space-y-1">
          <label htmlFor={`${id}-date`} className="block text-sm">Move to</label>
          <input id={`${id}-date`} type="date" min={nextWeek} value={slip.date} onChange={(event) => set({ date: event.target.value })} className={FIELD} />
        </div>
      )}
      {slip.disposition === 'delegate' && (
        <div className="space-y-1">
          <label htmlFor={`${id}-owner`} className="block text-sm">Owner</label>
          <input id={`${id}-owner`} value={slip.owner} maxLength={120} onChange={(event) => set({ owner: event.target.value })} className={FIELD} />
          <label htmlFor={`${id}-follow-up`} className="block text-sm">Follow up on</label>
          <input id={`${id}-follow-up`} type="date" value={slip.followUpDate} onChange={(event) => set({ followUpDate: event.target.value })} className={FIELD} />
        </div>
      )}
    </div>
  );
}

/** One outcome's Friday grade (spec C "Friday review" step 1): Done, or Partial or Missed with a reason and what happens next. */
export function OutcomeReviewForm({ outcome, weekStartDate, today, position }: Props) {
  const id = useId();
  const review = useReviewOutcome();
  const report = useReportError();
  const nextWeek = addDays(weekStartDate, 7);
  const finished = outcome.status === 'done';
  const [grade, setGrade] = useState<Grade | null>(finished ? 'done' : null);
  const [slip, setSlip] = useState<Slip>({ reason: 'insufficient_time', disposition: null, date: addDays(nextWeek, 1), owner: '', followUpDate: addDays(today, 3) });
  const input = toReview(grade, slip, nextWeek);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (input && !review.isPending) review.mutate({ id: outcome.id, input }, { onError: report('save the grade') });
  };
  return (
    <form aria-label={`Review "${outcome.title}"`} onSubmit={submit} className="space-y-3 rounded-lg border border-line p-5 dark:border-ink-muted">
      <p className="text-sm text-ink-muted">{position} · {CATEGORY_LABELS[outcome.category]}</p>
      <h3 className="text-xl font-semibold">{outcome.title}</h3>
      {outcome.definitionOfDone && <p className="text-ink-muted">Done means: {outcome.definitionOfDone}</p>}
      <fieldset className="space-y-1">
        <legend className="text-sm">Grade</legend>
        {REVIEW_GRADES.map((value) => (
          <label key={value} className={CHOICE}>
            <input type="radio" name={`${id}-grade`} checked={grade === value} disabled={finished && value !== 'done'} onChange={() => setGrade(value)} />
            {GRADE_LABELS[value]}
          </label>
        ))}
      </fieldset>
      {grade !== null && grade !== 'done' && <SlipFields id={id} slip={slip} nextWeek={nextWeek} onChange={setSlip} />}
      <button type="submit" disabled={input === null || review.isPending} className={PRIMARY}>Save grade</button>
    </form>
  );
}
```

- [ ] **Step 6: Write the review**

Create `src/components/review/FridayReview.tsx`:

```tsx
import { useState } from 'react';
import { useFinishReview, useWeekView } from '../../api/review';
import { useReportError } from '../../api/errors';
import { DISPOSITION_LABELS, GRADE_LABELS } from '../../lib/labels';
import { reviewedOutcomes, reviewQueue } from '../../shared/exec/review';
import type { Outcome } from '../../shared/exec/schemas';
import { LoadError } from '../LoadError';
import { OutcomeReviewForm } from './OutcomeReviewForm';

type Props = { weekId: string; today: string };

const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

const verdict = (outcome: Outcome): string => {
  const grade = outcome.reviewGrade ? GRADE_LABELS[outcome.reviewGrade] : 'Not graded';
  return outcome.reviewDisposition ? `${grade} · ${DISPOSITION_LABELS[outcome.reviewDisposition]}` : grade;
};

function Graded({ outcomes }: { outcomes: Outcome[] }) {
  return (
    <ul aria-label="Graded outcomes" className="space-y-1">
      {outcomes.map((outcome) => (
        <li key={outcome.id}>{outcome.title}: {verdict(outcome)}</li>
      ))}
    </ul>
  );
}

/** Step 2 (spec C): with every outcome graded, the review is stamped done, with an optional note. */
function Finish({ weekId, outcomes }: { weekId: string; outcomes: Outcome[] }) {
  const finish = useFinishReview();
  const report = useReportError();
  const [notes, setNotes] = useState('');
  const done = () => finish.mutate({ weekId, notes: notes.trim() }, { onError: report('finish the review') });
  return (
    <div className="space-y-2">
      <p>{outcomes.length === 0 ? 'No outcomes to grade this week.' : 'Every outcome is graded.'}</p>
      {outcomes.length > 0 && <Graded outcomes={outcomes} />}
      <label htmlFor="review-notes" className="block text-sm">Notes (optional)</label>
      <textarea id="review-notes" rows={2} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink" />
      <button type="button" disabled={finish.isPending} onClick={done} className={PRIMARY}>Review done</button>
    </div>
  );
}

/** The Friday review (spec C): each outcome in turn, then the stamp. A reload resumes at the first ungraded outcome. */
export function FridayReview({ weekId, today }: Props) {
  const view = useWeekView(weekId);
  if (view.isError) return <LoadError what="the week's outcomes" error={view.error} onRetry={() => void view.refetch()} />;
  if (!view.isSuccess) return <p className="text-ink-muted">Loading the review…</p>;
  const { week, outcomes } = view.data;
  const covered = reviewedOutcomes(outcomes);
  const queue = reviewQueue(outcomes);
  const next = queue.length > 0 ? queue[0] : null;
  return (
    <section aria-label="Friday review" className="space-y-3">
      <h2 className="text-xl font-medium">Friday review</h2>
      {week.reviewedAt !== null ? (
        <>
          <p>Reviewed.</p>
          {week.reviewNotes && <p className="text-ink-muted">{week.reviewNotes}</p>}
          <Graded outcomes={covered} />
        </>
      ) : next ? (
        <OutcomeReviewForm key={next.id} outcome={next} weekStartDate={week.startDate} today={today} position={`Outcome ${covered.length - queue.length + 1} of ${covered.length}`} />
      ) : (
        <Finish weekId={weekId} outcomes={covered} />
      )}
    </section>
  );
}
```

- [ ] **Step 7: Put the review on the screen**

In `src/screens/Review.tsx`, add the import:

```tsx
import { FridayReview } from '../components/review/FridayReview';
```

and add this line directly after the `SelectedWeek` line:

```tsx
      {weekId !== null && <FridayReview weekId={weekId} today={today} />}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run src/shared/exec/review.test.ts src/components/review src/screens/Review.test.tsx && npm run lint`
Expected: PASS (3 + 5 + 1 new tests; Task 10's four Review tests still pass), lint clean.

- [ ] **Step 9: Commit**

```bash
git add src/shared/exec/review.ts src/shared/exec/review.test.ts src/lib/labels.ts src/components/review/OutcomeReviewForm.tsx src/components/review/FridayReview.tsx src/components/review/FridayReview.test.tsx src/screens/Review.tsx src/screens/Review.test.tsx
git commit -m "feat: run the Friday review, grading each outcome and stamping the week"
```

---
### Task 12: Sunday planning offers what the review rolled forward

**Files:**
- Modify: `src/components/plan/CarryOver.tsx`, `src/screens/Plan.tsx`
- Test: `src/screens/Plan.test.tsx` (the fake answers the scoreboard; two tests added)

**Interfaces:**
- Consumes: `carryCandidates` (Task 11); `useScoreboard` (Task 6); `scoreLine` (Task 2); `LoadError`.
- Produces:
  - `CarryOver({ outcomes, today, weekId, previousWeekId, reviewed, onNext })`: under the "Last week" heading, the line "Last week: <scoreLine>" (with its own loading and failure states), then "Friday's review rolled these forward. Carry the ones that still matter." after a review, or the Phase 3 sentence "These were still open. Carry the ones that still matter." before one
  - `/plan` builds its carry list with `carryCandidates(previous, current outcomes)`

- [ ] **Step 1: Write the failing tests**

In `src/screens/Plan.test.tsx`:

Change the fixtures import to:

```tsx
import { SETTINGS, WEEK_ID, makeLookup, makeOutcome, makeScoreboard, makeWeekView } from '../test/fixtures';
```

In `fakePlanApi`, add this line directly before `const slot = current().outcomes.filter(...)`:

```tsx
    if (url.endsWith('/scoreboard')) return json(makeScoreboard({ weekId: url.split('/').at(-2) ?? WEEK_ID, outcomes: { shipped: 1, total: 3 } }));
```

Add these two tests at the end of the `describe('/plan', …)` block:

```tsx
  it("shows last week's numbers, and after a Friday review offers only what it rolled forward", async () => {
    const PREVIOUS = '20000000-0000-4000-8000-000000000002';
    const rolled = makeOutcome({ title: 'Delivery tracker sent', weekId: PREVIOUS, reviewGrade: 'partial', reviewDisposition: 'roll_forward' });
    const killed = makeOutcome({ title: 'Price list approved', weekId: PREVIOUS, slot: null, status: 'killed', reviewGrade: 'missed', reviewDisposition: 'kill' });
    const rescheduled = makeOutcome({ title: 'Venue booked', weekId: PREVIOUS, slot: 2, reviewGrade: 'missed', reviewDisposition: 'reschedule' });
    const previous = makeWeekView([rolled, killed, rescheduled], { id: PREVIOUS, startDate: '2026-09-13', reviewedAt: '2026-09-18T11:00:00.000Z' });
    fakePlanApi(makeLookup({ hasHistory: true, previous }));
    renderRoute('/plan');
    expect(await screen.findByRole('heading', { level: 2, name: 'Last week' })).toBeInTheDocument();
    expect(await screen.findByText('Last week: 1 of 3 outcomes · 0 of 0 Must Ships · 0 min deep work')).toBeInTheDocument();
    expect(screen.getByText("Friday's review rolled these forward. Carry the ones that still matter.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Carry "Delivery tracker sent" into this week' })).toBeInTheDocument();
    expect(screen.queryByText(/Price list approved/)).toBeNull();
    expect(screen.queryByText(/Venue booked/)).toBeNull();
  });

  it("says so when last week's numbers cannot be read, and still offers the carry", async () => {
    const PREVIOUS = '20000000-0000-4000-8000-000000000002';
    const open = makeOutcome({ title: 'Delivery tracker sent', weekId: PREVIOUS });
    const lookup = makeLookup({ hasHistory: true, previous: makeWeekView([open], { id: PREVIOUS, startDate: '2026-09-13' }) });
    stubFetch((url) => {
      if (url.endsWith('/settings')) return json(SETTINGS);
      if (url.startsWith('/api/exec/weeks?')) return json(lookup);
      if (url.endsWith('/scoreboard')) return failure(500, 'INTERNAL', 'internal server error');
      return json([]);
    });
    renderRoute('/plan');
    expect(await screen.findByRole('alert')).toHaveTextContent("Could not load last week's numbers: internal server error");
    expect(screen.getByRole('button', { name: 'Carry "Delivery tracker sent" into this week' })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/screens/Plan.test.tsx`
Expected: FAIL. The two new tests fail (no "Last week:" line, and the rescheduled "Venue booked" is still offered); the Phase 3–5 Plan tests still pass.

- [ ] **Step 3: Show last week's numbers in the carry-over**

Replace `src/components/plan/CarryOver.tsx` with:

```tsx
import { useRollOutcome } from '../../api/weeks';
import { useScoreboard } from '../../api/review';
import { useReportError } from '../../api/errors';
import { scoreLine } from '../../shared/exec/scoreboard';
import type { Outcome } from '../../shared/exec/schemas';
import { LoadError } from '../LoadError';

type Props = { outcomes: Outcome[]; today: string; weekId?: string; previousWeekId: string; reviewed: boolean; onNext: () => void };

/** Last week at a glance (spec C "Sunday planning" step 1): its numbers in one line. */
function LastWeekGlance({ weekId }: { weekId: string }) {
  const board = useScoreboard(weekId);
  if (board.isError) return <LoadError what="last week's numbers" error={board.error} onRetry={() => void board.refetch()} />;
  if (!board.isSuccess) return <p className="text-sm text-ink-muted">Loading last week's numbers…</p>;
  return <p className="text-sm text-ink-muted">Last week: {scoreLine(board.data)}</p>;
}

/** Step 1 (§4): last week's numbers, then its outcomes to carry. After a Friday review, only the ones it rolled forward. */
export function CarryOver({ outcomes, today, weekId, previousWeekId, reviewed, onNext }: Props) {
  const roll = useRollOutcome();
  const report = useReportError();
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Last week</h2>
      <LastWeekGlance weekId={previousWeekId} />
      <p className="text-ink-muted">
        {reviewed ? "Friday's review rolled these forward. Carry the ones that still matter." : 'These were still open. Carry the ones that still matter.'}
      </p>
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

- [ ] **Step 4: Build the carry list from the review**

In `src/screens/Plan.tsx`, add the import:

```tsx
import { carryCandidates } from '../shared/exec/review';
```

replace these lines:

```tsx
  const carryable = (lookup.data?.previous?.outcomes ?? []).filter(
    (outcome) => outcome.status === 'active' && outcome.slot !== null && !slotted.some((mine) => mine.rolledFromId === outcome.id)
  );
```

with:

```tsx
  const previous = lookup.data?.previous ?? null;
  const carryable = carryCandidates(previous, current?.outcomes ?? []);
```

and replace the carry step's line:

```tsx
      {lookup.isSuccess && step === 'carry' && <CarryOver outcomes={carryable} today={today} weekId={current?.week.id} onNext={() => setChosenStep('choose')} />}
```

with:

```tsx
      {lookup.isSuccess && step === 'carry' && previous && (
        <CarryOver
          outcomes={carryable}
          today={today}
          weekId={current?.week.id}
          previousWeekId={previous.week.id}
          reviewed={previous.week.reviewedAt !== null}
          onNext={() => setChosenStep('choose')}
        />
      )}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/screens/Plan.test.tsx src/components/plan && npm run lint`
Expected: PASS (2 new tests; the Phase 3–5 Plan and PlanTime tests still pass), lint clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/plan/CarryOver.tsx src/screens/Plan.tsx src/screens/Plan.test.tsx
git commit -m "feat: show last week's numbers on the plan and offer only what the review rolled forward"
```

---

### Task 13: The weekly loop, end to end, and the README

**Files:**
- Create: `e2e/weekly-loop.spec.ts`
- Modify: `README.md` (a "Shutdown and review" section before "## Checks")

**Interfaces:**
- Consumes: every screen and route of Tasks 1–12, through the browser and the API.
- Produces: one Playwright journey, so the suite runs 16 tests (14 desktop, 2 phone).

- [ ] **Step 1: Write the journey**

Create `e2e/weekly-loop.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';

// The full weekly loop on a fixed browser clock in June 2027, far from every other journey's dates, so it can share
// the run's database. The server stamps its own clock, so this journey asserts only what follows from dates: the
// Must Ships, the strip, the grades and the carry-over, never the timestamp counts (rolled, killed, delegated).
const SUNDAY_1000 = new Date('2027-06-06T05:00:00Z'); // Karachi is UTC+5
const MONDAY_1730 = new Date('2027-06-07T12:30:00Z');
const FRIDAY_1600 = new Date('2027-06-11T11:00:00Z');
const NEXT_SUNDAY_1000 = new Date('2027-06-13T05:00:00Z');
const MONDAY = '2027-06-07';
const OUTCOMES = ['Warehouse audit closed', 'Distributor terms signed', 'Healify beta shipped'];
const MUST_SHIP = 'Audit findings sent to the COO';
const MEMO = 'Pricing memo for the distributors';

async function choose(page: Page, title: string, definition: string, button: string, category?: string) {
  await page.getByLabel('Outcome', { exact: true }).fill(title);
  await page.getByLabel('Definition of done').fill(definition);
  if (category) await page.getByLabel('Category').selectOption({ label: category });
  await page.getByRole('button', { name: button }).click();
}

async function planTheWeek(page: Page) {
  await page.clock.setFixedTime(SUNDAY_1000);
  await page.goto('/plan');
  await expect(page.getByRole('heading', { level: 2, name: "This week's outcomes" })).toBeVisible();
  await choose(page, OUTCOMES[0], 'Every finding closed or owned', 'Add outcome 1');
  await expect(page.getByRole('button', { name: 'Add outcome 2' })).toBeVisible();
  await choose(page, OUTCOMES[1], 'Signed by both sides', 'Add outcome 2');
  await expect(page.getByRole('button', { name: 'Add outcome 3' })).toBeVisible();
  await choose(page, OUTCOMES[2], 'Ten beta users active', 'Add outcome 3', 'Business');
  await page.getByRole('button', { name: 'Done planning time' }).click();
  const monday = page.getByRole('region', { name: 'Next Must Ship' });
  await expect(monday.getByRole('heading', { name: 'Must Ship for Monday 7 June' })).toBeVisible();
  await monday.getByLabel('Must Ship', { exact: true }).fill(MUST_SHIP);
  await monday.getByLabel('Definition of done').fill('Sent with owners and dates');
  await monday.getByRole('button', { name: 'Set Must Ship' }).click();
  await expect(monday.getByText(MUST_SHIP)).toBeVisible();
}

async function shutDownMonday(page: Page) {
  await page.clock.setFixedTime(MONDAY_1730);
  await page.goto('/');
  await page.getByRole('link', { name: 'Close the day' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Shutdown' })).toBeVisible();
  const grade = page.getByRole('region', { name: 'What shipped today?' });
  await grade.getByRole('button', { name: 'Partial' }).click();
  await expect(grade.getByRole('checkbox', { name: 'Roll to Tuesday 8 June' })).toBeChecked();
  await grade.getByRole('button', { name: 'Save' }).click();

  const open = page.getByRole('region', { name: 'What remains open?' });
  await open.getByRole('button', { name: `Move "${MEMO}" to tomorrow` }).click();
  // Earlier journeys in this run left delegated items whose follow-up dates have passed by June 2027: answer each.
  const received = open.getByRole('button', { name: /^Received "/ });
  for (let left = await received.count(); left > 0; left = await received.count()) {
    await received.first().click();
    await expect(received).toHaveCount(left - 1);
  }
  const next = open.getByRole('button', { name: "Next: tomorrow's Must Ship" });
  await expect(next).toBeEnabled();
  await next.click();

  const tomorrow = page.getByRole('region', { name: "Tomorrow's Must Ship" });
  await expect(tomorrow.getByText(MUST_SHIP)).toBeVisible();
  await expect(tomorrow.getByText('Rolled forward once')).toBeVisible();
  await tomorrow.getByRole('button', { name: 'Continue' }).click();
  const secondaries = page.getByRole('region', { name: "Tomorrow's secondaries" });
  await secondaries.getByRole('button', { name: 'Add a secondary' }).click();
  await secondaries.getByRole('list', { name: 'Choose a secondary' }).getByRole('button', { name: MEMO }).click();
  await expect(secondaries.getByRole('checkbox', { name: MEMO })).toBeVisible();
  await secondaries.getByRole('button', { name: 'Close the day' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Tomorrow is ready' })).toBeVisible();
  await expect(page.getByText(`Tuesday 8 June: ${MUST_SHIP}`)).toBeVisible();
}

async function reviewFriday(page: Page) {
  await page.clock.setFixedTime(FRIDAY_1600);
  await page.goto('/review');
  const board = page.getByRole('region', { name: 'Scoreboard' });
  await expect(board.locator('dd').nth(1)).toHaveText('0 of 2');
  await expect(page.getByRole('list', { name: 'Day strip' }).getByRole('listitem')).toHaveText([
    'Mon · Partial',
    'Tue · Planned',
    'Wed · None',
    'Thu · None',
    'Fri · None',
  ]);
  const review = page.getByRole('region', { name: 'Friday review' });
  let form = review.getByRole('form', { name: `Review "${OUTCOMES[0]}"` });
  await form.getByRole('radio', { name: 'Done' }).check();
  await form.getByRole('button', { name: 'Save grade' }).click();
  form = review.getByRole('form', { name: `Review "${OUTCOMES[1]}"` });
  await form.getByRole('radio', { name: 'Partial' }).check();
  await form.getByLabel('Why did it slip?').selectOption({ label: 'Priority changed' });
  await form.getByRole('radio', { name: 'Roll into next week' }).check();
  await form.getByRole('button', { name: 'Save grade' }).click();
  form = review.getByRole('form', { name: `Review "${OUTCOMES[2]}"` });
  await form.getByRole('radio', { name: 'Missed' }).check();
  await form.getByRole('radio', { name: 'Kill' }).check();
  await form.getByRole('button', { name: 'Save grade' }).click();
  await review.getByRole('button', { name: 'Review done' }).click();
  await expect(review.getByText('Reviewed.')).toBeVisible();
  await expect(board.locator('dd').first()).toHaveText('1 of 3');
}

test('runs the weekly loop: plan, shut down, review, and carry forward', async ({ page, request }) => {
  await planTheWeek(page);

  const memo = (await (await request.post('/api/exec/tasks', { data: { title: MEMO, context: 'work' } })).json()).data;
  const scheduled = await request.patch(`/api/exec/tasks/${memo.id}`, { data: { status: 'this_week', scheduledDate: MONDAY } });
  expect(scheduled.status()).toBe(200);
  const early = await request.post(`/api/exec/days/${MONDAY}/shutdown`, { data: {} });
  expect(early.status()).toBe(409);
  expect((await early.json()).code).toBe('SHUTDOWN_NOT_READY');

  await shutDownMonday(page);
  await reviewFriday(page);

  await page.clock.setFixedTime(NEXT_SUNDAY_1000);
  await page.goto('/plan');
  await expect(page.getByRole('heading', { level: 2, name: 'Last week' })).toBeVisible();
  await expect(page.getByText('Last week: 1 of 3 outcomes · 0 of 2 Must Ships · 0 min deep work')).toBeVisible();
  await expect(page.getByRole('button', { name: `Carry "${OUTCOMES[1]}" into this week` })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Carry "/ })).toHaveCount(1);
});
```

- [ ] **Step 2: Run the whole suite**

Run: `npm run test:e2e`
Expected: 16 passed (14 desktop, 2 phone). Then `ls /mnt/clarus_nvme/tmp | grep taskflow-e2e` prints nothing.

If the journey fails, read the Playwright trace (`test-results/`) and fix the screen or the selector the trace shows is wrong; do not loosen an assertion to make it pass.

- [ ] **Step 3: Document it**

In `README.md`, insert this section directly before `## Checks`:

```markdown
## Shutdown and review

From the shutdown time in settings, Today shows "Close the day". `/shutdown`
takes four steps, each saved as you go: grade today's Must Ship (Shipped,
Partial, Missed or Blocked; Partial and Missed roll it to the next work day
unless you untick it, and Blocked files the next action as a waiting task);
deal with whatever is still open (Tomorrow, Schedule, Delegate, Later or Kill
for each row); set tomorrow's Must Ship; and pick up to two secondaries. The
day cannot be closed while its Must Ship is still planned. Closing it ends any
session still running and shows "Tomorrow is ready".

`/review` shows the week's scoreboard (outcomes and Must Ships shipped, deep
work, rolled, killed and delegated), the strip of the work days' Must Ships,
and the earlier weeks, each of which opens its own scoreboard. The Friday
review grades each outcome Done, Partial or Missed; a slipped one takes a
reason and a decision: roll it into next week, reschedule it to a later week,
delegate it, or kill it. "Review done" stamps the week, and Sunday's plan then
offers only the outcomes you rolled forward.

```

- [ ] **Step 4: Commit**

```bash
git add e2e/weekly-loop.spec.ts README.md
git commit -m "test: add the weekly loop journey from Sunday plan to the next Sunday's carry-over"
```

---

### Task 14: Verify the phase

**Files:** none changed unless a check fails (then fix in the owning task's files and commit `fix: …`).

**Interfaces:** consumes everything above.

- [ ] **Step 1: Lint and coverage**

Run: `npm run lint && npm run test:coverage`
Expected: lint clean; every test passes (Phase 5's 725 plus about 85 new); line coverage at or above 80%, and every new file under `server/exec/review/`, `server/exec/days/shutdown.ts`, `server/exec/mustShips/block.ts`, `server/exec/tasks/file.ts` and `src/shared/exec/{reviewSchemas,scoreboard,shutdown,review}.ts` at or above 90%. Record the totals.

- [ ] **Step 2: End to end**

Run: `npm run test:e2e`
Expected: 16 passed. `ls /mnt/clarus_nvme/tmp | grep taskflow-e2e` prints nothing.

- [ ] **Step 3: A manual run against a copy of the data**

Never touch `data/*.db`. Copy it and start the two servers on free ports (3000 and 3001 belong to another project):

```bash
D=/mnt/clarus_nvme/tmp/taskflow-p6-check && rm -rf $D && mkdir -p $D && cp data/*.db $D/
DB_PATH=$D/taskflow.db EXEC_DB_PATH=$D/execution.db TASKFLOW_API_PORT=4160 nohup npx tsx server/index.ts > $D/api.log 2>&1 &
TASKFLOW_API_PORT=4160 nohup npx vite --port 3160 --strictPort > $D/vite.log 2>&1 &
```

With a headless Playwright script (fixed browser clock via `page.clock.setFixedTime`, a week of your choosing), check each line of the phase's "done when" and record the result:

1. `POST /api/exec/days/<a work day with a planned Must Ship>/shutdown` answers 409 `SHUTDOWN_NOT_READY` (curl through `http://127.0.0.1:3160/api/exec`).
2. `/shutdown` after the shutdown time: grade Partial with the roll on, clear every open row, confirm the rolled Must Ship in step 3, close the day, and see "Tomorrow is ready" with the next work day's Must Ship; Today then shows the Tomorrow card and no "Close the day" banner.
3. Start a session on `/focus`, then close the day from `/shutdown`: the block is `abandoned` with `ended_at` set (read it with a read-only better-sqlite3 query on the temp copy; the `sqlite3` CLI is not installed).
4. `/review`: the scoreboard matches the numbers you can count in the temp database for that week (outcomes, work Must Ships on work days, finished-block minutes); the strip names each work day's Must Ship status; an earlier week opens its own scoreboard.
5. The Friday review grades every outcome (Done, a Roll, a Reschedule into a later week, a Delegate, a Kill across one or two weeks), "Review done" stamps the week, the rescheduled copy exists in the later week with its target date, the delegated task exists with its owner, and the next week's `/plan` offers only the rolled-forward outcome.

Stop both servers (by their PIDs; never `pkill -f` a pattern that matches your own shell) and `rm -rf $D`. Confirm `git status` is clean and port 3000 is untouched.

- [ ] **Step 4: Report**

Write the report the controller asked for: the totals from Steps 1–2, each manual check with pass or fail and what you saw, anything that did not pass, and anything you noticed but did not change.
