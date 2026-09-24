import { useState, type FormEvent } from 'react';
import type { Task } from '../../shared/exec/schemas';

type Props = { task: Task; defaultDate: string; onSubmit: (date: string) => void; onCancel: () => void };

export function SchedulePanel({ task, defaultDate, onSubmit, onCancel }: Props) {
  const [date, setDate] = useState(defaultDate);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (date) onSubmit(date);
  };
  return (
    <form aria-label={`Schedule ${task.title}`} onSubmit={submit} className="space-y-3 rounded-md border border-line p-4 dark:border-ink-muted">
      <label className="block text-sm" htmlFor="schedule-date">On</label>
      <input id="schedule-date" type="date" autoFocus value={date} onChange={(e) => setDate(e.target.value)} className="rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink" />
      <div className="flex gap-2">
        <button type="submit" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Schedule</button>
        <button type="button" onClick={onCancel} className="rounded px-3 py-1.5 text-ink-muted">Cancel</button>
      </div>
    </form>
  );
}
