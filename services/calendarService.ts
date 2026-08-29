import {
  CalendarEvent,
  EventOccurrence,
  EventRecurrence,
  EventType,
  Task,
  ScheduleEntry,
} from '../types';
import { supabaseService } from './supabaseService';

const EVENTS_STORAGE_KEY = 'taskflow_calendar_events';

type CalendarListener = (events: CalendarEvent[]) => void;

/** Where events are being read from and written to, for display in the UI. */
export type CalendarBackend = 'local' | 'supabase';

export interface CalendarSyncState {
  backend: CalendarBackend;
  /** Set when a remote write or the initial remote load failed. */
  error: string | null;
}

type SyncListener = (state: CalendarSyncState) => void;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `calendar_events.owner_id` is a UUID referencing `users(uid)`, and the RLS
 * policies compare it against `auth.uid()`. Demo users have ids like `user-1`,
 * so they can never satisfy either constraint and must stay on local storage.
 */
const isRealAuthUser = (userId: string | null): boolean => !!userId && UUID_RE.test(userId);

// --- Date helpers (exported: the planner UI needs the same maths) --- //

export const startOfDay = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
};

export const endOfDay = (d: Date): Date => {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
};

export const addDays = (d: Date, days: number): Date => {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
};

export const addMinutes = (d: Date, minutes: number): Date =>
  new Date(d.getTime() + minutes * 60000);

/** Sunday-based start of the week containing `d`. */
export const startOfWeek = (d: Date): Date => startOfDay(addDays(d, -d.getDay()));

export const startOfMonth = (d: Date): Date =>
  startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));

export const endOfMonth = (d: Date): Date =>
  endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));

export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Local `yyyy-mm-dd` key. Never use toISOString() here: it shifts by timezone. */
export const dateKey = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Minutes from midnight, used to position an entry on the day/week time grid. */
export const minutesFromMidnight = (d: Date): number => d.getHours() * 60 + d.getMinutes();

export const formatTime = (d: Date): string =>
  d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export const formatTimeRange = (start: Date, end: Date): string =>
  `${formatTime(start)} – ${formatTime(end)}`;

/** Combines a calendar day with a 'HH:mm' string into a Date. */
export const withTime = (day: Date, time: string): Date => {
  const [h, m] = time.split(':').map(Number);
  const out = new Date(day);
  out.setHours(h || 0, m || 0, 0, 0);
  return out;
};

/** 'HH:mm' for an <input type="time"> value. */
export const toTimeInput = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const EVENT_TYPE_COLORS: Record<EventType, string> = {
  meeting: 'bg-indigo-500',
  focus: 'bg-emerald-500',
  reminder: 'bg-amber-500',
  deadline: 'bg-rose-500',
  out_of_office: 'bg-slate-400',
  personal: 'bg-purple-500',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  meeting: 'Meeting',
  focus: 'Focus block',
  reminder: 'Reminder',
  deadline: 'Deadline',
  out_of_office: 'Out of office',
  personal: 'Personal',
};

const uid = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Restores Date instances lost to JSON round-tripping. */
const reviveEvent = (raw: any): CalendarEvent => ({
  ...raw,
  start: new Date(raw.start),
  end: new Date(raw.end),
  createdAt: new Date(raw.createdAt),
  updatedAt: new Date(raw.updatedAt),
  attendees: raw.attendees || [],
  reminders: raw.reminders || [],
  exceptions: raw.exceptions || [],
  recurrence: raw.recurrence
    ? { ...raw.recurrence, until: raw.recurrence.until ? new Date(raw.recurrence.until) : null }
    : null,
});

/**
 * Demo meetings anchored to the current week, so a fresh workspace always has a
 * populated calendar to look at instead of an empty grid.
 */
const seedEvents = (ownerId: string): CalendarEvent[] => {
  const monday = addDays(startOfWeek(new Date()), 1);
  const now = new Date();

  const make = (
    dayOffset: number,
    time: string,
    durationMin: number,
    title: string,
    type: EventType,
    extra: Partial<CalendarEvent> = {}
  ): CalendarEvent => {
    const start = withTime(addDays(monday, dayOffset), time);
    return {
      id: uid('evt'),
      title,
      type,
      ownerId,
      start,
      end: addMinutes(start, durationMin),
      isAllDay: false,
      attendees: [],
      reminders: [{ id: uid('rem'), minutesBefore: 10, channels: ['in_app', 'browser'] }],
      recurrence: null,
      exceptions: [],
      status: 'confirmed',
      color: EVENT_TYPE_COLORS[type],
      createdAt: now,
      updatedAt: now,
      ...extra,
    };
  };

  return [
    make(0, '09:30', 30, 'Weekly planning', 'meeting', {
      description: 'Set the week: priorities, blockers, capacity.',
      conferenceLink: 'https://meet.example.com/weekly-planning',
      recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1], until: null },
      reminders: [{ id: uid('rem'), minutesBefore: 15, channels: ['in_app', 'browser'] }],
    }),
    make(0, '14:00', 90, 'Deep work: AOP financial model', 'focus'),
    make(1, '11:00', 60, 'Stakeholder review', 'meeting', {
      location: 'Boardroom 2',
      reminders: [{ id: uid('rem'), minutesBefore: 30, channels: ['in_app', 'browser'] }],
    }),
    make(2, '09:00', 15, 'Daily standup', 'meeting', {
      conferenceLink: 'https://meet.example.com/standup',
      recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [1, 2, 3, 4, 5], until: null },
      reminders: [{ id: uid('rem'), minutesBefore: 5, channels: ['in_app', 'browser'] }],
    }),
    make(3, '15:30', 60, '1:1 with Bob', 'meeting'),
    make(4, '16:00', 45, 'Week retro & next-week plan', 'meeting', {
      recurrence: { frequency: 'weekly', interval: 1, daysOfWeek: [5], until: null },
    }),
  ];
};

/**
 * Holds every event in memory so the planner can read synchronously while it
 * renders, and mirrors that cache to whichever backend is active:
 *
 *  - `supabase` once `connect()` is called with a real Supabase Auth user, with
 *    a realtime subscription keeping other devices in step.
 *  - `local` otherwise (Supabase unconfigured, or a demo login whose id is not a
 *    UUID and so can never satisfy the table's FK or its RLS policies).
 *
 * Writes apply to the cache first and persist afterwards, so the UI never waits
 * on the network; a failed remote write rolls the cache back and rethrows.
 */
class CalendarService {
  private events: CalendarEvent[] = [];
  private listeners: Set<CalendarListener> = new Set();
  private syncListeners: Set<SyncListener> = new Set();
  private loaded = false;
  private backend: CalendarBackend = 'local';
  private ownerId: string | null = null;
  private error: string | null = null;
  private unsubscribeRemote: (() => void) | null = null;
  private connecting: Promise<void> | null = null;

  // --- Backend selection --- //

  /**
   * Points the store at Supabase when the signed-in user can actually own rows
   * there, otherwise leaves it on local storage. Idempotent per user.
   */
  connect(ownerId: string): Promise<void> {
    if (this.ownerId === ownerId && this.connecting) return this.connecting;
    if (this.ownerId === ownerId && this.backend === 'supabase') return Promise.resolve();

    this.ownerId = ownerId;
    this.connecting = this.doConnect(ownerId);
    return this.connecting;
  }

  private async doConnect(ownerId: string): Promise<void> {
    if (!supabaseService.available || !isRealAuthUser(ownerId)) {
      this.setBackend('local', null);
      this.load();
      return;
    }

    try {
      const remote = await supabaseService.getCalendarEvents();
      this.events = remote;
      this.loaded = true;
      this.setBackend('supabase', null);
      this.emit();

      this.unsubscribeRemote?.();
      this.unsubscribeRemote = supabaseService.subscribeToCalendarEvents(events => {
        this.events = events;
        this.emit();
      });
    } catch (err: any) {
      // A misconfigured project or a missing table must not take the page down:
      // fall back to local storage and surface why in the UI.
      console.warn('Calendar: Supabase unavailable, using local storage.', err);
      this.setBackend('local', err?.message || 'Could not reach Supabase');
      this.load();
    }
  }

  private setBackend(backend: CalendarBackend, error: string | null) {
    this.backend = backend;
    this.error = error;
    const state = this.getSyncState();
    this.syncListeners.forEach(l => l(state));
  }

  getSyncState(): CalendarSyncState {
    return { backend: this.backend, error: this.error };
  }

  onSyncStateChange(listener: SyncListener): () => void {
    this.syncListeners.add(listener);
    listener(this.getSyncState());
    return () => {
      this.syncListeners.delete(listener);
    };
  }

  /**
   * Tears down on sign-out. The cache is dropped as well: it may hold another
   * account's remote rows, which must not be visible to - or mirrored into local
   * storage by - whoever signs in next.
   */
  disconnect() {
    this.unsubscribeRemote?.();
    this.unsubscribeRemote = null;
    this.connecting = null;
    this.ownerId = null;
    this.events = [];
    this.loaded = false;
    this.setBackend('local', null);
    this.emit();
  }

  // --- Local persistence --- //

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const stored = typeof window !== 'undefined'
        ? window.localStorage.getItem(EVENTS_STORAGE_KEY)
        : null;
      if (stored) {
        this.events = JSON.parse(stored).map(reviveEvent);
        return;
      }
    } catch {
      // Corrupt or unavailable storage: fall through to the seed set.
    }
    this.events = seedEvents(this.ownerId || 'user-1');
    this.persist();
  }

  private persist() {
    // Supabase is the system of record when connected; skip the local mirror so
    // a stale copy cannot resurrect deleted rows on the next local session.
    if (this.backend === 'supabase') return;
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(this.events));
      }
    } catch {
      // Storage can be unavailable (private mode / sandboxed iframe). Stay in-memory.
    }
  }

  private emit() {
    const snapshot = [...this.events];
    this.listeners.forEach(l => l(snapshot));
  }

  /** Restores the cache and tells subscribers, after a remote write failed. */
  private rollback(previous: CalendarEvent[], err: any): never {
    this.events = previous;
    this.emit();
    this.setBackend(this.backend, err?.message || 'Calendar write failed');
    throw err;
  }

  // --- Reads (synchronous, served from cache) --- //

  subscribe(listener: CalendarListener): () => void {
    this.load();
    this.listeners.add(listener);
    listener([...this.events]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEvents(): CalendarEvent[] {
    this.load();
    return [...this.events];
  }

  getEventById(id: string): CalendarEvent | undefined {
    this.load();
    return this.events.find(e => e.id === id);
  }

  // --- Writes (optimistic, then persisted) --- //

  async createEvent(
    input: Partial<CalendarEvent> & { title: string; start: Date; end: Date; ownerId: string }
  ): Promise<CalendarEvent> {
    this.load();
    const now = new Date();
    const type = input.type || 'meeting';
    const event: CalendarEvent = {
      id: uid('evt'),
      description: '',
      isAllDay: false,
      attendees: [],
      reminders: [{ id: uid('rem'), minutesBefore: 10, channels: ['in_app', 'browser'] }],
      recurrence: null,
      exceptions: [],
      status: 'confirmed',
      color: EVENT_TYPE_COLORS[type],
      ...input,
      type,
      createdAt: now,
      updatedAt: now,
    };

    const previous = this.events;
    this.events = [...this.events, event];
    this.emit();

    if (this.backend === 'supabase') {
      try {
        const saved = await supabaseService.createCalendarEvent(event);
        this.events = this.events.map(e => (e.id === event.id ? saved : e));
        this.emit();
        return saved;
      } catch (err) {
        this.rollback(previous, err);
      }
    }

    this.persist();
    return event;
  }

  async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
    this.load();
    const previous = this.events;
    let updated: CalendarEvent | undefined;

    this.events = this.events.map(e => {
      if (e.id !== id) return e;
      updated = { ...e, ...updates, id: e.id, updatedAt: new Date() };
      return updated;
    });
    if (!updated) return undefined;
    this.emit();

    if (this.backend === 'supabase') {
      try {
        const saved = await supabaseService.updateCalendarEvent(id, updates);
        this.events = this.events.map(e => (e.id === id ? saved : e));
        this.emit();
        return saved;
      } catch (err) {
        this.rollback(previous, err);
      }
    }

    this.persist();
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    this.load();
    const previous = this.events;
    this.events = this.events.filter(e => e.id !== id);
    this.emit();

    if (this.backend === 'supabase') {
      try {
        await supabaseService.deleteCalendarEvent(id);
        return;
      } catch (err) {
        this.rollback(previous, err);
      }
    }

    this.persist();
  }

  /** Removes a single occurrence of a recurring series, keeping the rest intact. */
  async deleteOccurrence(eventId: string, occurrenceStart: Date): Promise<void> {
    const event = this.getEventById(eventId);
    if (!event) return;
    if (!event.recurrence) {
      await this.deleteEvent(eventId);
      return;
    }
    const exceptions = [...(event.exceptions || []), dateKey(occurrenceStart)];
    await this.updateEvent(eventId, { exceptions });
  }

  /**
   * Materialises every occurrence that overlaps [rangeStart, rangeEnd].
   * Non-recurring events yield at most one; recurring ones are walked forward
   * from their series start with a hard iteration cap as a runaway guard.
   */
  getOccurrences(rangeStart: Date, rangeEnd: Date, ownerId?: string): EventOccurrence[] {
    this.load();
    const out: EventOccurrence[] = [];

    for (const event of this.events) {
      if (event.status === 'cancelled') continue;
      if (ownerId && event.ownerId !== ownerId && !event.attendees.some(a => a.userId === ownerId)) {
        continue;
      }

      const durationMs = event.end.getTime() - event.start.getTime();

      if (!event.recurrence) {
        if (event.end >= rangeStart && event.start <= rangeEnd) {
          out.push({
            occurrenceId: `${event.id}::${event.start.toISOString()}`,
            event,
            start: new Date(event.start),
            end: new Date(event.end),
            isRecurringInstance: false,
          });
        }
        continue;
      }

      for (const start of this.expandRecurrence(event, rangeStart, rangeEnd)) {
        const end = new Date(start.getTime() + durationMs);
        out.push({
          occurrenceId: `${event.id}::${start.toISOString()}`,
          event,
          start,
          end,
          isRecurringInstance: true,
        });
      }
    }

    return out.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  private expandRecurrence(event: CalendarEvent, rangeStart: Date, rangeEnd: Date): Date[] {
    const rule = event.recurrence as EventRecurrence;
    const results: Date[] = [];
    const exceptions = new Set(event.exceptions || []);
    const seriesEnd = rule.until ? endOfDay(new Date(rule.until)) : null;
    const interval = Math.max(1, rule.interval || 1);
    const durationMs = event.end.getTime() - event.start.getTime();

    // 10k iterations covers ~27 years of a daily rule; well past any realistic view.
    const MAX_ITERATIONS = 10000;
    let emitted = 0;
    let cursor = new Date(event.start);

    const push = (d: Date) => {
      if (exceptions.has(dateKey(d))) return;
      if (d.getTime() + durationMs < rangeStart.getTime()) return;
      if (d > rangeEnd) return;
      results.push(new Date(d));
    };

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (seriesEnd && cursor > seriesEnd) break;
      if (rule.count && emitted >= rule.count) break;
      if (cursor > rangeEnd) break;

      if (rule.frequency === 'weekly' && rule.daysOfWeek && rule.daysOfWeek.length > 0) {
        // Emit each selected weekday inside the current week, then jump `interval` weeks.
        const weekStart = startOfWeek(cursor);
        for (const dow of [...rule.daysOfWeek].sort((a, b) => a - b)) {
          const candidate = withTime(addDays(weekStart, dow), toTimeInput(event.start));
          if (candidate < event.start) continue;
          if (seriesEnd && candidate > seriesEnd) continue;
          if (rule.count && emitted >= rule.count) break;
          emitted++;
          push(candidate);
        }
        cursor = addDays(weekStart, 7 * interval);
        cursor.setHours(event.start.getHours(), event.start.getMinutes(), 0, 0);
        continue;
      }

      emitted++;
      push(cursor);

      const next = new Date(cursor);
      switch (rule.frequency) {
        case 'daily':
          next.setDate(next.getDate() + interval);
          break;
        case 'weekly':
          next.setDate(next.getDate() + 7 * interval);
          break;
        case 'monthly':
          next.setMonth(next.getMonth() + interval);
          break;
        case 'yearly':
          next.setFullYear(next.getFullYear() + interval);
          break;
      }
      cursor = next;
    }

    return results.sort((a, b) => a.getTime() - b.getTime());
  }

  /** The next occurrence starting after `from`, across all of the user's events. */
  getNextOccurrence(from: Date, ownerId?: string): EventOccurrence | null {
    const horizon = addDays(from, 30);
    const upcoming = this.getOccurrences(from, horizon, ownerId).filter(o => o.start > from);
    return upcoming[0] || null;
  }

  /**
   * Clears stored events and reseeds. Local-mode only: it must never wipe rows
   * that live in Supabase.
   */
  reset(ownerId = 'user-1') {
    if (this.backend === 'supabase') return;
    this.events = seedEvents(ownerId);
    this.persist();
    this.emit();
  }
}

export const calendarService = new CalendarService();

// --- Turning tasks + events into a single schedule --- //

const PRIORITY_TASK_COLORS: Record<string, string> = {
  critical: 'bg-rose-600',
  high: 'bg-orange-500',
  medium: 'bg-blue-500',
  low: 'bg-slate-500',
};

/**
 * A task lands on the time grid when it has an explicit work block; otherwise it
 * lands on its due date - timed if `dueTime` is set, all-day if not.
 */
export const taskToScheduleEntry = (task: Task): ScheduleEntry | null => {
  const color = PRIORITY_TASK_COLORS[task.priority] || 'bg-blue-500';

  if (task.scheduledStart) {
    const start = new Date(task.scheduledStart);
    const end = task.scheduledEnd
      ? new Date(task.scheduledEnd)
      : addMinutes(start, task.estimatedTime || 60);
    return { id: `task-${task.id}`, kind: 'task', title: task.title, start, end, isAllDay: false, task, color };
  }

  if (!task.dueDate) return null;

  const due = new Date(task.dueDate);
  if (task.dueTime) {
    const start = withTime(due, task.dueTime);
    return {
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title,
      start,
      end: addMinutes(start, task.estimatedTime || 30),
      isAllDay: false,
      task,
      color,
    };
  }

  return {
    id: `task-${task.id}`,
    kind: 'task',
    title: task.title,
    start: startOfDay(due),
    end: endOfDay(due),
    isAllDay: true,
    task,
    color,
  };
};

export const occurrenceToScheduleEntry = (occ: EventOccurrence): ScheduleEntry => ({
  id: occ.occurrenceId,
  kind: 'event',
  title: occ.event.title,
  start: occ.start,
  end: occ.end,
  isAllDay: occ.event.isAllDay,
  occurrence: occ,
  color: occ.event.color || EVENT_TYPE_COLORS[occ.event.type],
});

/** Merged, time-ordered schedule for a date range. */
export const buildSchedule = (
  occurrences: EventOccurrence[],
  tasks: Task[],
  rangeStart: Date,
  rangeEnd: Date
): ScheduleEntry[] => {
  const entries: ScheduleEntry[] = occurrences.map(occurrenceToScheduleEntry);

  for (const task of tasks) {
    const entry = taskToScheduleEntry(task);
    if (entry && entry.end >= rangeStart && entry.start <= rangeEnd) {
      entries.push(entry);
    }
  }

  return entries.sort((a, b) => {
    if (a.isAllDay !== b.isAllDay) return a.isAllDay ? -1 : 1;
    return a.start.getTime() - b.start.getTime();
  });
};

/**
 * Assigns overlapping timed entries to side-by-side columns so nothing is hidden
 * behind anything else on the day/week grid.
 */
export const layoutOverlaps = (
  entries: ScheduleEntry[]
): Array<{ entry: ScheduleEntry; column: number; columns: number }> => {
  const timed = entries.filter(e => !e.isAllDay).sort((a, b) => a.start.getTime() - b.start.getTime());
  const out: Array<{ entry: ScheduleEntry; column: number; columns: number }> = [];

  let cluster: ScheduleEntry[] = [];
  let clusterEnd = 0;

  const flushCluster = () => {
    if (cluster.length === 0) return;
    const columnEnds: number[] = [];
    const assigned = cluster.map(entry => {
      let col = columnEnds.findIndex(end => end <= entry.start.getTime());
      if (col === -1) {
        col = columnEnds.length;
        columnEnds.push(0);
      }
      columnEnds[col] = entry.end.getTime();
      return { entry, column: col };
    });
    const columns = columnEnds.length;
    assigned.forEach(a => out.push({ ...a, columns }));
    cluster = [];
    clusterEnd = 0;
  };

  for (const entry of timed) {
    if (cluster.length > 0 && entry.start.getTime() >= clusterEnd) flushCluster();
    cluster.push(entry);
    clusterEnd = Math.max(clusterEnd, entry.end.getTime());
  }
  flushCluster();

  return out;
};

/** Total minutes of timed meetings on a given day - the "how booked am I" number. */
export const bookedMinutes = (entries: ScheduleEntry[]): number =>
  entries
    .filter(e => !e.isAllDay)
    .reduce((sum, e) => sum + Math.max(0, (e.end.getTime() - e.start.getTime()) / 60000), 0);

/** Gaps of at least `minMinutes` between `dayStartHour` and `dayEndHour`. */
export const findFreeSlots = (
  day: Date,
  entries: ScheduleEntry[],
  minMinutes = 30,
  dayStartHour = 9,
  dayEndHour = 18
): Array<{ start: Date; end: Date }> => {
  const windowStart = withTime(day, `${String(dayStartHour).padStart(2, '0')}:00`);
  const windowEnd = withTime(day, `${String(dayEndHour).padStart(2, '0')}:00`);

  const busy = entries
    .filter(e => !e.isAllDay && e.end > windowStart && e.start < windowEnd)
    .map(e => ({
      start: new Date(Math.max(e.start.getTime(), windowStart.getTime())),
      end: new Date(Math.min(e.end.getTime(), windowEnd.getTime())),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const slots: Array<{ start: Date; end: Date }> = [];
  let cursor = windowStart;

  for (const block of busy) {
    if (block.start.getTime() - cursor.getTime() >= minMinutes * 60000) {
      slots.push({ start: new Date(cursor), end: new Date(block.start) });
    }
    if (block.end > cursor) cursor = block.end;
  }

  if (windowEnd.getTime() - cursor.getTime() >= minMinutes * 60000) {
    slots.push({ start: new Date(cursor), end: new Date(windowEnd) });
  }

  return slots;
};
