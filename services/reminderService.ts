import { EventOccurrence, Task } from '../types';
import { notificationService } from './notificationService';
import { calendarService, addDays, formatTime, taskToScheduleEntry } from './calendarService';

const FIRED_STORAGE_KEY = 'taskflow_fired_reminders';

/** How long after a reminder's due moment we still consider it worth firing. */
const CATCH_UP_GRACE_MS = 10 * 60 * 1000;

/** Only reminders inside this horizon get a timer; the rest are picked up on the next sync. */
const SCHEDULING_HORIZON_MS = 6 * 60 * 60 * 1000;

/** setTimeout overflows past ~24.8 days, so cap and re-sync instead. */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

export type PermissionState = 'unsupported' | 'default' | 'granted' | 'denied';

interface ScheduledReminder {
  key: string;
  fireAt: Date;
  title: string;
  body: string;
  kind: 'event' | 'task';
  eventId?: string;
  taskId?: string;
  projectId?: string;
  minutesBefore: number;
}

type ReminderListener = (reminder: ScheduledReminder) => void;

class ReminderService {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private fired = new Set<string>();
  private listeners = new Set<ReminderListener>();
  private userId: string | null = null;
  private loaded = false;

  private load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const stored = window.localStorage.getItem(FIRED_STORAGE_KEY);
      if (stored) {
        const entries: Array<[string, number]> = JSON.parse(stored);
        // Drop anything older than a week so the set cannot grow forever.
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
        entries.filter(([, ts]) => ts > cutoff).forEach(([key]) => this.fired.add(key));
        this.firedTimestamps = new Map(entries.filter(([, ts]) => ts > cutoff));
      }
    } catch {
      // Storage unavailable: reminders still fire, they just re-fire after a reload.
    }
  }

  private firedTimestamps = new Map<string, number>();

  private persistFired() {
    try {
      window.localStorage.setItem(
        FIRED_STORAGE_KEY,
        JSON.stringify([...this.firedTimestamps.entries()])
      );
    } catch {
      // Non-fatal.
    }
  }

  // --- Browser permission --- //

  getPermission(): PermissionState {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission as PermissionState;
  }

  async requestPermission(): Promise<PermissionState> {
    if (this.getPermission() === 'unsupported') return 'unsupported';
    try {
      return (await Notification.requestPermission()) as PermissionState;
    } catch {
      return 'denied';
    }
  }

  /** Fires when a reminder goes off, so the UI can raise an in-app banner too. */
  onReminder(listener: ReminderListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Recomputes every pending reminder for the user's meetings and task deadlines.
   * Safe to call on any data change - it clears and rebuilds the timer set.
   */
  sync(userId: string, tasks: Task[] = []) {
    this.load();
    this.userId = userId;

    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();

    const now = new Date();
    const horizonEnd = addDays(now, 2);
    const occurrences = calendarService.getOccurrences(now, horizonEnd, userId);

    const reminders = [
      ...this.eventReminders(occurrences, now),
      ...this.taskReminders(tasks, userId, now),
    ];

    for (const reminder of reminders) {
      if (this.fired.has(reminder.key)) continue;

      const delay = reminder.fireAt.getTime() - Date.now();

      if (delay <= 0) {
        // Missed while the tab was closed: fire now if it is still relevant.
        if (delay > -CATCH_UP_GRACE_MS) this.fire(reminder);
        continue;
      }
      if (delay > SCHEDULING_HORIZON_MS) continue;

      const timer = setTimeout(() => this.fire(reminder), Math.min(delay, MAX_TIMEOUT_MS));
      this.timers.set(reminder.key, timer);
    }
  }

  private eventReminders(occurrences: EventOccurrence[], now: Date): ScheduledReminder[] {
    const out: ScheduledReminder[] = [];

    for (const occ of occurrences) {
      const reminders = occ.event.reminders?.length
        ? occ.event.reminders
        : [{ id: 'default', minutesBefore: 10, channels: ['in_app', 'browser'] as const }];

      for (const reminder of reminders) {
        const fireAt = new Date(occ.start.getTime() - reminder.minutesBefore * 60000);
        if (fireAt.getTime() < now.getTime() - CATCH_UP_GRACE_MS) continue;

        const lead =
          reminder.minutesBefore === 0
            ? 'starting now'
            : reminder.minutesBefore < 60
              ? `in ${reminder.minutesBefore} min`
              : `in ${Math.round(reminder.minutesBefore / 60)}h`;

        const where = occ.event.conferenceLink
          ? 'Online'
          : occ.event.location || '';

        out.push({
          key: `evt:${occ.occurrenceId}:${reminder.minutesBefore}`,
          fireAt,
          title: `${occ.event.title} — ${lead}`,
          body: `${formatTime(occ.start)}${where ? ` · ${where}` : ''}`,
          kind: 'event',
          eventId: occ.event.id,
          projectId: occ.event.projectId,
          minutesBefore: reminder.minutesBefore,
        });
      }
    }

    return out;
  }

  /**
   * Task deadlines get a fixed reminder ladder: a day ahead, an hour ahead, and
   * at the deadline itself for tasks that carry a specific time.
   */
  private taskReminders(tasks: Task[], userId: string, now: Date): ScheduledReminder[] {
    const out: ScheduledReminder[] = [];

    for (const task of tasks) {
      if (task.assigneeId !== userId) continue;
      if (task.status === 'Done' || task.taskStatus === 'completed') continue;
      if (!task.dueDate) continue;

      const entry = taskToScheduleEntry(task);
      if (!entry) continue;

      // A date-only deadline is nudged at 9am on the day; a timed one leads the clock.
      const deadline = task.dueTime
        ? entry.start
        : (() => {
            const d = new Date(task.dueDate as Date);
            d.setHours(9, 0, 0, 0);
            return d;
          })();

      const ladder = task.dueTime ? [24 * 60, 60, 0] : [24 * 60, 0];

      for (const minutesBefore of ladder) {
        const fireAt = new Date(deadline.getTime() - minutesBefore * 60000);
        if (fireAt.getTime() < now.getTime() - CATCH_UP_GRACE_MS) continue;
        if (fireAt.getTime() > now.getTime() + 48 * 60 * 60 * 1000) continue;

        const lead =
          minutesBefore === 0
            ? 'due now'
            : minutesBefore >= 24 * 60
              ? 'due tomorrow'
              : `due in ${minutesBefore} min`;

        out.push({
          key: `task:${task.id}:${deadline.toISOString()}:${minutesBefore}`,
          fireAt,
          title: `${task.title} — ${lead}`,
          body: task.dueTime
            ? `Deadline ${formatTime(deadline)}`
            : `Deadline ${deadline.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
          kind: 'task',
          taskId: task.id,
          projectId: task.projectId,
          minutesBefore,
        });
      }
    }

    return out;
  }

  private fire(reminder: ScheduledReminder) {
    if (this.fired.has(reminder.key)) return;
    this.fired.add(reminder.key);
    this.firedTimestamps.set(reminder.key, Date.now());
    this.persistFired();
    this.timers.delete(reminder.key);

    // 1. In-app inbox entry, so the reminder survives being missed on screen.
    if (this.userId) {
      notificationService.createNotification({
        userId: this.userId,
        type: reminder.kind === 'event' ? 'meeting_reminder' : 'deadline_approaching',
        title: reminder.title,
        message: reminder.body,
        taskId: reminder.taskId,
        projectId: reminder.projectId,
        authorName: 'Planner',
        priority: reminder.minutesBefore <= 15 ? 'high' : 'medium',
        meta: { eventId: reminder.eventId, minutesBefore: reminder.minutesBefore },
      });
    }

    // 2. OS-level notification, which reaches the user on another tab or window.
    if (this.getPermission() === 'granted') {
      try {
        new Notification(reminder.title, {
          body: reminder.body,
          tag: reminder.key,
          requireInteraction: reminder.kind === 'event' && reminder.minutesBefore <= 15,
        });
      } catch {
        // Some browsers reject constructor notifications outside a service worker.
      }
    }

    // 3. In-page listeners (the planner's live banner).
    this.listeners.forEach(l => l(reminder));
  }

  stop() {
    this.timers.forEach(t => clearTimeout(t));
    this.timers.clear();
  }
}

export const reminderService = new ReminderService();
export type { ScheduledReminder };
