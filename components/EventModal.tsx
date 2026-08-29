import React, { useMemo, useState } from 'react';
import { CalendarEvent, EventOccurrence, EventReminder, EventType, Project, User } from '../types';
import {
  calendarService,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_LABELS,
  addMinutes,
  dateKey,
  toTimeInput,
  withTime,
} from '../services/calendarService';
import { XIcon, TrashIcon, CalendarIcon, ClockIcon, LinkIcon, UsersIcon, BellIcon } from './icons';

interface EventModalProps {
  /** Editing an existing occurrence, or creating from a clicked slot. */
  occurrence?: EventOccurrence | null;
  defaultStart?: Date;
  defaultDurationMinutes?: number;
  currentUser: User;
  users: User[];
  projects: Project[];
  onClose: () => void;
  onSaved: (event: CalendarEvent) => void;
  onDeleted?: (eventId: string) => void;
}

const REMINDER_CHOICES = [
  { minutes: 0, label: 'At start time' },
  { minutes: 5, label: '5 minutes before' },
  { minutes: 10, label: '10 minutes before' },
  { minutes: 15, label: '15 minutes before' },
  { minutes: 30, label: '30 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 24 * 60, label: '1 day before' },
];

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const EventModal: React.FC<EventModalProps> = ({
  occurrence,
  defaultStart,
  defaultDurationMinutes = 30,
  currentUser,
  users,
  projects,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const existing = occurrence?.event;
  const isEditing = Boolean(existing);

  const initialStart = occurrence?.start || defaultStart || new Date();
  const initialEnd = occurrence?.end || addMinutes(initialStart, defaultDurationMinutes);

  const [title, setTitle] = useState(existing?.title || '');
  const [description, setDescription] = useState(existing?.description || '');
  const [type, setType] = useState<EventType>(existing?.type || 'meeting');
  const [day, setDay] = useState(dateKey(initialStart));
  const [startTime, setStartTime] = useState(toTimeInput(initialStart));
  const [endTime, setEndTime] = useState(toTimeInput(initialEnd));
  const [isAllDay, setIsAllDay] = useState(existing?.isAllDay || false);
  const [location, setLocation] = useState(existing?.location || '');
  const [conferenceLink, setConferenceLink] = useState(existing?.conferenceLink || '');
  const [projectId, setProjectId] = useState(existing?.projectId || '');
  const [attendeeIds, setAttendeeIds] = useState<string[]>(
    existing?.attendees.map(a => a.userId).filter(Boolean) as string[] || []
  );
  const [reminderMinutes, setReminderMinutes] = useState<number[]>(
    existing?.reminders.map(r => r.minutesBefore) ?? [10]
  );
  const [repeats, setRepeats] = useState<boolean>(Boolean(existing?.recurrence));
  const [frequency, setFrequency] = useState(existing?.recurrence?.frequency || 'weekly');
  const [interval, setInterval] = useState(existing?.recurrence?.interval || 1);
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(
    existing?.recurrence?.daysOfWeek || [initialStart.getDay()]
  );
  const [until, setUntil] = useState(
    existing?.recurrence?.until ? dateKey(new Date(existing.recurrence.until)) : ''
  );
  const [error, setError] = useState<string | null>(null);

  const durationLabel = useMemo(() => {
    if (isAllDay) return 'All day';
    const start = withTime(new Date(`${day}T00:00:00`), startTime);
    const end = withTime(new Date(`${day}T00:00:00`), endTime);
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    if (mins <= 0) return 'End must be after start';
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }, [day, startTime, endTime, isAllDay]);

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter(v => v !== value) : [...list, value];

  const handleSave = () => {
    if (!title.trim()) {
      setError('Give the event a title.');
      return;
    }

    const baseDay = new Date(`${day}T00:00:00`);
    const start = isAllDay ? withTime(baseDay, '00:00') : withTime(baseDay, startTime);
    const end = isAllDay ? withTime(baseDay, '23:59') : withTime(baseDay, endTime);

    if (end <= start) {
      setError('End time must be after the start time.');
      return;
    }

    const reminders: EventReminder[] = reminderMinutes
      .sort((a, b) => b - a)
      .map(minutesBefore => ({
        id: `rem-${minutesBefore}-${Math.random().toString(36).slice(2, 6)}`,
        minutesBefore,
        channels: ['in_app', 'browser'],
      }));

    const attendees = attendeeIds.map(uid => {
      const user = users.find(u => u.uid === uid);
      const previous = existing?.attendees.find(a => a.userId === uid);
      return {
        userId: uid,
        email: user?.email,
        name: user?.displayName || 'Teammate',
        response: previous?.response || ('no_response' as const),
      };
    });

    const recurrence = repeats
      ? {
          frequency: frequency as 'daily' | 'weekly' | 'monthly' | 'yearly',
          interval: Math.max(1, Number(interval) || 1),
          daysOfWeek: frequency === 'weekly' ? daysOfWeek : undefined,
          until: until ? new Date(`${until}T23:59:59`) : null,
        }
      : null;

    const payload = {
      title: title.trim(),
      description,
      type,
      start,
      end,
      isAllDay,
      location: location.trim() || undefined,
      conferenceLink: conferenceLink.trim() || undefined,
      projectId: projectId || undefined,
      attendees,
      reminders,
      recurrence,
      color: EVENT_TYPE_COLORS[type],
      ownerId: existing?.ownerId || currentUser.uid,
    };

    const saved = existing
      ? calendarService.updateEvent(existing.id, payload)
      : calendarService.createEvent(payload);

    if (saved) onSaved(saved);
    onClose();
  };

  const handleDelete = (scope: 'occurrence' | 'series') => {
    if (!existing) return;
    if (scope === 'series' || !existing.recurrence) {
      calendarService.deleteEvent(existing.id);
    } else if (occurrence) {
      calendarService.deleteOccurrence(existing.id, occurrence.start);
    }
    onDeleted?.(existing.id);
    onClose();
  };

  const fieldBase = 'px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500';
  const field = `w-full ${fieldBase}`;
  // Inline inputs sit side by side, so they need a base without the full-width
  // utility: Tailwind resolves conflicting width classes by stylesheet order,
  // not by the order they appear in the class attribute.
  const inlineField = fieldBase;
  const label = 'block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2.5">
            <span className={`w-2.5 h-2.5 rounded-full ${EVENT_TYPE_COLORS[type]}`} />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              {isEditing ? 'Edit event' : 'New event'}
            </h2>
            {existing?.recurrence && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                Repeating
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <input
            autoFocus
            value={title}
            onChange={e => { setTitle(e.target.value); setError(null); }}
            placeholder="What is this event?"
            className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-base font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {/* Type */}
          <div>
            <span className={label}>Type</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(EVENT_TYPE_LABELS) as EventType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    type === t
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${EVENT_TYPE_COLORS[t]}`} />
                  <span>{EVENT_TYPE_LABELS[t]}</span>
                </button>
              ))}
            </div>
          </div>

          {/* When */}
          <div>
            <span className={label}><CalendarIcon className="w-3 h-3 inline mr-1" />When</span>
            <div className="flex flex-wrap items-center gap-2">
              <input type="date" value={day} onChange={e => setDay(e.target.value)} className={inlineField} />
              {!isAllDay && (
                <>
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inlineField} />
                  <span className="text-slate-400 text-sm">to</span>
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inlineField} />
                </>
              )}
              <label className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="rounded" />
                <span>All day</span>
              </label>
              <span className="text-xs text-slate-400 font-medium flex items-center">
                <ClockIcon className="w-3 h-3 mr-1" />{durationLabel}
              </span>
            </div>
          </div>

          {/* Repeat */}
          <div>
            <label className="flex items-center space-x-2 mb-2 cursor-pointer">
              <input type="checkbox" checked={repeats} onChange={e => setRepeats(e.target.checked)} className="rounded" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Repeats</span>
            </label>
            {repeats && (
              <div className="pl-6 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Every</span>
                  <input
                    type="number"
                    min={1}
                    value={interval}
                    onChange={e => setInterval(Number(e.target.value))}
                    className={`${inlineField} w-16`}
                  />
                  <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className={inlineField}>
                    <option value="daily">day(s)</option>
                    <option value="weekly">week(s)</option>
                    <option value="monthly">month(s)</option>
                    <option value="yearly">year(s)</option>
                  </select>
                  <span className="text-xs text-slate-500">until</span>
                  <input type="date" value={until} onChange={e => setUntil(e.target.value)} className={inlineField} />
                </div>
                {frequency === 'weekly' && (
                  <div className="flex gap-1">
                    {WEEKDAYS.map((d, i) => (
                      <button
                        key={i}
                        onClick={() => setDaysOfWeek(prev => toggle(prev, i))}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                          daysOfWeek.includes(i)
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reminders */}
          <div>
            <span className={label}><BellIcon className="w-3 h-3 inline mr-1" />Remind me</span>
            <div className="flex flex-wrap gap-1.5">
              {REMINDER_CHOICES.map(choice => (
                <button
                  key={choice.minutes}
                  onClick={() => setReminderMinutes(prev => toggle(prev, choice.minutes))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    reminderMinutes.includes(choice.minutes)
                      ? 'border-amber-500 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            {reminderMinutes.length === 0 && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1.5 font-medium">
                No reminder set — you will not be alerted before this starts.
              </p>
            )}
          </div>

          {/* Where */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <span className={label}>Location</span>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="Room, address…" className={field} />
            </div>
            <div>
              <span className={label}><LinkIcon className="w-3 h-3 inline mr-1" />Meeting link</span>
              <input value={conferenceLink} onChange={e => setConferenceLink(e.target.value)} placeholder="https://…" className={field} />
            </div>
          </div>

          {/* Attendees */}
          <div>
            <span className={label}><UsersIcon className="w-3 h-3 inline mr-1" />Attendees</span>
            <div className="flex flex-wrap gap-1.5">
              {users.filter(u => u.uid !== currentUser.uid).map(u => (
                <button
                  key={u.uid}
                  onClick={() => setAttendeeIds(prev => toggle(prev, u.uid))}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    attendeeIds.includes(u.uid)
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {u.displayName}
                </button>
              ))}
              {users.length <= 1 && <span className="text-xs text-slate-400">No teammates in this workspace yet.</span>}
            </div>
          </div>

          {/* Project + notes */}
          <div>
            <span className={label}>Linked project</span>
            <select value={projectId} onChange={e => setProjectId(e.target.value)} className={field}>
              <option value="">None</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <span className={label}>Notes / agenda</span>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Agenda, prep, links…"
              className={field}
            />
          </div>

          {error && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center space-x-2">
            {isEditing && (
              <>
                <button
                  onClick={() => handleDelete(existing?.recurrence ? 'occurrence' : 'series')}
                  className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                  <span>{existing?.recurrence ? 'Delete this one' : 'Delete'}</span>
                </button>
                {existing?.recurrence && (
                  <button
                    onClick={() => handleDelete('series')}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition-colors"
                  >
                    Delete series
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
            >
              {isEditing ? 'Save changes' : 'Add to calendar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
