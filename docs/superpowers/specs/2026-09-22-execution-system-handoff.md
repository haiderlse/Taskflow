# Personal Execution System — Product Handoff

**Author:** Ali Haider
**Date:** 2026-09-22
**Status:** Requirements source for `2026-09-22-execution-system-design.md`. Section numbers (§) below are cited from the design spec and the implementation plan.

## 1. Objective

Build a personal productivity application around a deliberately constrained execution system.

This is NOT intended to become another generic task manager.

The application should help me answer four questions:

1. What are the three outcomes that matter this week?
2. What must I ship at work tomorrow?
3. When am I actually going to work on it?
4. At the end of the week, what shipped, what slipped, and why?

The system should actively prevent task overload rather than encourage me to create increasingly large lists.

## 2. Core Philosophy

The hierarchy is:

Outcome → Must Ship → Deep Work → Tasks → Review

The application should optimize for completed outcomes, not number of tasks completed.

Important principles:

- Maximum 3 weekly outcomes.
- Maximum 1 Must Ship per workday.
- Maximum 2 secondary priorities per day.
- Must Ship should describe a completed output, not an activity.
- Deep work happens before normal office activity begins.
- Reactive work should not dominate the planning system.
- New tasks can be captured without automatically becoming commitments.
- Unfinished work must be consciously rolled forward, delegated, scheduled, or killed.
- Personal projects and office work must remain visibly separated.
- The system should reduce cognitive load.

## 3. My Default Schedule

Typical weekday:

- 06:00 — Wake up
- 07:30–08:00 — Kids' school drop
- ~08:15 — Leave for office
- ~08:35 — Arrive office
- 08:35–10:05 — Protected 90-minute Deep Work session
- 10:05 onward — Normal office day begins: email, WhatsApp, approvals, meetings, suppliers, team management, commercial issues, etc.
- ~17:00–17:30 — Shutdown / tomorrow planning
- ~17:30 — Leave office where practical
- ~18:00 onward — Family/personal time
- 22:00 — Sleep

The exact times should eventually be configurable.

## 4. Weekly Planning

The planning week begins with a Sunday review/planning session of approximately 20 minutes.

The user must choose:

### Three Weekly Outcomes

Hard limit: 3

These are outcomes, not task lists.

Example:

BAD: Work on supplier meetings.

GOOD: Complete September supplier delivery plan with confirmed delivery dates for top 20 suppliers.

BAD: Work on Pinkbox.

GOOD: Complete the P&L dashboard using live franchise data.

Each outcome should contain:

- title
- description
- category
- definition of done
- target date
- status
- linked tasks
- linked deep-work sessions
- notes

Suggested categories:

- Office
- Business/Venture
- Career/AI
- Personal

Allow custom categories eventually.

## 5. Calendar Commitment

After selecting the three outcomes, the application should ask:

"When will you actually work on these?"

The user should assign deep-work blocks to outcomes.

The product philosophy is:

If an outcome has no time allocated to it, it is probably an aspiration rather than a commitment.

Show the available week visually.

The application should eventually support calendar integration, but initial versions can maintain an internal schedule.

## 6. Daily Planning

Daily planning happens before leaving the office.

The application asks:

### Tomorrow's Must Ship

Only ONE allowed.

Prompt:

What must exist by the end of tomorrow's deep-work session that does not exist today?

Must Ship should preferably be connected to one of the week's three outcomes.

Example:

Weekly outcome: September supplier delivery plan confirmed.

Tomorrow's Must Ship: Complete supplier-wise delivery tracker for the top 20 suppliers and send it to the commercial team.

## 7. Secondary Priorities

Allow a maximum of TWO secondary priorities.

Daily structure:

- MUST SHIP — 1 item
- SECONDARY — Maximum 2 items
- REACTIVE — Not planned individually unless necessary.

This means the visible daily commitment should generally contain no more than three meaningful items.

## 8. Deep Work Mode

This should become one of the most important parts of the application.

Default office Deep Work: 08:35–10:05. Duration: 90 minutes.

When Deep Work begins, provide a focused screen containing only:

- Must Ship
- Definition of Done
- Related notes/files/links
- Timer
- Finish / Progress controls

Do NOT display the full task backlog during Deep Work.

The interface should communicate: This is the only thing that matters right now.

Possible controls: Start Deep Work · Pause · Completed · Made Progress · Blocked

If blocked, immediately capture:

- What is blocking this?
- Who owns the unblock?
- What is the next action?

## 9. Definition of Done

Every Must Ship should ideally have a clear completion condition.

Example:

Must Ship: Complete September purchase target analysis.

Definition of Done: Supplier-wise gap calculated, top gaps identified, required buying calculated, and file shared with team.

The application should flag vague Must Ships.

For example, "Work on procurement" should trigger something like:

This sounds like an activity rather than an output. What will exist when this is finished?

Do not make this annoying. It should be lightweight coaching.

## 10. Capture Inbox

There must be a frictionless capture mechanism.

During the day I may receive: CEO requests, supplier issues, team requests, ideas, follow-ups, WhatsApp requests, project ideas, personal ideas.

These go into: INBOX

Critical principle: Capture ≠ Commitment

Adding something to Inbox must NOT automatically put it into Today.

Inbox items should later be processed into:

- This Week
- Later
- Delegated
- Scheduled
- Project
- Delete

## 11. Delegation

Delegation is especially important because I manage teams.

Any task should optionally contain:

- owner
- due date
- expected output
- status
- follow-up date

Possible states: Mine · Delegated · Waiting · Done · Cancelled

The system should distinguish things I must DO from things I must ENSURE happen.

These should not appear identically on my personal workload.

## 12. Shutdown Routine

At approximately 17:00–17:30, provide a short Shutdown flow.

Questions:

1. What shipped today? Automatically show today's Must Ship. Choose: Shipped · Partial · Missed · Blocked
2. What remains open? Show secondary items and important captured items. Actions: Tomorrow · Schedule · Delegate · Later · Kill
3. What is tomorrow's Must Ship? Require selection/creation.
4. What are tomorrow's two secondary priorities? Optional but maximum two.

Then display: Tomorrow is ready.

This should create psychological closure for the workday.

## 13. Friday Review

Every Friday provide a ~15-minute review.

Start with the three weekly outcomes. For each: DONE · PARTIAL · MISSED

Then ask: Why?

Use structured reasons where possible:

- insufficient time
- unexpected urgent work
- dependency/blocker
- poor estimation
- too many meetings
- priority changed
- procrastination
- unclear outcome
- delegated dependency
- no longer important
- other

Then ask: Roll forward / Reschedule / Delegate / Kill?

## 14. Weekly Scoreboard

Create a simple execution scoreboard.

Example:

Week 39 · Weekly Outcomes: 2 / 3 shipped · Must Ships: 4 / 5 shipped · Deep Work: 6h 45m · Rolled Forward: 3 · Killed: 4 · Delegated: 8

Do NOT gamify this excessively. The purpose is pattern recognition.

## 15. Execution Analytics

Over time, the system should answer useful questions:

- What percentage of weekly outcomes do I complete?
- How often does my Must Ship get completed?
- Which weekdays have the highest execution rate?
- How much planned deep work actually happens?
- Why does work slip?
- How many tasks am I carrying forward repeatedly?
- How much work am I delegating?
- Which projects consume my time?
- Am I planning more than I can realistically execute?

Eventually surface observations such as: "Your completion rate drops significantly when you schedule more than 4 major commitments in a week." or "Supplier meetings were responsible for 38% of deep-work interruptions this month."

Insights should be based on actual recorded data, not generic productivity advice.

## 16. Work vs Personal

The system should maintain clear contexts.

WORK: DVAGO-related responsibilities. The daily Must Ship discussed above belongs primarily here.

PERSONAL / BUILD: Pinkbox, Healify, AI projects, career development, other ventures.

Personal projects should not compete visually with office Must Ship during the workday.

They can have their own Build Blocks. Example: Tuesday 06:30–07:20 — Build · Thursday 06:30–07:20 — Build · Saturday — longer Build session. These should be configurable.

## 17. Projects

Tasks and outcomes can belong to Projects.

Example — Project: DVAGO September Supply Plan · Outcome: Confirm September supplier delivery plan · Must Ships: Analyze open POs, Complete supplier tracker, Confirm delivery dates, Identify supply risks, Publish final plan · Tasks exist underneath these.

This hierarchy is important: PROJECT → OUTCOME → MUST SHIP → TASK

Do not force every small task to belong to all levels.

## 18. Main Screens

Keep navigation extremely small.

Suggested primary navigation:

- TODAY — Must Ship, Deep Work, Secondary 2, Delegated/waiting alerts, quick capture
- WEEK — 3 outcomes, progress, scheduled deep-work blocks
- INBOX — Everything captured but not processed
- PROJECTS — Longer-running work
- REVIEW — Daily/weekly execution history and analytics

Avoid adding unnecessary navigation.

## 19. Today Screen

This is probably the most important screen.

Example:

```
Tuesday

MUST SHIP
Finalize September supplier delivery plan
Deep Work 08:35–10:05
[ START DEEP WORK ]

SECONDARY
□ Review Haleon purchase target
□ Approve corporate pricing

WAITING
3 delegated items require follow-up

+ Capture
```

That is enough. Do not turn Today into a 25-item task list.

## 20. Weekly Screen

```
WEEK 39

OUTCOME 1 — WORK
September supplier delivery plan confirmed
████████░░ 80%

OUTCOME 2 — WORK
Haleon purchase target finalized
██████░░░░ 60%

OUTCOME 3 — BUILD
Pinkbox P&L dashboard working with live data
████░░░░░░ 40%
```

Below this: Deep Work Calendar. Then: Waiting / Delegated.

## 21. UX Philosophy

The interface should feel: calm, minimal, executive, deliberate, low cognitive load.

It should NOT feel like: Jira, ClickUp, a project-management suite, an infinite Todoist list, a habit-tracking game.

The application should intentionally hide information that is irrelevant to the current execution context.

When I open it at 08:35, I should immediately know: This is what I need to finish.

## 22. AI Layer — Later Phase

Once the basic system works reliably, add an AI planning assistant.

The AI should NOT simply generate more tasks. Its job should primarily be constraint enforcement and planning quality.

Examples: "Work on Haleon." → "What specific output should exist when this is complete?" · A fourth weekly outcome → "You already have three weekly outcomes. Which existing outcome should this replace?" · Repeated roll-forward → "This has been rolled forward three times. Should we schedule dedicated time, delegate it, redefine it, or kill it?" · Overloaded tomorrow → "Tomorrow already contains a Must Ship and two secondary priorities. Should this replace one of them?"

The AI should protect focus rather than expand scope.

## 23. Notifications

Keep notifications minimal.

- 08:30 — Deep Work begins in 5 minutes.
- 17:00 — Close the day and choose tomorrow's Must Ship.
- Friday — Weekly review — 15 minutes.
- Sunday — Choose the three outcomes that make this week successful.

Avoid constant task reminders.

## 24. MVP

Do NOT build everything immediately. MVP should prove the core behavioral loop.

MVP V1 — Build:

1. Weekly outcomes — maximum 3
2. Daily Must Ship — maximum 1
3. Secondary priorities — maximum 2
4. 90-minute Deep Work session
5. Inbox capture
6. Basic delegation
7. Daily shutdown
8. Friday review
9. Simple weekly scoreboard
10. Local persistence/database

Do NOT initially build: complicated AI, team collaboration, advanced analytics, email integration, WhatsApp integration, complex project management, elaborate gamification.

First prove that the core system makes me execute better.

## 25. Important Product Constraint

Whenever considering a new feature, ask: Does this help the user decide, execute, delegate, or review?

If the answer is no, strongly consider not building it.

Complexity is itself a failure mode for this product.

## 26. Claude Code Instructions

Before writing production code:

- Stage 1 — Understand. Read this entire handoff. Summarize back: the behavioral system, the product philosophy, primary entities, primary user flows, constraints, assumptions. Do NOT code yet.
- Stage 2 — Inspect. If an existing repository exists, inspect the entire relevant codebase. Document: framework, architecture, database, authentication, state management, existing features, reusable components, technical debt, anything conflicting with this product model. Do not unnecessarily rebuild working infrastructure.
- Stage 3 — Design. Propose: information architecture, data model, state model, screen hierarchy, component architecture, MVP scope, implementation sequence. Explicitly identify anything you recommend NOT building yet.
- Stage 4 — Plan. Break implementation into small testable phases. For each phase specify: objective, files/components affected, database changes, acceptance criteria, tests. Do not begin a giant implementation in one pass.
- Stage 5 — Build. Implement one phase at a time. After each phase: run the application, run relevant tests, inspect errors, fix regressions, compare implementation against acceptance criteria, report what changed.
- Stage 6 — Product Review. After MVP works, evaluate it from the user's perspective. Simulate: Sunday planning → Monday planning → Monday deep work → interruptions/capture → delegation → shutdown → Friday review. Identify friction, unnecessary complexity, missing states and UX problems. Then recommend improvements before expanding scope.

## 27. Ultimate Product Test

The application succeeds if I can open it on a Tuesday morning and, within approximately five seconds, understand:

- What matters this week.
- What I must ship today.
- What I should work on right now.

And at 17:00 I can confidently close the application knowing: what happened today and what matters tomorrow.

Build around that experience.
