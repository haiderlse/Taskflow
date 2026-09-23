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
