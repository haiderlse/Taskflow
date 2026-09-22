# Personal Execution System: Design

**Date:** 2026-09-22
**Status:** Approved design (sections A–D approved by Ali on 2026-09-22), pending implementation plan
**Requirements:** `2026-09-22-execution-system-handoff.md` in this directory. `§n` below cites its sections.
**Review page:** https://claude.ai/artifact/FkSydzPZNyeeF7iF9zs9NW (Stage 1 and Stage 2 findings in full)

## Goal

Turn the Taskflow repo into a deliberately constrained personal execution
system: three outcomes a week, one Must Ship a workday, two secondary
priorities, a protected 90-minute deep-work block, a capture inbox that never
commits, a daily shutdown and a Friday review. It is not a task manager.

The test (§27): opened on a Tuesday at 08:35, within five seconds it says what
matters this week, what must ship today and what to work on now. At 17:00 it
closes the day knowing what happened and what matters tomorrow.

## The behavioral system

One weekly loop with a daily rhythm:

- **Sunday, ~20 min** (§4, §5): choose at most three outcomes, then assign
  deep-work blocks to them. An outcome with no time is an aspiration.
- **Each workday:** 08:35–10:05 deep work on the one Must Ship (§8).
  Interruptions go to the Inbox without becoming commitments (§10). At 17:00
  the shutdown grades today's Must Ship, dispositions everything open, and
  picks tomorrow's Must Ship and up to two secondaries (§12).
- **Friday, ~15 min** (§13): grade each outcome, code why it slipped, then
  roll, reschedule, delegate or kill it. The scoreboard (§14) records the week.

The limits are the product, not a setting. Every feature must help decide,
execute, delegate or review (§25).

## Current state (measured 2026-09-22)

The repo is a Google AI Studio–generated Asana clone (~34k lines of
TypeScript) mid-migration from Supabase to a local SQLite API on
`feat/local-sqlite-db`. Plan Tasks 10–11 of
`2026-09-01-sqlite-local-db-migration-design.md` (remove the login gate,
delete Supabase) are still open.

- **Persistence is ~80% real:** Express + better-sqlite3 behind a loopback
  Vite proxy, a write-through cache, 181 passing tests, 80%+ coverage on
  `server/`. Only `users`, `projects`, `tasks` have tables. There is no
  migration mechanism. `data/` has never been created on this machine.
- **None of the nine product behaviors exist.** No entity for Outcome, Must
  Ship, Day Plan, Deep Work Session or Review. "Inbox" is a notification feed
  with no capture input. No delegation fields. Analytics fabricate numbers.
- **The frontend conflicts with the product** (§21): a multi-tenant
  collaboration model, ten nav items, fake and dead pages, Tailwind via the
  Play CDN with v4 class names that silently do nothing.

### Reused

Keep as-is: `server/db/{connection,mappers,sql}.ts` and the route pattern
(allowlisted SQL identifiers, adversarial tests per router); the `app.ts`
error handler; the `services/__tests__/support/liveApi.ts` harness;
`server/config.ts` and the loopback Vite proxy; the `services/apiClient.ts`
helper shape; `utils/ThemeContext.tsx`; `utils/ux.tsx` toasts and confirm
dialog (fix: cancel never resolves); `utils/accessibility.tsx`; the icon set.

Borrow logic from: `services/calendarService.ts` date math (`findFreeSlots`,
`layoutOverlaps`, recurrence); the `components/PlannerPage.tsx` hour grid with
15-minute snap; the `components/TimeTracking.tsx` timer loop;
`services/reminderService.ts` scheduling and browser Notification handling.

Retire (after Phase 7): everything else under `components/`, `services/`,
`utils/`, and `App.tsx`.

## Decisions

1. **New shell on the existing foundation.** Keep the server layer, tests,
   `apiClient`, theme and toasts; build the five screens fresh in this repo;
   park the Asana UI at a hidden route until the MVP proves itself. Rejected:
   retrofitting inside the Asana UI (inherits everything §21 forbids); a fresh
   repo (discards ~3k lines of tested server code).
2. **Desktop app plus a phone capture page** over the same loopback API. Ali
   reaches it through his own tailnet and accepts the LAN-exposure risk the
   SQLite spec flagged. No authentication work in the MVP.
3. **Outcome progress is set by hand** (a slider on the Week screen); grading
   an outcome done sets 100. Deriving it from task counts would reward task
   count (§2).
4. **Delegation owners are names, not accounts:** `owner_name` is free text
   with autocomplete from earlier values.
5. **A Build day may carry one build-context Must Ship** and uses the same
   Deep Work screen (§16).
6. **Nothing is hard-deleted except an inbox item.** History feeds the
   scoreboard.

### Assumptions in force

1. Runtime stays local: Vite app + Express API on this machine, desktop
   browser, plus the phone capture page.
2. The planning week runs Sunday to Saturday; Friday is review day; Saturday
   is a Build day.
3. Build blocks (Tue/Thu 06:30–07:20, Sat) use the Deep Work screen focused on
   a Build outcome or Must Ship.
4. The legacy seed data (Ali / Bob / Charlie, "AOP 2025-26 Enterprise Plan")
   is disposable and is never migrated.
5. Timezone is Asia/Karachi; all calendar dates are local dates.

## A. Foundation and runtime

| # | Decision | What | Why |
|---|---|---|---|
| 1 | New `src/` tree | `src/app`, `src/screens`, `src/components`, `src/api`, `src/lib`, `src/shared`, `src/styles`. `index.tsx` mounts the new app. The Asana UI lazy-loads at `/legacy/*`. | Nothing under `components/`, `services/`, `utils/` is touched. Retiring legacy later is one `git rm -r`. |
| 2 | Real URLs via `react-router-dom` | `/` Today, `/week`, `/inbox`, `/projects`, `/review`; full-screen `/focus`, `/shutdown`, `/plan`; phone page `/capture`; `/legacy/*`. | `/capture` is a phone bookmark; `/focus` is a screen with nothing else on it. |
| 3 | Direct fetch client + TanStack Query | New screens call a small typed client (`src/api/client.ts`, same shape as `services/apiClient.ts`). No `enhancedApi`, no `apiSync`. | Drops the "persists only if named `get*` and written as native `async`" conventions. Refetch-on-focus shows a phone capture on the desktop when the tab regains focus. |
| 4 | Second SQLite file `data/execution.db` | Own schema, own migration runner (`PRAGMA user_version` + numbered SQL files applied at boot), `busy_timeout` set. Routes under `/api/exec/*`. Opened by the same Express process. | No collision with legacy `tasks` / `projects`. The 181 legacy tests stay untouched. Deleting legacy is one `rm`. |
| 5 | Tailwind v4 via `@tailwindcss/vite` | Replaces the Play CDN, its inline config and the esm.sh importmap. Dark mode keeps the `.dark` class via `@custom-variant dark (&:where(.dark, .dark *))`. Tokens in `src/styles/app.css`. | Legacy already uses v4 class names, so ~200 no-op classes start working. Production builds get real CSS. |
| 6 | `TASKFLOW_BIND` env var | Default `127.0.0.1`. Set to a tailnet IP to expose Vite only; `TASKFLOW_ALLOWED_HOST` feeds `server.allowedHosts`. The API always binds `127.0.0.1:4100`. Startup prints a warning when the bind is not loopback. | The phone talks to Vite; Vite proxies. The unauthenticated write surface never binds beyond the machine. |
| 7 | `strict: true` for new code | `tsconfig.app.json` extends the root config with `strict`, covering `src/` and `server/`; `npm run lint` runs both configs. | Legacy stays non-strict until it is deleted. |
| 8 | Phase 0 first | Finish plan Tasks 10–11: remove the login gate, delete Supabase, drop the `GEMINI_API_KEY` define. | About an hour, already specified. Stops the repo carrying a login screen that protects nothing. |

Dev workflow stays two terminals: `npm run server` and `npm run dev`.

## B. Data model and API

Nine tables in `data/execution.db`, every limit a database constraint, ~20
routes under `/api/exec/*`, one set of zod schemas shared by client and
server.

### Hierarchy

```
Week ──▶ Outcome (≤3 per week) ──▶ Must Ship (≤1 per day per context) ──▶ Task
Project ─▶ Outcome                  Day ──▶ Secondary slot (≤2) ──▶ Task
Deep-work block ──▶ Outcome | Must Ship
```

Nothing below a Week is mandatory: a task can float with no project, outcome
or Must Ship (§17).

### Conventions

- `id TEXT PRIMARY KEY`, a UUID generated by the server; `days` and
  `day_slots` use their natural keys instead.
- `created_at`, `updated_at`: ISO-8601 UTC text on every table; the server
  sets both.
- Dates (`date`, `start_date`, `target_date`, `scheduled_date`, `due_date`,
  `follow_up_date`): `YYYY-MM-DD` local dates in the settings timezone.
- Times of day (`deep_work_start`, `planned_start`, `shutdown_time`): `HH:MM`.
- All tables are `STRICT`; `PRAGMA foreign_keys = ON`; `journal_mode = WAL`;
  `busy_timeout = 5000`.
- No JSON columns except `settings.work_days` and `settings.build_blocks`,
  which are read whole and never queried.

### Tables

**settings** — the single configuration row.

| Column | Type | Default / constraint |
|---|---|---|
| id | INTEGER PK | `CHECK (id = 1)` |
| timezone | TEXT NOT NULL | `'Asia/Karachi'` |
| week_start_day | INTEGER NOT NULL | 0 (Sunday) |
| work_days | TEXT NOT NULL | `'[1,2,3,4,5]'` (JSON, 0 = Sunday) |
| deep_work_start | TEXT NOT NULL | `'08:35'` |
| deep_work_minutes | INTEGER NOT NULL | 90 |
| shutdown_time | TEXT NOT NULL | `'17:00'` |
| office_start | TEXT NOT NULL | `'08:15'` (Build card hidden from here…) |
| office_end | TEXT NOT NULL | `'18:00'` (…until here) |
| build_blocks | TEXT NOT NULL | JSON `[{weekday, start, minutes}]`; default Tue 06:30×50, Thu 06:30×50, Sat 09:00×180 |

**projects**

| Column | Type | Constraint |
|---|---|---|
| name | TEXT NOT NULL | |
| context | TEXT NOT NULL | `IN ('work','build')` |
| status | TEXT NOT NULL | `IN ('active','done','archived')`, default `active` |
| notes | TEXT NOT NULL | default `''` |

**weeks**

| Column | Type | Constraint |
|---|---|---|
| start_date | TEXT NOT NULL | UNIQUE; the week's first day per `week_start_day` |
| reviewed_at | TEXT | set by `POST /weeks/:id/review` |
| review_notes | TEXT NOT NULL | default `''` |

**outcomes**

| Column | Type | Constraint |
|---|---|---|
| week_id | TEXT NOT NULL | REFERENCES weeks(id) |
| slot | INTEGER | `IN (1,2,3)`; `UNIQUE (week_id, slot)` |
| title | TEXT NOT NULL | |
| description | TEXT NOT NULL | default `''` |
| category | TEXT NOT NULL | `IN ('office','business','career','personal')`; context is derived: office → work, else build |
| definition_of_done | TEXT NOT NULL | default `''` |
| target_date | TEXT | |
| project_id | TEXT | REFERENCES projects(id) |
| progress | INTEGER NOT NULL | `BETWEEN 0 AND 100`, default 0 |
| status | TEXT NOT NULL | `IN ('active','done','killed')`, default `active` |
| review_grade | TEXT | `IN ('done','partial','missed')` |
| review_reason | TEXT | `IN ('insufficient_time','unexpected_urgent_work','dependency_blocker','poor_estimation','too_many_meetings','priority_changed','procrastination','unclear_outcome','delegated_dependency','no_longer_important','other')` (§13) |
| review_disposition | TEXT | `IN ('roll_forward','reschedule','delegate','kill')` |
| rolled_from_id | TEXT | REFERENCES outcomes(id) |
| notes | TEXT NOT NULL | default `''` |
| closed_at | TEXT | set when status becomes done or killed |
| *table* | | `CHECK ((status = 'killed') = (slot IS NULL))` — a killed outcome frees its slot |

**must_ships**

| Column | Type | Constraint |
|---|---|---|
| title | TEXT NOT NULL | |
| definition_of_done | TEXT NOT NULL | default `''` |
| context | TEXT NOT NULL | `IN ('work','build')`; stored explicitly, the UI defaults it from the linked outcome |
| date | TEXT | NULL = candidate (§17); `UNIQUE (date, context)` |
| outcome_id | TEXT | REFERENCES outcomes(id) |
| project_id | TEXT | REFERENCES projects(id) |
| status | TEXT NOT NULL | `IN ('planned','shipped','partial','missed','blocked','killed')`, default `planned` |
| blocker_what, blocker_owner, blocker_next_action | TEXT | all three required when status becomes `blocked` (route check, §8) |
| notes | TEXT NOT NULL | default `''`; free text for links and references |
| rolled_from_id | TEXT | REFERENCES must_ships(id) |
| roll_count | INTEGER NOT NULL | default 0 |
| closed_at | TEXT | set when status leaves `planned` |

**days**

| Column | Type | Constraint |
|---|---|---|
| date | TEXT PK | |
| shutdown_at | TEXT | set by `POST /days/:date/shutdown` |
| notes | TEXT NOT NULL | default `''` |

**day_slots**

| Column | Type | Constraint |
|---|---|---|
| date | TEXT NOT NULL | REFERENCES days(date) ON DELETE CASCADE |
| slot | INTEGER NOT NULL | `IN (1,2)` |
| task_id | TEXT NOT NULL | REFERENCES tasks(id) |
| *table* | | `PRIMARY KEY (date, slot)`; `UNIQUE (date, task_id)` |

**deep_work_blocks**

| Column | Type | Constraint |
|---|---|---|
| date | TEXT NOT NULL | indexed |
| context | TEXT NOT NULL | `IN ('work','build')` |
| planned_start | TEXT NOT NULL | `HH:MM` |
| planned_minutes | INTEGER NOT NULL | |
| outcome_id | TEXT | REFERENCES outcomes(id) |
| must_ship_id | TEXT | REFERENCES must_ships(id) |
| started_at, ended_at | TEXT | server timestamps; `CHECK (ended_at IS NULL OR started_at IS NOT NULL)` |
| paused_seconds | INTEGER NOT NULL | default 0 |
| pause_started_at | TEXT | non-null while paused |
| result | TEXT | `IN ('completed','progress','blocked','abandoned')` |
| notes | TEXT NOT NULL | default `''` |

**tasks** — captured items.

| Column | Type | Constraint |
|---|---|---|
| title | TEXT NOT NULL | |
| notes | TEXT NOT NULL | default `''` |
| context | TEXT NOT NULL | `IN ('work','build')` |
| status | TEXT NOT NULL | `IN ('inbox','this_week','later','delegated','waiting','done','killed')`, default `inbox` |
| project_id, outcome_id, must_ship_id | TEXT | FKs, all optional |
| scheduled_date, due_date | TEXT | |
| owner_name | TEXT | required when status is `delegated` or `waiting` (route check) |
| expected_output | TEXT | |
| follow_up_date | TEXT | indexed |
| roll_count | INTEGER NOT NULL | default 0 |
| rolled_at | TEXT | last time `POST /tasks/:id/roll` ran |
| captured_at | TEXT NOT NULL | |
| processed_at | TEXT | first time status leaves `inbox` |
| delegated_at | TEXT | when status becomes `delegated` or `waiting` |
| closed_at | TEXT | when status becomes `done` or `killed` |

Indexes: `tasks(status)`, `tasks(scheduled_date)`, `tasks(follow_up_date)`,
`deep_work_blocks(date)`, `must_ships(date)`, `outcomes(week_id)`.

### The limits, as constraints

| Rule (§2) | Mechanism |
|---|---|
| Max 3 outcomes per week | `outcomes.slot IN (1,2,3)` + `UNIQUE (week_id, slot)`; a killed outcome drops its slot so a replacement can take it |
| Max 1 Must Ship per workday | `UNIQUE (must_ships.date, context)`; a Build day may carry its own build Must Ship |
| Max 2 secondaries per day | `day_slots.slot IN (1,2)` + `PRIMARY KEY (date, slot)` |
| Capture ≠ commitment | `tasks.status` defaults to `inbox`; only a day slot or a Must Ship link puts a task on Today |
| Conscious disposition | `POST /days/:date/shutdown` is refused while that day's work Must Ship is still `planned` |
| Roll-forward stays visible | `rolled_from_id` + `roll_count` on outcomes, must ships and tasks |

### Routes

Mounted at `/api/exec`. Responses are `{ success: true, data }` or
`{ success: false, error, code }`. Codes: `VALIDATION` (400), `NOT_FOUND`
(404), `WEEK_FULL` (409), `DAY_TAKEN` (409), `SLOT_LIMIT` (400),
`SHUTDOWN_NOT_READY` (409), `DELETE_NOT_ALLOWED` (409), `CONSTRAINT` (400).

| Method and path | Does |
|---|---|
| GET, PUT `/settings` | read or replace the configuration row |
| GET `/projects`, POST `/projects`, PATCH `/projects/:id` | projects |
| POST `/weeks` `{ date }` | create or return the week containing `date` (200 if it exists, 201 if created) |
| GET `/weeks/:id` | week + outcomes + planned blocks: the Week screen in one call |
| GET `/weeks/:id/scoreboard` | the numbers defined below |
| POST `/weeks/:id/review` | stamp `reviewed_at`; 409 until every slotted outcome has a `review_grade` |
| POST `/weeks/:id/outcomes` | add to the lowest free slot; 409 `WEEK_FULL` with the three current outcomes |
| PATCH `/outcomes/:id` | edit, progress, grade, reason, disposition, kill (kill sets `slot = NULL`, `closed_at`) |
| POST `/outcomes/:id/roll` `{ weekId }` | copy into that week with `rolled_from_id`; the original keeps its grade and disposition |
| GET `/must-ships?date&status&outcome&context` | candidates and history |
| POST `/must-ships` | create; 409 `DAY_TAKEN` with the existing one when `(date, context)` is taken |
| PATCH `/must-ships/:id` | status, blocker fields, date, links, notes |
| POST `/must-ships/:id/roll` `{ date }` | copy to `date` with lineage and `roll_count + 1`; the original keeps its status |
| GET `/days/:date` | `{ day, week, mustShip, buildMustShip, secondaries, waiting, blocks, inboxCount }` — the Today screen in one call |
| PUT `/days/:date/slots` `{ taskIds: string[] }` | set the secondaries; 400 `SLOT_LIMIT` beyond two; creates the `days` row if missing |
| POST `/days/:date/shutdown` | stamp `shutdown_at`; 409 `SHUTDOWN_NOT_READY` while the work Must Ship is `planned` |
| GET `/deep-work?from&to` | blocks in a date range |
| POST `/deep-work`, PATCH `/deep-work/:id` | plan a block; link it to an outcome or Must Ship |
| POST `/deep-work/:id/start` | sets `started_at` (idempotent while running) |
| POST `/deep-work/:id/pause`, `/resume` | sets or folds `pause_started_at` into `paused_seconds` |
| POST `/deep-work/:id/finish` `{ result, notes, blocker? }` | sets `ended_at`, `result`. When the block has a Must Ship: `completed` marks it `shipped`; `blocked` writes the blocker onto it, sets it `blocked`, and creates a `waiting` task for `blocker_next_action` owned by `blocker_owner` with `follow_up_date` tomorrow |
| GET `/tasks?status&context&week&followUpBy` | the Inbox, This week, Later and Waiting lists. `week` returns tasks with status `this_week`, or any open status with `scheduled_date` inside that week |
| POST `/tasks` `{ title, context }` | capture; status `inbox`, `captured_at` now |
| PATCH `/tasks/:id` | process and dispose; the server sets `processed_at`, `delegated_at`, `closed_at` as status changes |
| POST `/tasks/:id/roll` `{ date }` | `scheduled_date = date`, `roll_count + 1`, `rolled_at` now (used by Shutdown's "Tomorrow") |
| DELETE `/tasks/:id` | only while `inbox`; otherwise 409 `DELETE_NOT_ALLOWED` |

Each step of Shutdown and Sunday planning is its own PATCH or POST, so a
half-finished ritual survives a reload.

### Scoreboard (§14)

| Number | Definition |
|---|---|
| Outcomes shipped | `review_grade = 'done'` over outcomes with a non-null slot in the week |
| Must Ships shipped | `status = 'shipped'` over work-context must ships dated on the week's work days |
| Deep work | Σ (`ended_at` − `started_at` − `paused_seconds`) over finished blocks dated in the week |
| Rolled forward | outcomes and must ships created in the week with `rolled_from_id` set, plus tasks with `rolled_at` in the week |
| Killed | outcomes, must ships and tasks with `closed_at` in the week and status `killed` |
| Delegated | tasks with `delegated_at` in the week |
| Day strip | for each work day: the work Must Ship's status, or none |

### Validation

One zod schema per resource in `src/shared/exec/schemas.ts`, imported by the
routes and the client; TypeScript types are `z.infer`. Routes parse bodies
with the schema, then pass the result through `entityToRow` and the existing
`assertValidColumns` guard before any SQL is built. Statements are always
parameterised; identifiers come from `getTableColumns`.

### Migrations

`server/exec/migrations/001_init.sql` creates the nine tables and inserts the
settings row with the defaults above. `server/exec/db/migrate.ts` reads
`PRAGMA user_version`, applies each `NNN_*.sql` above it inside its own
transaction, and writes the number. Tests run the same files on `:memory:`.
No demo data is seeded.

### Pure core (`src/shared/exec/`)

No React, no I/O, 100% covered:

- `weekOf(date, settings) → { startDate, endDate }`
- `todayMode(now, settings, day) → { banners, primary }` (the tables in C)
- `elapsed(block, now) → { seconds, remaining, paused }`
- `isActivityTitle(title) → boolean` (§9 nudge)
- `scoreboard(weekRows) → Scoreboard`
- `defaultBlocksFor(week, settings) → DeepWorkBlock[]`

## C. Screens and flows

Five screens in the nav, four full-screen flows outside it, one phone page.
Every screen shows only what this moment needs.

### Navigation

| Route | Screen | The question it answers |
|---|---|---|
| `/` | Today | What must I ship today, and what am I working on right now? |
| `/week` | Week | What are the three outcomes, how far are they, when is the deep work? |
| `/inbox` | Inbox | What have I captured but not decided about? |
| `/projects` | Projects | What longer-running work holds these outcomes? |
| `/review` | Review | What shipped, what slipped, and why? |

Outside the nav, full screen with no sidebar: `/focus`, `/shutdown`, `/plan`,
`/capture`. A slim left rail on desktop; the same five entries as a bottom bar
on phone widths. `/legacy/*` is reachable only by typing it.

### Today is time-aware (§19, §27)

`todayMode` reads the clock against settings and the day's data and returns
the banners to show and the one primary card.

Banners sit above the primary card and show whenever their condition holds:

| Condition | Banner |
|---|---|
| The week has no outcomes | "Plan this week" → `/plan` |
| Work day, at or after `shutdown_time`, shutdown not done | "Close the day" → `/shutdown` |

The primary card is the first match:

| Moment | Primary card |
|---|---|
| Non-work day, or before `office_start`, or after `office_end` | The Build card (build Must Ship or outcome, its block, Start), or "Nothing planned for Build" → `/week`. After a shutdown today, a "Tomorrow: …" line sits under it. |
| Shutdown done today | Tomorrow's Must Ship and "Tomorrow is ready" |
| No work Must Ship for today | "Choose today's Must Ship": pick a candidate or write one |
| A block is live or paused | "Resume focus" → `/focus` |
| Today's block ended, Must Ship still `planned` | Must Ship card with Shipped / Progress / Blocked |
| Otherwise | Must Ship card with "Start deep work" (enabled any time; the window is a default, not a lock) |

### Today (`/`), top to bottom

1. Date, week number, one line for the week ("2 of 3 on track") → `/week`.
2. MUST SHIP card: title large, definition of done in one line, the outcome it
   serves, the deep-work window, the primary action. Empty state when none.
3. SECONDARY: at most two rows with a checkbox; an empty slot offers "add"
   from this week's tasks or the Inbox. There is no third row.
4. WAITING: "N delegated items need follow-up", expanding to `delegated` and
   `waiting` tasks with `follow_up_date` ≤ today. Row actions: "Followed up"
   (sets the next date) and "Received" (done).
5. Capture: one input pinned at the bottom, also opened by `c` anywhere.
   Saves a task as `inbox`; context defaults to work in office hours and
   build outside them. Toast: "Captured. It is in the Inbox, not on Today."

The Build card appears only outside office hours or on non-work days, so it
never competes with the office Must Ship (§16).

### Week (`/week`)

1. Header: week number, date range, whether Sunday planning is done.
2. Three outcome cards or empty slots: category tag, title, a progress slider,
   definition of done folded, target date, Must Ships shipped x of y,
   deep-work minutes planned and done. Actions: edit, roll, kill. An outcome
   with no planned block shows "No time allocated" (§5).
3. When all three slots are taken, "Add" becomes "Replace": pick which outcome
   gives up its slot, with a reason.
4. Deep Work Calendar: seven columns, 06:00–19:00, the `PlannerPage` grid with
   15-minute snap. `defaultBlocksFor` places the settings blocks. Click or drag
   a block onto an outcome to assign it. After a block runs, it shows its
   result.
5. This week's tasks (`this_week`, or `scheduled_date` in the week), grouped
   by outcome then project, unlinked last. Done and killed fold away.
6. Waiting and delegated, the full list.

### Inbox (`/inbox`)

Two tabs: Inbox (`inbox`) and Later (`later`). Rows show title, context, when
captured; newest first; a counter of how many remain. Processing is
keyboard-first on the selected row: `T` this week, `L` later, `D` delegate
(owner, expected output, follow-up date), `S` schedule (a date), `P` project,
`X` delete. A processed row leaves the list at once.

### Projects (`/projects`)

A list, never a board, in two groups: WORK and BUILD. Each project shows
status, active outcomes, Must Ship candidates and open tasks. Opening one
shows its outcomes by week, its Must Ship candidates (§17: planned outputs
with no date yet), and its tasks. New candidates are written here or during
Shutdown.

### Review (`/review`)

1. The scoreboard for the selected week (default current) and the Mon–Fri
   strip.
2. Earlier weeks as rows: outcomes x of 3, Must Ships x of y, deep-work
   hours, rolled, killed, delegated.
3. The Friday review stepper (below).

### Deep Work (`/focus`) (§8)

Opened from Today; starts or resumes today's block for that context. The
screen holds the Must Ship title, its definition of done, its notes, a large
countdown from `planned_minutes`, Pause and Resume, and three exits:
Completed, Made progress, Blocked. Nothing else.

- The countdown derives from `started_at` and `paused_seconds` via `elapsed`,
  so a reload or a closed tab loses nothing.
- Past zero it counts up quietly; no alarm.
- Completed marks the Must Ship `shipped`. Made progress leaves it `planned`
  for Shutdown to grade. Blocked asks three things inline (what blocks it, who
  owns the unblock, the next action) and files the next action as a `waiting`
  task on that owner with a follow-up tomorrow.
- Five minutes before `deep_work_start`, a browser notification says "Deep
  work begins in 5 minutes" when the tab is open; permission is asked once,
  from Today (§23).

### Shutdown (`/shutdown`) (§12), four steps, each saved as you go

1. What shipped today? Today's Must Ship with Shipped / Partial / Missed /
   Blocked. Partial and Missed offer "Roll to tomorrow", on by default.
2. What remains open? Secondaries not done, tasks scheduled today, waiting
   items due for follow-up, and "N captured items" with a link to process now
   or leave. Each row: Tomorrow, Schedule, Delegate, Later, Kill.
3. Tomorrow's Must Ship, required: pick a candidate (a rolled one is
   pre-selected) or write one with its definition of done. The nudge applies.
4. Two secondary priorities, optional, at most two.

Finishing stamps the day and shows "Tomorrow is ready" with tomorrow's plan.
The server refuses the stamp while today's Must Ship is `planned`, so step 1
cannot be skipped.

### Sunday planning (`/plan`) (§4, §5), runs any day the week has no outcomes

1. Last week at a glance: its scoreboard, and outcomes rolled forward offered
   as candidates.
2. Choose three outcomes, one slot at a time: title, category, definition of
   done (required, with the nudge), target date (default Friday), project
   (optional). A fourth cannot be added, only replaced.
3. "When will you actually work on these?": the week grid with the default
   blocks placed; assign each block to an outcome. Outcomes still without a
   block are flagged before you can finish.
4. "Week N is planned." Monday's Must Ship can be set here too.

### Friday review (inside `/review`) (§13)

1. Each slotted outcome in turn: Done / Partial / Missed, then one reason from
   the eleven, then Roll / Reschedule (a week or date) / Delegate (owner) /
   Kill.
2. The scoreboard, then "Review done" (`POST /weeks/:id/review`). Rolled
   outcomes appear as candidates in the next Sunday plan.

### Capture (`/capture`), the phone page (§10)

One text field, a Work / Build toggle defaulting by time of day, one Save
button with a large touch target. After saving: "Captured, N in inbox", the
field clears, the last five captures stay visible. A web-app manifest makes
it a home-screen icon. Nothing else is on this page.

### The activity nudge (§9)

When a Must Ship or outcome title begins with an activity verb (work on, look
into, continue, review, discuss, follow up, think about, research) or its
definition of done is empty, one line appears under the field: "This sounds
like an activity. What will exist when it is finished?" and the
definition-of-done field takes focus. It never blocks saving.

### Keyboard, first run, look and feel

- `c` capture anywhere; `f` opens focus when a Must Ship is set; the six
  Inbox keys. Nothing more.
- First run: no demo data. Today says "Plan your first week" → `/plan`.
- One accent colour, generous space, large type for the single thing that
  matters and muted type for everything else. No nested cards, no badge
  clusters, no charts outside Review. Dark mode stays. Concrete styling is
  decided at build time with the frontend-design pass, inside these rules
  (§21).

## D. Testing, security, exclusions, sequencing

### Testing

| Layer | Tool | What is tested | Target |
|---|---|---|---|
| Migrations and constraints | vitest, better-sqlite3 `:memory:` | each migration applies from every earlier version; the database rejects a fourth outcome, a second Must Ship per day per context, a third secondary; killed ⇔ slot null | every constraint has a test |
| Routes `/api/exec/*` | vitest, supertest, `liveApi` | every route's happy path; every 400/404/409 code; shutdown refused while `planned`; roll lineage; scoreboard against a fixture week; week and day boundaries at Sunday and PKT midnight | 80%+ lines on `server/exec/` |
| Pure core | vitest | `weekOf`, `todayMode`, `elapsed`, `isActivityTitle`, `scoreboard`, `defaultBlocksFor` | 100% |
| Client hooks | vitest, jsdom, Testing Library | Query hooks invalidate after a mutation; `WEEK_FULL` and `DAY_TAKEN` surface the replace prompt | 80%+ on `src/api`, `src/lib` |
| Components | vitest, jsdom, Testing Library | Today's primary action for each moment; Inbox keys; the nudge; the countdown under fake timers | the components a bug would cost a plan in |
| End to end | Playwright, real server, temp database | one journey per ritual: plan a week; capture and process; Must Ship → focus → Blocked; shutdown → "Tomorrow is ready"; Friday review → scoreboard; `/capture` at a phone viewport | one journey per phase from Phase 2 on |

Vitest runs two projects: `node` for `server/**` and `src/shared/**`, `jsdom`
for the rest of `src/**`. Coverage thresholds stay at 80% and include
`server/exec/**` and `src/**`. Playwright lives in `e2e/` behind
`npm run e2e`, which starts the API on a temporary `DB_PATH` and Vite on a free
port. TDD applies: the failing test lands before the code that passes it.

**After every phase** (§26 Stage 5): `npm run lint`, `npm run test:coverage`,
the phase's Playwright journey, a manual run of the app against the phase's
"done when" line, and a short written report of what changed and what did not
pass.

### Security, item by item

| Item | Here |
|---|---|
| Secrets | none in code; `.env.example` lists only `TASKFLOW_API_PORT`, `DB_PATH`, `TASKFLOW_BIND`, `TASKFLOW_ALLOWED_HOST` |
| Input validation | zod on every body; `assertValidColumns` before SQL; parameterised statements only |
| SQL injection | identifiers from the `PRAGMA table_info` allowlist; values always bound |
| XSS | React escaping; no `dangerouslySetInnerHTML`; notes render as text, no markdown in the MVP |
| CSRF | same-origin through the Vite proxy; no cookies, so no cross-site vector; `allowedHosts` limits `Host` when `TASKFLOW_BIND` is not loopback |
| Authentication | none, by decision 2: single user, API on loopback |
| Rate limiting | not applied: loopback, single user; the phone reaches Vite only over the tailnet |
| Error messages | the existing handler: never a stack trace, never a path |

### Not built in the MVP

| Not building | Why | Revisit |
|---|---|---|
| AI planning assistant | §22: after the loop proves itself; useful only with recorded data | after four weeks of real data |
| Calendar integration | an internal schedule is enough for one person (§5) | later |
| WhatsApp or email integration | §24 | later |
| Custom categories | the four fixed ones cover the stated ventures | when a fifth is needed |
| Accounts, team features | single user by design | not planned |
| Analytics beyond the scoreboard and day strip | needs data first (§15) | after the MVP |
| OS-level notifications | needs a service worker; §23 asks for minimal | later |
| Legacy data migration | nothing to migrate; the old database never existed | never |
| Search, attachments, comments, recurrence, subtasks, dependencies, custom fields, templates | none help decide, execute, delegate or review (§25) | not planned |
| Deleting the Asana UI | after the product review passes | Phase 7 |

### Build sequence

The implementation plan breaks each phase into small tasks with files, tests
and commits. This is the order and the bar for each.

| Phase | Objective | Database | Done when |
|---|---|---|---|
| 0 Clean up | Finish plan Tasks 10–11: remove the login gate, delete Supabase. Run the legacy app end to end once so `data/taskflow.db` exists. | none | Legacy opens with no login; all tests pass |
| 1 Foundation | `src/` shell, router, Tailwind v4 build, Query, `execution.db` with the migration runner and `001_init.sql`, `/api/exec/health`, `TASKFLOW_BIND`, strict tsconfig, vitest projects, Playwright scaffold, legacy at `/legacy` | all nine tables | The app boots to an empty Today saying "Plan your first week"; migration and constraint tests green; legacy still renders |
| 2 Capture and Inbox | tasks routes and schemas; `/capture`; Inbox with the six keys; Later tab; `c` capture from Today | none | A capture at a phone viewport appears in the desktop Inbox on focus; journey: capture then process |
| 3 Weeks and outcomes | weeks, outcomes and projects routes; `/plan` steps 1, 2 and 4; Week screen cards; the replace flow; Projects screen | none | A fourth outcome is refused with the replace prompt; the nudge shows; journey: plan a week |
| 4 Must Ship and Today | must ships, days and slots routes; Today with its moments; the Must Ship picker; secondaries; Waiting; a minimal Settings panel (times, work days, build blocks) | none | `DAY_TAKEN` and the two-slot limit hold; Today's action matches the table for every moment |
| 5 Deep Work | blocks routes; `/focus` with the countdown, pause, three exits and the Blocked path; the 5-minute notice; the Week grid with block assignment; `/plan` step 3 | none | A reload mid-session keeps the timer; Blocked files a waiting task; journey: start to Blocked |
| 6 Shutdown and Review | `/shutdown` four steps; roll endpoints; `/review` scoreboard, strip and history; the Friday stepper | none | Shutdown refused while `planned`; "Tomorrow is ready"; scoreboard matches the fixture; journey: the full weekly loop |
| 7 Product review | §26 Stage 6: use it for one real week, Sunday to Friday; fix friction; then decide on deleting legacy | `002_*.sql` if needed | Ali's verdict after a week of use |

### Branching

Phase 0 lands on `feat/local-sqlite-db` and merges to `main`. Phases 1–7 run
on `feat/execution-system`, one commit per task, conventional messages, each
phase reviewed before the next starts.

### Risks

- Tailwind v4 may shift legacy styling. Acceptable, legacy is parked; Phase 1
  checks it still renders.
- Week and day boundaries in PKT: pure functions with boundary tests.
- Scope creep: §25 is answered in every task description.
