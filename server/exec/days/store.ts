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

/** Replaces the day's secondaries (spec B, PUT /days/:date/slots). An inbox or later task chosen for today is processed onto it. */
export function setDaySlots(db: Database.Database, date: string, taskIds: string[], now: string, weekStartDay: number): DayView {
  db.transaction(() => {
    const tasks = checkedTasks(db, taskIds);
    db.prepare('INSERT INTO days (date, created_at, updated_at) VALUES (?, ?, ?) ON CONFLICT (date) DO NOTHING').run(date, now, now);
    db.prepare('DELETE FROM day_slots WHERE date = ?').run(date);
    const insert = db.prepare('INSERT INTO day_slots (date, slot, task_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)');
    tasks.forEach((task, index) => {
      insert.run(date, index + 1, task.id, now, now);
      if (task.status === 'inbox' || task.status === 'later') patchTask(db, task.id, { status: 'this_week', scheduledDate: date }, now);
    });
  }).immediate();
  return getDayView(db, date, weekStartDay);
}
