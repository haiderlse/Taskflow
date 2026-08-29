import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarEvent,
  EventOccurrence,
  PlannerRange,
  Project,
  ScheduleEntry,
  Task,
  User,
} from '../types';
import type { CalendarSyncState } from '../services/calendarService';
import {
  EVENT_TYPE_LABELS,
  addDays,
  addMinutes,
  bookedMinutes,
  buildSchedule,
  calendarService,
  dateKey,
  endOfDay,
  findFreeSlots,
  formatTime,
  formatTimeRange,
  isSameDay,
  layoutOverlaps,
  minutesFromMidnight,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from '../services/calendarService';
import { reminderService, ScheduledReminder } from '../services/reminderService';
import EventModal from './EventModal';
import {
  BellIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  FlameIcon,
  LinkIcon,
  PlusIcon,
  XIcon,
} from './icons';

interface PlannerPageProps {
  currentUser: User;
  users: User[];
  projects: Project[];
  tasks: Task[];
  onTaskUpdate: (taskId: string, updates: Partial<Task>) => Promise<void> | void;
  onOpenTask?: (task: Task) => void;
}

const HOUR_HEIGHT = 52;          // px per hour on the day/week time grid
const SNAP_MINUTES = 15;
const DEFAULT_BLOCK_MINUTES = 60;
const DAY_START_HOUR = 7;        // where the grid scrolls to on open

const RANGES: Array<{ id: PlannerRange; label: string; hint: string }> = [
  { id: 'day', label: 'Day', hint: 'Plot one day hour by hour' },
  { id: 'week', label: 'Week', hint: 'See the whole week at a glance' },
  { id: 'month', label: 'Month', hint: 'Spot the crunch weeks early' },
  { id: 'agenda', label: 'Agenda', hint: 'Everything ahead, in one list' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const minutesToLabel = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};

const countdownLabel = (target: Date, now: Date) => {
  const diffMin = Math.round((target.getTime() - now.getTime()) / 60000);
  if (diffMin <= 0) return 'now';
  if (diffMin < 60) return `in ${diffMin} min`;
  if (diffMin < 60 * 24) {
    const h = Math.floor(diffMin / 60);
    const m = diffMin % 60;
    return m ? `in ${h}h ${m}m` : `in ${h}h`;
  }
  return `in ${Math.round(diffMin / (60 * 24))}d`;
};

const isTaskDone = (task: Task) => task.status === 'Done' || task.taskStatus === 'completed';

// --- Grid pieces --- //
// These live at module scope on purpose: declaring them inside PlannerPage would
// give React a new component type on every render, remounting the grid (and
// throwing away its scroll position) once a minute as the clock ticks.

const NowLine: React.FC<{ day: Date; now: Date }> = ({ day, now }) => {
  if (!isSameDay(day, now)) return null;
  const top = (minutesFromMidnight(now) / 60) * HOUR_HEIGHT;
  return (
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top }}>
      <div className="relative border-t-2 border-rose-500">
        <span className="absolute -top-1.5 -left-1 w-2.5 h-2.5 rounded-full bg-rose-500" />
      </div>
    </div>
  );
};

const TimedEntry: React.FC<{
  entry: ScheduleEntry;
  column: number;
  columns: number;
  now: Date;
  onOpen: (entry: ScheduleEntry) => void;
}> = ({ entry, column, columns, now, onOpen }) => {
  const startMin = Math.max(0, minutesFromMidnight(entry.start));
  const durationMin = Math.max(15, (entry.end.getTime() - entry.start.getTime()) / 60000);
  const top = (startMin / 60) * HOUR_HEIGHT;
  const height = Math.max(18, (durationMin / 60) * HOUR_HEIGHT - 2);
  const width = 100 / columns;
  const isPast = entry.end < now;
  const done = entry.task ? isTaskDone(entry.task) : false;

  return (
    <button
      onClick={e => { e.stopPropagation(); onOpen(entry); }}
      style={{ top, height, left: `${column * width}%`, width: `calc(${width}% - 4px)` }}
      className={`absolute z-10 text-left rounded-lg px-1.5 py-1 overflow-hidden border-l-4 shadow-sm transition-opacity hover:opacity-100 hover:z-30 ${
        isPast || done ? 'opacity-55' : 'opacity-100'
      } ${entry.kind === 'event'
          ? `${entry.color} border-black/20 text-white`
          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-blue-500 ring-1 ring-slate-200 dark:ring-slate-700'
      }`}
      title={`${entry.title} · ${formatTimeRange(entry.start, entry.end)}`}
    >
      <div className={`text-[11px] font-bold leading-tight truncate ${done ? 'line-through' : ''}`}>
        {entry.kind === 'task' && '☑ '}{entry.title}
      </div>
      {height > 30 && (
        <div className={`text-[10px] leading-tight truncate ${entry.kind === 'event' ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
          {formatTimeRange(entry.start, entry.end)}
        </div>
      )}
      {height > 46 && entry.occurrence?.event.location && (
        <div className="text-[10px] text-white/70 truncate">{entry.occurrence.event.location}</div>
      )}
    </button>
  );
};

const DayColumn: React.FC<{
  day: Date;
  entries: ScheduleEntry[];
  now: Date;
  onOpen: (entry: ScheduleEntry) => void;
  onDropTask: (taskId: string, day: Date, offsetY: number) => void;
  onCreateAt: (day: Date, offsetY: number) => void;
}> = ({ day, entries, now, onOpen, onDropTask, onCreateAt }) => {
  const laid = layoutOverlaps(entries);

  return (
    <div
      className="relative flex-1 border-r border-slate-200 dark:border-slate-800 last:border-r-0"
      style={{ height: 24 * HOUR_HEIGHT }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
      onDrop={e => {
        e.preventDefault();
        const taskId = e.dataTransfer.getData('text/taskId');
        if (!taskId) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onDropTask(taskId, day, e.clientY - rect.top);
      }}
      onClick={e => {
        const rect = e.currentTarget.getBoundingClientRect();
        onCreateAt(day, e.clientY - rect.top);
      }}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className={`border-b border-slate-100 dark:border-slate-800/70 ${
            h < DAY_START_HOUR || h >= 19 ? 'bg-slate-50/60 dark:bg-slate-900/40' : ''
          }`}
          style={{ height: HOUR_HEIGHT }}
        />
      ))}
      <NowLine day={day} now={now} />
      {laid.map(({ entry, column, columns }) => (
        <TimedEntry key={entry.id} entry={entry} column={column} columns={columns} now={now} onOpen={onOpen} />
      ))}
    </div>
  );
};

const AllDayRow: React.FC<{
  days: Date[];
  entriesByDay: Map<string, ScheduleEntry[]>;
  onOpen: (entry: ScheduleEntry) => void;
}> = ({ days, entriesByDay, onOpen }) => {
  const hasAny = days.some(d => (entriesByDay.get(dateKey(d)) || []).some(e => e.isAllDay));
  if (!hasAny) return null;

  return (
    <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
      <div className="w-14 shrink-0 px-1.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        Due
      </div>
      {days.map(day => {
        const allDay = (entriesByDay.get(dateKey(day)) || []).filter(e => e.isAllDay);
        return (
          <div key={dateKey(day)} className="flex-1 min-w-0 px-1 py-1 space-y-0.5 border-l border-slate-200 dark:border-slate-800">
            {allDay.map(entry => (
              <button
                key={entry.id}
                onClick={() => onOpen(entry)}
                draggable={entry.kind === 'task'}
                onDragStart={e => {
                  if (entry.task) e.dataTransfer.setData('text/taskId', entry.task.id);
                }}
                className={`w-full text-left text-[10px] font-semibold px-1.5 py-0.5 rounded truncate border ${
                  entry.task && isTaskDone(entry.task)
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 line-through'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                }`}
                title={entry.title}
              >
                {entry.title}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
};

const TimeGrid: React.FC<{
  days: Date[];
  entriesByDay: Map<string, ScheduleEntry[]>;
  now: Date;
  scrollRef: React.RefObject<HTMLDivElement>;
  onOpen: (entry: ScheduleEntry) => void;
  onDropTask: (taskId: string, day: Date, offsetY: number) => void;
  onCreateAt: (day: Date, offsetY: number) => void;
  onFocusDay: (day: Date) => void;
}> = ({ days, entriesByDay, now, scrollRef, onOpen, onDropTask, onCreateAt, onFocusDay }) => (
  <div className="flex-1 flex flex-col min-h-0 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
    <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="w-14 shrink-0" />
      {days.map(day => {
        const isToday = isSameDay(day, now);
        const booked = bookedMinutes((entriesByDay.get(dateKey(day)) || []).filter(e => e.kind === 'event'));
        return (
          <button
            key={dateKey(day)}
            onClick={() => onFocusDay(day)}
            className="flex-1 min-w-0 px-1 py-2 text-center border-l border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {WEEKDAY_LABELS[day.getDay()]}
            </div>
            <div className={`text-lg font-bold leading-tight ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-slate-800 dark:text-slate-100'}`}>
              {day.getDate()}
            </div>
            {booked > 0 && (
              <div className="text-[9px] font-semibold text-slate-400">{minutesToLabel(booked)} booked</div>
            )}
          </button>
        );
      })}
    </div>

    <AllDayRow days={days} entriesByDay={entriesByDay} onOpen={onOpen} />

    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <div className="flex">
        <div className="w-14 shrink-0">
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              className="text-[10px] font-semibold text-slate-400 text-right pr-2 -translate-y-1.5"
              style={{ height: HOUR_HEIGHT }}
            >
              {h === 0 ? '' : `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`}
            </div>
          ))}
        </div>
        {days.map(day => (
          <DayColumn
            key={dateKey(day)}
            day={day}
            entries={entriesByDay.get(dateKey(day)) || []}
            now={now}
            onOpen={onOpen}
            onDropTask={onDropTask}
            onCreateAt={onCreateAt}
          />
        ))}
      </div>
    </div>
  </div>
);

const PlannerPage: React.FC<PlannerPageProps> = ({
  currentUser,
  users,
  projects,
  tasks,
  onTaskUpdate,
  onOpenTask,
}) => {
  const [range, setRange] = useState<PlannerRange>('week');
  const [anchor, setAnchor] = useState<Date>(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [now, setNow] = useState(new Date());
  const [modalState, setModalState] = useState<
    { mode: 'closed' } | { mode: 'create'; start: Date } | { mode: 'edit'; occurrence: EventOccurrence }
  >({ mode: 'closed' });
  const [liveReminder, setLiveReminder] = useState<ScheduledReminder | null>(null);
  const [permission, setPermission] = useState(reminderService.getPermission());
  const [sync, setSync] = useState<CalendarSyncState>(() => calendarService.getSyncState());
  const [showUnscheduled, setShowUnscheduled] = useState(true);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  const myTasks = useMemo(
    () => tasks.filter(t => t.assigneeId === currentUser.uid),
    [tasks, currentUser.uid]
  );

  // --- Live data wiring --- //

  useEffect(() => calendarService.subscribe(setEvents), []);

  // Points the calendar store at Supabase when the signed-in user can own rows
  // there; it stays on local storage if the project is unreachable.
  useEffect(() => {
    calendarService.connect(currentUser.uid);
  }, [currentUser.uid]);

  useEffect(() => calendarService.onSyncStateChange(setSync), []);

  // A one-minute tick keeps the "now" line, countdowns and urgency states honest.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    reminderService.sync(currentUser.uid, myTasks);
  }, [currentUser.uid, myTasks, events]);

  useEffect(() => reminderService.onReminder(setLiveReminder), []);

  // Scroll the time grid to the working day rather than to midnight.
  useEffect(() => {
    if ((range === 'day' || range === 'week') && gridScrollRef.current) {
      gridScrollRef.current.scrollTop = DAY_START_HOUR * HOUR_HEIGHT;
    }
  }, [range]);

  // --- Visible range --- //

  const { rangeStart, rangeEnd, days, headline } = useMemo(() => {
    switch (range) {
      case 'day': {
        const start = startOfDay(anchor);
        return {
          rangeStart: start,
          rangeEnd: endOfDay(anchor),
          days: [start],
          headline: anchor.toLocaleDateString(undefined, {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          }),
        };
      }
      case 'week': {
        const start = startOfWeek(anchor);
        const weekDays = Array.from({ length: 7 }, (_, i) => addDays(start, i));
        const end = endOfDay(weekDays[6]);
        const sameMonth = start.getMonth() === weekDays[6].getMonth();
        return {
          rangeStart: start,
          rangeEnd: end,
          days: weekDays,
          headline: sameMonth
            ? `${start.toLocaleDateString(undefined, { month: 'long' })} ${start.getDate()} – ${weekDays[6].getDate()}, ${start.getFullYear()}`
            : `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${weekDays[6].getFullYear()}`,
        };
      }
      case 'month': {
        const gridStart = startOfWeek(startOfMonth(anchor));
        const monthDays = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
        return {
          rangeStart: gridStart,
          rangeEnd: endOfDay(monthDays[41]),
          days: monthDays,
          headline: anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        };
      }
      default: {
        const start = startOfDay(anchor);
        const agendaDays = Array.from({ length: 30 }, (_, i) => addDays(start, i));
        return {
          rangeStart: start,
          rangeEnd: endOfDay(agendaDays[29]),
          days: agendaDays,
          headline: `Next 30 days from ${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
        };
      }
    }
  }, [range, anchor]);

  const occurrences = useMemo(
    () => calendarService.getOccurrences(rangeStart, rangeEnd, currentUser.uid),
    // `events` is the change signal: the service holds the data, not this component.
    [rangeStart, rangeEnd, currentUser.uid, events]
  );

  const schedule = useMemo(
    () => buildSchedule(occurrences, myTasks, rangeStart, rangeEnd),
    [occurrences, myTasks, rangeStart, rangeEnd]
  );

  const entriesByDay = useMemo(() => {
    const map = new Map<string, ScheduleEntry[]>();
    for (const day of days) map.set(dateKey(day), []);
    for (const entry of schedule) {
      // An all-day entry can span days; put it on every day it touches inside the range.
      let cursor = startOfDay(entry.start);
      const last = startOfDay(entry.end);
      while (cursor <= last) {
        const key = dateKey(cursor);
        if (map.has(key)) map.get(key)!.push(entry);
        cursor = addDays(cursor, 1);
      }
    }
    return map;
  }, [schedule, days]);

  // --- Header summary numbers --- //

  const nextUp = useMemo(() => calendarService.getNextOccurrence(now, currentUser.uid), [now, currentUser.uid, events]);

  const overdueTasks = useMemo(
    () => myTasks.filter(t => !isTaskDone(t) && t.dueDate && endOfDay(new Date(t.dueDate)) < now),
    [myTasks, now]
  );

  const dueTodayTasks = useMemo(
    () => myTasks.filter(t => !isTaskDone(t) && t.dueDate && isSameDay(new Date(t.dueDate), now)),
    [myTasks, now]
  );

  /**
   * Tasks that need a home on the calendar: due inside the visible range (or already
   * overdue) and not yet given a work block. This is the "plot my day" queue.
   */
  const unscheduled = useMemo(() => {
    return myTasks
      .filter(t => !isTaskDone(t) && !t.scheduledStart)
      .filter(t => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due <= rangeEnd;
      })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
  }, [myTasks, rangeEnd]);

  // --- Actions --- //

  const shift = (direction: -1 | 1) => {
    setAnchor(prev => {
      switch (range) {
        case 'day': return addDays(prev, direction);
        case 'week': return addDays(prev, 7 * direction);
        case 'month': {
          const next = new Date(prev);
          next.setDate(1);
          next.setMonth(next.getMonth() + direction);
          return next;
        }
        default: return addDays(prev, 7 * direction);
      }
    });
  };

  const enableBrowserAlerts = async () => {
    const result = await reminderService.requestPermission();
    setPermission(result);
    if (result === 'granted') reminderService.sync(currentUser.uid, myTasks);
  };

  /** Turns a vertical pixel offset inside a day column into a snapped time. */
  const timeFromOffset = (day: Date, offsetY: number): Date => {
    const rawMinutes = (offsetY / HOUR_HEIGHT) * 60;
    const snapped = Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    const clamped = Math.max(0, Math.min(snapped, 24 * 60 - SNAP_MINUTES));
    return addMinutes(startOfDay(day), clamped);
  };

  const scheduleTaskAt = useCallback(
    async (taskId: string, start: Date) => {
      const task = myTasks.find(t => t.id === taskId);
      const duration = task?.estimatedTime || DEFAULT_BLOCK_MINUTES;
      await onTaskUpdate(taskId, { scheduledStart: start, scheduledEnd: addMinutes(start, duration) });
    },
    [myTasks, onTaskUpdate]
  );

  const clearTaskBlock = useCallback(
    async (taskId: string) => {
      await onTaskUpdate(taskId, { scheduledStart: null, scheduledEnd: null });
    },
    [onTaskUpdate]
  );

  const openEntry = (entry: ScheduleEntry) => {
    if (entry.kind === 'event' && entry.occurrence) {
      setModalState({ mode: 'edit', occurrence: entry.occurrence });
    } else if (entry.task) {
      onOpenTask?.(entry.task);
    }
  };

  // --- Shared pieces --- //

  const RangeSwitcher = (
    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
      {RANGES.map(r => (
        <button
          key={r.id}
          onClick={() => setRange(r.id)}
          title={r.hint}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            range === r.id
              ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );

  const MonthGrid = (
    <div className="flex-1 flex flex-col min-h-0 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
        {WEEKDAY_LABELS.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {d}
          </div>
        ))}
      </div>
      <div className="flex-1 grid grid-cols-7 grid-rows-6 overflow-y-auto">
        {days.map(day => {
          const entries = entriesByDay.get(dateKey(day)) || [];
          const inMonth = day.getMonth() === anchor.getMonth();
          const isToday = isSameDay(day, now);
          const booked = bookedMinutes(entries.filter(e => e.kind === 'event'));

          return (
            <div
              key={dateKey(day)}
              onDragOver={e => { e.preventDefault(); }}
              onDrop={async e => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/taskId');
                if (taskId) await scheduleTaskAt(taskId, addMinutes(startOfDay(day), 9 * 60));
              }}
              className={`border-b border-r border-slate-200 dark:border-slate-800 p-1.5 flex flex-col min-h-[92px] ${
                inMonth ? 'bg-white dark:bg-slate-950' : 'bg-slate-50/60 dark:bg-slate-900/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={() => { setAnchor(day); setRange('day'); }}
                  className={`text-xs font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                    isToday
                      ? 'bg-blue-600 text-white'
                      : inMonth ? 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800' : 'text-slate-400'
                  }`}
                >
                  {day.getDate()}
                </button>
                {booked > 0 && (
                  <span className="text-[9px] font-bold text-slate-400">{minutesToLabel(booked)}</span>
                )}
              </div>
              <div className="flex-1 space-y-0.5 overflow-hidden">
                {entries.slice(0, 3).map(entry => (
                  <button
                    key={entry.id}
                    onClick={() => openEntry(entry)}
                    className={`w-full flex items-center space-x-1 text-left text-[10px] font-semibold px-1 py-0.5 rounded truncate ${
                      entry.kind === 'event'
                        ? `${entry.color} text-white`
                        : entry.task && isTaskDone(entry.task)
                          ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 line-through'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                    title={`${entry.title}${entry.isAllDay ? '' : ` · ${formatTime(entry.start)}`}`}
                  >
                    {!entry.isAllDay && (
                      <span className={entry.kind === 'event' ? 'text-white/75' : 'text-slate-400'}>
                        {entry.start.getHours()}
                        {entry.start.getMinutes() ? `:${String(entry.start.getMinutes()).padStart(2, '0')}` : ''}
                      </span>
                    )}
                    <span className="truncate">{entry.title}</span>
                  </button>
                ))}
                {entries.length > 3 && (
                  <button
                    onClick={() => { setAnchor(day); setRange('day'); }}
                    className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    +{entries.length - 3} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const AgendaList = (
    <div className="flex-1 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 divide-y divide-slate-100 dark:divide-slate-800">
      {days
        .map(day => ({ day, entries: entriesByDay.get(dateKey(day)) || [] }))
        .filter(({ entries }) => entries.length > 0)
        .map(({ day, entries }) => (
          <div key={dateKey(day)} className="flex">
            <div className="w-24 shrink-0 px-3 py-3 bg-slate-50/70 dark:bg-slate-900/50">
              <div className={`text-[10px] font-bold uppercase tracking-wider ${isSameDay(day, now) ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`}>
                {isSameDay(day, now) ? 'Today' : WEEKDAY_LABELS[day.getDay()]}
              </div>
              <div className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-tight">{day.getDate()}</div>
              <div className="text-[10px] font-semibold text-slate-400">
                {day.toLocaleDateString(undefined, { month: 'short' })}
              </div>
            </div>
            <div className="flex-1 py-2 px-3 space-y-1.5">
              {entries.map(entry => (
                <button
                  key={entry.id}
                  onClick={() => openEntry(entry)}
                  className="w-full flex items-center space-x-3 text-left px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
                >
                  <span className={`w-1.5 h-8 rounded-full shrink-0 ${entry.color}`} />
                  <span className="w-36 shrink-0 whitespace-nowrap text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    {entry.isAllDay ? 'All day' : formatTimeRange(entry.start, entry.end)}
                  </span>
                  <span className={`flex-1 text-sm font-semibold truncate ${
                    entry.task && isTaskDone(entry.task)
                      ? 'text-slate-400 line-through'
                      : 'text-slate-800 dark:text-slate-100'
                  }`}>
                    {entry.title}
                  </span>
                  {entry.occurrence?.event.conferenceLink && (
                    <LinkIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  )}
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                    {entry.kind === 'event' ? EVENT_TYPE_LABELS[entry.occurrence!.event.type] : 'Task'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      {schedule.length === 0 && (
        <div className="p-10 text-center text-sm text-slate-400">
          Nothing scheduled in this window. Add an event or give a task a due date.
        </div>
      )}
    </div>
  );

  const freeSlots = useMemo(() => {
    if (range !== 'day') return [];
    return findFreeSlots(anchor, entriesByDay.get(dateKey(anchor)) || [], 30);
  }, [range, anchor, entriesByDay]);

  // --- Render --- //

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Live reminder banner */}
      {liveReminder && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-amber-500 text-white shadow-sm">
          <div className="flex items-center space-x-2.5 min-w-0">
            <BellIcon className="w-4 h-4 shrink-0" />
            <span className="font-bold text-sm truncate">{liveReminder.title}</span>
            <span className="text-xs text-white/80 truncate">{liveReminder.body}</span>
          </div>
          <button onClick={() => setLiveReminder(null)} className="p-1 rounded hover:bg-white/20 shrink-0">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="px-5 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <CalendarIcon className="w-5 h-5 text-blue-600 shrink-0" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{headline}</h1>
            <div className="flex items-center space-x-0.5">
              <button onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setAnchor(new Date())}
                className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Today
              </button>
              <button onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {RangeSwitcher}
            <button
              onClick={() => setModalState({ mode: 'create', start: addMinutes(startOfDay(anchor), 9 * 60) })}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>New event</span>
            </button>
          </div>
        </div>

        {/* Status strip: next meeting + what is at risk */}
        <div className="flex flex-wrap items-center gap-2">
          {nextUp ? (
            <button
              onClick={() => setModalState({ mode: 'edit', occurrence: nextUp })}
              className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 transition-colors"
            >
              <ClockIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">Up next: {nextUp.event.title}</span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {formatTime(nextUp.start)} · {countdownLabel(nextUp.start, now)}
              </span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-500">
              No meetings in the next 30 days
            </span>
          )}

          {nextUp?.event.conferenceLink && (
            <a
              href={nextUp.event.conferenceLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Join</span>
            </a>
          )}

          {overdueTasks.length > 0 && (
            <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs font-bold text-rose-700 dark:text-rose-300">
              <FlameIcon className="w-3.5 h-3.5" />
              <span>{overdueTasks.length} overdue</span>
            </span>
          )}

          <span className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300">
            <CheckCircleIcon className="w-3.5 h-3.5" />
            <span>{dueTodayTasks.length} due today</span>
          </span>

          <span
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold ${
              sync.error
                ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
                : sync.backend === 'supabase'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}
            title={
              sync.error
                ? `Calendar is saving locally only: ${sync.error}`
                : sync.backend === 'supabase'
                  ? 'Events sync to Supabase and across your devices'
                  : 'Events are saved in this browser only. Configure Supabase to sync across devices.'
            }
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              sync.error ? 'bg-rose-500' : sync.backend === 'supabase' ? 'bg-emerald-500' : 'bg-slate-400'
            }`} />
            <span>{sync.backend === 'supabase' ? 'Synced' : 'This browser only'}</span>
          </span>

          {permission !== 'granted' && (
            <button
              onClick={enableBrowserAlerts}
              disabled={permission === 'unsupported' || permission === 'denied'}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs font-bold text-amber-800 dark:text-amber-300 hover:border-amber-500 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              title={
                permission === 'denied'
                  ? 'Blocked in your browser settings — re-enable notifications for this site'
                  : 'Get alerted even when this tab is in the background'
              }
            >
              <BellIcon className="w-3.5 h-3.5" />
              <span>
                {permission === 'denied' ? 'Alerts blocked by browser'
                  : permission === 'unsupported' ? 'Alerts unsupported'
                  : 'Turn on meeting alerts'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 p-4 gap-4">
        {/* Unscheduled rail */}
        {showUnscheduled && (range === 'day' || range === 'week' || range === 'month') && (
          <aside className="w-60 shrink-0 flex flex-col border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-950 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-xs font-bold text-slate-800 dark:text-slate-100">Needs a slot</h2>
                <p className="text-[10px] text-slate-400 font-medium">Drag onto the grid to block time</p>
              </div>
              <button
                onClick={() => setShowUnscheduled(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                title="Hide panel"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {unscheduled.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6 px-2">
                  Every task with a deadline in view has time blocked. Nice.
                </p>
              )}
              {unscheduled.map(task => {
                const due = new Date(task.dueDate!);
                const isOverdue = endOfDay(due) < now;
                const project = projects.find(p => p.id === task.projectId);
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={e => e.dataTransfer.setData('text/taskId', task.id)}
                    onClick={() => onOpenTask?.(task)}
                    className={`px-2.5 py-2 rounded-lg border cursor-grab active:cursor-grabbing transition-colors ${
                      isOverdue
                        ? 'border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:border-rose-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug line-clamp-2">
                      {task.title}
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className={`text-[10px] font-bold ${isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'}`}>
                        {isOverdue ? 'Overdue · ' : ''}
                        {due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                      {project && (
                        <span className="flex items-center space-x-1 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${project.color || 'bg-blue-500'}`} />
                          <span className="text-[10px] text-slate-400 truncate max-w-[90px]">{project.name}</span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Free slots on the day being planned */}
            {range === 'day' && (
              <div className="border-t border-slate-200 dark:border-slate-800 p-2.5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Open slots (9–6)
                </h3>
                {freeSlots.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Fully booked.</p>
                ) : (
                  <div className="space-y-1">
                    {freeSlots.slice(0, 4).map((slot, i) => (
                      <div key={i} className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        <span>{formatTimeRange(slot.start, slot.end)}</span>
                        <span className="text-slate-400">
                          {minutesToLabel((slot.end.getTime() - slot.start.getTime()) / 60000)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </aside>
        )}

        {!showUnscheduled && range !== 'agenda' && (
          <button
            onClick={() => setShowUnscheduled(true)}
            className="self-start px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            title="Show unscheduled tasks"
          >
            ☰
          </button>
        )}

        {/* Main view */}
        {(range === 'day' || range === 'week') && (
          <TimeGrid
            days={days}
            entriesByDay={entriesByDay}
            now={now}
            scrollRef={gridScrollRef}
            onOpen={openEntry}
            onDropTask={(taskId, day, offsetY) => scheduleTaskAt(taskId, timeFromOffset(day, offsetY))}
            onCreateAt={(day, offsetY) => setModalState({ mode: 'create', start: timeFromOffset(day, offsetY) })}
            onFocusDay={day => { setAnchor(day); setRange('day'); }}
          />
        )}
        {range === 'month' && MonthGrid}
        {range === 'agenda' && AgendaList}
      </div>

      {/* Scheduled-task quick controls for the day in focus */}
      {range === 'day' && (
        <ScheduledTaskStrip
          entries={(entriesByDay.get(dateKey(anchor)) || []).filter(e => e.kind === 'task' && !e.isAllDay)}
          onClear={clearTaskBlock}
        />
      )}

      {modalState.mode !== 'closed' && (
        <EventModal
          occurrence={modalState.mode === 'edit' ? modalState.occurrence : null}
          defaultStart={modalState.mode === 'create' ? modalState.start : undefined}
          currentUser={currentUser}
          users={users}
          projects={projects}
          onClose={() => setModalState({ mode: 'closed' })}
          onSaved={() => setModalState({ mode: 'closed' })}
          onDeleted={() => setModalState({ mode: 'closed' })}
        />
      )}
    </div>
  );
};

/** Footer strip listing the day's time-blocked tasks, with a one-click unblock. */
const ScheduledTaskStrip: React.FC<{
  entries: ScheduleEntry[];
  onClear: (taskId: string) => void;
}> = ({ entries, onClear }) => {
  if (entries.length === 0) return null;
  return (
    <div className="px-4 pb-3 flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time blocked</span>
      {entries.map(entry => (
        <span
          key={entry.id}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-200"
        >
          <span>{formatTime(entry.start)}</span>
          <span className="truncate max-w-[180px]">{entry.title}</span>
          <button
            onClick={() => entry.task && onClear(entry.task.id)}
            className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
            title="Remove this time block"
          >
            <XIcon className="w-3 h-3" />
          </button>
        </span>
      ))}
    </div>
  );
};

export default PlannerPage;
