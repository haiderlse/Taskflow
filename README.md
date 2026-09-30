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

## Planning the week

Open `/plan` on Sunday (or any day the week has no outcomes). Carry any of
last week's open outcomes that still matter, then choose up to three for this
week — each needs a definition of done, and a title that reads like an
activity ("Work on…", "Look into…") gets a nudge to say what will exist when
it is finished. A fourth is never added: on `/week`, "Replace an outcome"
asks which one gives up its slot, and why. Progress on each outcome is set by
hand on `/week`. Projects live at `/projects`, work and build kept apart.

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

## Checks

    npm run lint            # TypeScript, strict config (src/, server/, e2e/, root configs)
    npm run test:coverage   # vitest, node + jsdom projects, 80% floor
    npm run test:e2e        # Playwright journeys on a temporary database
