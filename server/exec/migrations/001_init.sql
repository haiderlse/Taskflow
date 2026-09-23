-- Execution system, schema version 1. Derived from
-- docs/superpowers/specs/2026-09-22-execution-system-design.md, section B.
-- Never edit this file after it has shipped; add 002_*.sql instead.

CREATE TABLE settings (
  id                INTEGER PRIMARY KEY CHECK (id = 1),
  timezone          TEXT    NOT NULL DEFAULT 'Asia/Karachi',
  week_start_day    INTEGER NOT NULL DEFAULT 0 CHECK (week_start_day BETWEEN 0 AND 6),
  work_days         TEXT    NOT NULL DEFAULT '[1,2,3,4,5]',
  deep_work_start   TEXT    NOT NULL DEFAULT '08:35',
  deep_work_minutes INTEGER NOT NULL DEFAULT 90 CHECK (deep_work_minutes > 0),
  shutdown_time     TEXT    NOT NULL DEFAULT '17:00',
  office_start      TEXT    NOT NULL DEFAULT '08:15',
  office_end        TEXT    NOT NULL DEFAULT '18:00',
  build_blocks      TEXT    NOT NULL DEFAULT '[{"weekday":2,"start":"06:30","minutes":50},{"weekday":4,"start":"06:30","minutes":50},{"weekday":6,"start":"09:00","minutes":180}]',
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL
) STRICT;

INSERT INTO settings (id, created_at, updated_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE projects (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  context    TEXT NOT NULL CHECK (context IN ('work', 'build')),
  status     TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
  notes      TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TABLE weeks (
  id           TEXT PRIMARY KEY,
  start_date   TEXT NOT NULL UNIQUE,
  reviewed_at  TEXT,
  review_notes TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
) STRICT;

CREATE TABLE outcomes (
  id                 TEXT PRIMARY KEY,
  week_id            TEXT    NOT NULL REFERENCES weeks(id),
  slot               INTEGER CHECK (slot IN (1, 2, 3)),
  title              TEXT    NOT NULL,
  description        TEXT    NOT NULL DEFAULT '',
  category           TEXT    NOT NULL CHECK (category IN ('office', 'business', 'career', 'personal')),
  definition_of_done TEXT    NOT NULL DEFAULT '',
  target_date        TEXT,
  project_id         TEXT    REFERENCES projects(id),
  progress           INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status             TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'killed')),
  review_grade       TEXT    CHECK (review_grade IN ('done', 'partial', 'missed')),
  review_reason      TEXT    CHECK (review_reason IN (
                       'insufficient_time', 'unexpected_urgent_work', 'dependency_blocker', 'poor_estimation',
                       'too_many_meetings', 'priority_changed', 'procrastination', 'unclear_outcome',
                       'delegated_dependency', 'no_longer_important', 'other')),
  review_disposition TEXT    CHECK (review_disposition IN ('roll_forward', 'reschedule', 'delegate', 'kill')),
  rolled_from_id     TEXT    REFERENCES outcomes(id),
  notes              TEXT    NOT NULL DEFAULT '',
  closed_at          TEXT,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  UNIQUE (week_id, slot),
  -- A killed outcome frees its slot; every other outcome holds one.
  CHECK ((status = 'killed') = (slot IS NULL))
) STRICT;

CREATE INDEX idx_outcomes_week ON outcomes(week_id);

CREATE TABLE must_ships (
  id                  TEXT PRIMARY KEY,
  title               TEXT    NOT NULL,
  definition_of_done  TEXT    NOT NULL DEFAULT '',
  context             TEXT    NOT NULL CHECK (context IN ('work', 'build')),
  date                TEXT,
  outcome_id          TEXT    REFERENCES outcomes(id),
  project_id          TEXT    REFERENCES projects(id),
  status              TEXT    NOT NULL DEFAULT 'planned'
                        CHECK (status IN ('planned', 'shipped', 'partial', 'missed', 'blocked', 'killed')),
  blocker_what        TEXT,
  blocker_owner       TEXT,
  blocker_next_action TEXT,
  notes               TEXT    NOT NULL DEFAULT '',
  rolled_from_id      TEXT    REFERENCES must_ships(id),
  roll_count          INTEGER NOT NULL DEFAULT 0,
  closed_at           TEXT,
  created_at          TEXT    NOT NULL,
  updated_at          TEXT    NOT NULL,
  -- NULL dates are distinct to UNIQUE, so undated candidates are unlimited.
  UNIQUE (date, context)
) STRICT;

CREATE INDEX idx_must_ships_date ON must_ships(date);

CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT    NOT NULL,
  notes           TEXT    NOT NULL DEFAULT '',
  context         TEXT    NOT NULL CHECK (context IN ('work', 'build')),
  status          TEXT    NOT NULL DEFAULT 'inbox'
                    CHECK (status IN ('inbox', 'this_week', 'later', 'delegated', 'waiting', 'done', 'killed')),
  project_id      TEXT    REFERENCES projects(id),
  outcome_id      TEXT    REFERENCES outcomes(id),
  must_ship_id    TEXT    REFERENCES must_ships(id),
  scheduled_date  TEXT,
  due_date        TEXT,
  owner_name      TEXT,
  expected_output TEXT,
  follow_up_date  TEXT,
  roll_count      INTEGER NOT NULL DEFAULT 0,
  rolled_at       TEXT,
  captured_at     TEXT    NOT NULL,
  processed_at    TEXT,
  delegated_at    TEXT,
  closed_at       TEXT,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL
) STRICT;

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_scheduled_date ON tasks(scheduled_date);
CREATE INDEX idx_tasks_follow_up_date ON tasks(follow_up_date);

CREATE TABLE days (
  date        TEXT PRIMARY KEY,
  shutdown_at TEXT,
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
) STRICT;

CREATE TABLE day_slots (
  date       TEXT    NOT NULL REFERENCES days(date) ON DELETE CASCADE,
  slot       INTEGER NOT NULL CHECK (slot IN (1, 2)),
  task_id    TEXT    NOT NULL REFERENCES tasks(id),
  created_at TEXT    NOT NULL,
  PRIMARY KEY (date, slot),
  UNIQUE (date, task_id)
) STRICT;

CREATE TABLE deep_work_blocks (
  id               TEXT PRIMARY KEY,
  date             TEXT    NOT NULL,
  context          TEXT    NOT NULL CHECK (context IN ('work', 'build')),
  planned_start    TEXT    NOT NULL,
  planned_minutes  INTEGER NOT NULL CHECK (planned_minutes > 0),
  outcome_id       TEXT    REFERENCES outcomes(id),
  must_ship_id     TEXT    REFERENCES must_ships(id),
  started_at       TEXT,
  ended_at         TEXT,
  paused_seconds   INTEGER NOT NULL DEFAULT 0,
  pause_started_at TEXT,
  result           TEXT    CHECK (result IN ('completed', 'progress', 'blocked', 'abandoned')),
  notes            TEXT    NOT NULL DEFAULT '',
  created_at       TEXT    NOT NULL,
  updated_at       TEXT    NOT NULL,
  CHECK (ended_at IS NULL OR started_at IS NOT NULL)
) STRICT;

CREATE INDEX idx_deep_work_blocks_date ON deep_work_blocks(date);
