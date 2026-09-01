# TaskFlow: Replace Supabase with Local SQLite + Node API

**Date:** 2026-09-01
**Status:** Approved design, pending implementation plan
**Approach:** A — repository swap behind the existing `enhancedApi` facade

## Goal

Remove the Supabase dependency entirely and give TaskFlow durable local
persistence via a SQLite file served by a local Node API.

The app must run with `npm run dev` on a single machine with no cloud
account, no Docker, and no network dependency.

## Why this is tractable

`services/enhancedApi.ts` is a facade. 40+ components import it; none of
them reference Supabase. Every Supabase call site follows one shape:

```ts
if (isSupabaseAvailable) {
  return await supabaseService.getUsers();
}
// ...in-memory fallback
```

Replacing that single branch with an HTTP call leaves the entire UI layer
untouched.

One wrinkle: `services/mockApi.ts` is a thin re-export shim over `enhancedApi`,
imported by `App.tsx` only (25 files import `enhancedApi` directly). It needs no
logic change, but note it captures method references at module load, so
`enhancedApi` methods must not depend on `this`. Its name is now misleading —
it proxies the real API, not a mock.

## Current state (measured, not assumed)

Supabase touches exactly 3 files: `supabaseService.ts` (33 refs),
`enhancedApi.ts` (67), `authService.ts` (21).

The live Supabase surface is **12 methods across 17 call sites**, covering
only users, projects and tasks.

| Domain | Backing store today | Survives refresh? |
|---|---|---|
| users, projects, tasks | Supabase if configured, else in-memory array | Only with Supabase |
| comments, time_entries, milestones, portfolios, goals | in-memory array only | **No** |
| calendar_events | localStorage | Yes |
| notifications, reminders, theme | localStorage | Yes |

`supabase-schema.sql` declares 9 tables, but only 3 were ever wired.
Five domains have never had persistence. Fixing that is a larger practical
win than the Supabase removal itself.

**Not real-time.** `enhancedApi.ts:527` is a local in-memory event emitter.
`supabaseService.ts:280` defines a Supabase channel that nothing calls.
No websockets are required.

## Decisions

1. **SQLite file + Node API server.** A browser cannot open a TCP socket to
   a database, so a server is required. SQLite over Postgres: no daemon, no
   Docker, backup is copying one file.
2. **No authentication. Single user.** Login is removed; the app auto-signs-in
   as the seeded `user-1`. Users remain as *data*, so assignees, roles,
   My Tasks and approvals continue to work.

   Concretely: `App.tsx:383-384` currently renders `<AuthPage>` whenever
   `currentUser` is null. That gate and its import are removed, and
   `currentUser` is initialised from `GET /api/users/me`. `components/AuthPage.tsx`
   (671 lines) is then deleted rather than left in place — dead code that reads
   like working authentication is a trap for the next reader. It remains
   recoverable from git history. A "switch user" control is a plausible later
   addition but is out of scope.
3. **The API binds to `127.0.0.1` only.** With auth removed there is nothing
   guarding the API. Note `vite.config.ts:7` sets `host: '0.0.0.0'` with
   `allowedHosts: true`, so the UI is already LAN-reachable; the API must not
   follow it.
4. **RLS is deleted, not ported.** ~95 lines of policy in `supabase-schema.sql`
   exist to scope rows per authenticated user. With no auth there is no
   principal to scope against.

### Known accepted risk

Removing auth means any process that can reach `127.0.0.1:4000` has full
read/write access to all data. Accepted because this is a single-user local
tool. **Adding a second user or exposing the API beyond loopback requires
revisiting decision 2 first** — the existing `authService` credential handling
is not safe to expose (see Appendix).

## Architecture

```
browser (React SPA)
  └─ services/enhancedApi.ts        facade, unchanged signatures
       └─ services/apiClient.ts     NEW typed fetch wrapper
            │  HTTP /api/*
            ▼
       server/ (Node + Express)
         ├─ routes/                 one module per domain
         ├─ db/schema.sql           SQLite DDL
         ├─ db/seed.ts              existing mock arrays as seed
         └─ db/mappers.ts           snake_case <-> camelCase, JSON codec
            │
            ▼
       data/taskflow.db             SQLite file, gitignored
```

Vite dev-proxies `/api` to `127.0.0.1:4000` so the browser sees same-origin.

**Stack:** Express + `better-sqlite3`. `better-sqlite3` is synchronous —
no pool, no async ceremony — which is correct for a single-user local file.

## Schema conversion

**The SQLite schema is derived from `types.ts`, not from `supabase-schema.sql`.**
The committed SQL schema is behind the app's real data model and would silently
drop live fields:

| Entity | Present in `types.ts`, absent from `supabase-schema.sql` |
|---|---|
| `Project` | `sections`, `brief`, `statusUpdates`, `healthStatus`, `isFavorite` |
| `Task` | `projectIds`, `sectionId`, `collaboratorIds`, `blockedBy`, `blocking`, `approval`, `isMilestone`, `subtaskItems`, `recurrence`, `activities` |

`supabase-schema.sql` is a starting point for column names and types only.
`types.ts` is the authority.

Nested object fields (`sections`, `brief`, `statusUpdates`, `subtaskItems`,
`recurrence`, `activities`, `attachments`, `approval`, `customFields`) are stored
as JSON TEXT columns rather than normalised into child tables. They are read and
written whole with their parent, never queried across, so normalising them would
add join complexity and mapping surface for no gain. Revisit only if a feature
needs to query inside them.

Beyond that, Postgres DDL does not port to SQLite unchanged:

| Postgres | SQLite | Columns affected |
|---|---|---|
| `TEXT[]` | JSON string | `members`, `tags`, `dependencies`, `subtasks` |
| `JSONB` | JSON string | `custom_fields`, `attachments` |
| `TIMESTAMPTZ` | ISO-8601 TEXT | all `created_at`, `updated_at`, `due_date` |
| `BOOLEAN` | `INTEGER` 0/1 | `is_active`, `is_template` |
| `UUID DEFAULT gen_random_uuid()` | TEXT, id generated in app | all PKs |
| RLS policies | removed | n/a |

`PRAGMA foreign_keys = ON` must be set per connection; SQLite ignores FK
constraints by default.

### Mapping layer

The database is `snake_case`; `types.ts` is `camelCase`. One `mappers.ts`
module owns that translation plus JSON encode/decode for array and JSONB
columns, and `Date` <-> ISO string conversion. Routes never hand-roll it.

## API surface

Phase 1 replaces these 12 methods:

| Method | Route |
|---|---|
| `getUsers` | `GET /api/users` |
| `getUserById` | `GET /api/users/:uid` |
| `createUser` | `POST /api/users` |
| `updateUser` | `PATCH /api/users/:uid` |
| `deleteUser` | `DELETE /api/users/:uid` |
| `getCurrentUser` | `GET /api/users/me` (always returns seeded `user-1`) |
| `getProjects` | `GET /api/projects` |
| `createProject` | `POST /api/projects` |
| `getTasksForProject` | `GET /api/projects/:id/tasks` |
| `getTasksForUser` | `GET /api/users/:uid/tasks` |
| `createTask` | `POST /api/tasks` |
| `updateTask` | `PATCH /api/tasks/:id` |

`signUp` / `signIn` / `signOut` are deleted, not ported (decision 2).
`subscribeToTasks` is deleted as dead code; the local emitter replaces it.

## Seed data

The existing mock arrays in `enhancedApi.ts` (lines 28-495) become the seed:
the "AOP 2025-26 Enterprise Plan" project and users Ali / Bob / Charlie.
First run therefore looks identical to today — but survives refresh.
Seeding is idempotent: it runs only against an empty database.

## Phasing

Each phase leaves the app runnable. The in-memory fallback for a domain is
deleted only when that domain's routes land.

- **Phase 1 — foundation + core.** Server skeleton, schema, mappers, seed,
  and users/projects/tasks. Retires all 17 Supabase call sites.
- **Phase 2 — new persistence.** comments, time_entries, milestones,
  portfolios, goals. These have never persisted; this is net-new capability,
  not a port.
- **Phase 3 — localStorage consolidation.** Move calendar_events from
  localStorage into SQLite. Notifications, reminders and theme stay in
  localStorage (correctly per-device UI state, not shared data).
- **Phase 4 — removal.** Delete `supabaseService.ts` and `components/AuthPage.tsx`,
  drop `@supabase/supabase-js`, strip login/register from `authService.ts`,
  remove the `AuthPage` gate at `App.tsx:383-384`, replace the Supabase env vars
  in `.env.example` with `VITE_API_URL`, and delete the RLS-bearing
  `supabase-schema.sql` (superseded by `server/db/schema.sql`).

## Testing

The repo has zero tests and zero test dependencies today, despite a 322-line
`QA_METHODOLOGY.md`. Per project standards (80% coverage, tests first):

- Add `vitest` + `supertest`.
- TDD each route module: write the failing route test, then the handler.
- Unit-test `mappers.ts` directly — the JSON/array/date codec is the most
  error-prone surface and the easiest to test in isolation.
- Integration-test against a temp SQLite file per suite, not the dev database.
- Coverage target 80% on `server/`. The pre-existing untested UI is out of scope.

## Out of scope

- Refactoring `enhancedApi.ts` (1706 lines). It stays large; only the
  Supabase branches change.
- Websockets / multi-client sync.
- The unused `GEMINI_API_KEY` in `vite.config.ts`.
- The duplicate `bun.lock` + `package-lock.json`.
- Authentication (explicitly declined; see accepted risk).

## Appendix: why auth could not simply be ported

`authService.ts:10` hashes passwords as
`btoa(password + 'salt').split('').reverse().join('')` — reversible encoding,
not a hash. `authService.ts:69` mints session tokens as
`btoa(JSON.stringify({uid, timestamp}))` — unsigned and forgeable for any uid.

Under Supabase this was inert: Postgres RLS enforced access server-side and
the browser token was decorative. Behind a Node API the token would become the
actual gatekeeper, turning a dormant weakness into a live one. Removing auth
avoids porting the flaw. Reintroducing multi-user means implementing bcrypt and
signed sessions properly — not restoring this code.
