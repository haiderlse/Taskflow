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

## Capturing

Press `c` on any screen, or type into the bar at the bottom of Today. On the
phone, open `/capture` (add it to the home screen: it ships a web-app
manifest). A capture always lands in the Inbox, never on Today. Process the
Inbox with the keys `T` (this week), `L` (later), `D` (delegate), `S`
(schedule), `P` (project) and `X` (delete an accidental capture); `j`/`k`
move the selection.

## Checks

    npm run lint            # TypeScript, strict config (src/, server/, e2e/, root configs)
    npm run test:coverage   # vitest, node + jsdom projects, 80% floor
    npm run test:e2e        # Playwright journeys on a temporary database
