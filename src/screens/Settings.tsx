import { useState, type FormEvent } from 'react';
import { ScreenShell } from '../components/ScreenShell';
import { LoadError } from '../components/LoadError';
import { BuildBlocksField } from '../components/settings/BuildBlocksField';
import { useToast } from '../components/Toast';
import { useSettings, useUpdateSettings } from '../api/settings';
import { useReportError } from '../api/errors';
import { WEEKDAY_NAMES } from '../lib/labels';
import type { Settings } from '../shared/exec/schemas';
import type { SettingsUpdate } from '../shared/exec/todaySchemas';

const FIELD = 'rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink';

const scheduleOf = (settings: Settings): SettingsUpdate => ({
  workDays: settings.workDays,
  deepWorkStart: settings.deepWorkStart,
  deepWorkMinutes: settings.deepWorkMinutes,
  shutdownTime: settings.shutdownTime,
  officeStart: settings.officeStart,
  officeEnd: settings.officeEnd,
  buildBlocks: settings.buildBlocks,
});

function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} className={FIELD} />
    </label>
  );
}

function ScheduleForm({ initial, pending, onSave }: { initial: SettingsUpdate; pending: boolean; onSave: (schedule: SettingsUpdate) => void }) {
  const [schedule, setSchedule] = useState(initial);
  const set = (patch: Partial<SettingsUpdate>) => setSchedule((current) => ({ ...current, ...patch }));
  const toggleDay = (day: number, on: boolean) =>
    set({ workDays: on ? [...schedule.workDays, day].sort((a, b) => a - b) : schedule.workDays.filter((other) => other !== day) });
  const reversed = schedule.officeStart >= schedule.officeEnd;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!reversed && !pending) onSave(schedule);
  };
  return (
    <form aria-label="Schedule" onSubmit={submit} className="space-y-5">
      <fieldset className="space-y-1">
        <legend className="text-sm">Work days</legend>
        <div className="flex flex-wrap gap-3">
          {WEEKDAY_NAMES.map((name, day) => (
            <label key={name} className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={schedule.workDays.includes(day)} onChange={(e) => toggleDay(day, e.target.checked)} />
              {name}
            </label>
          ))}
        </div>
      </fieldset>
      <TimeField label="Deep work starts" value={schedule.deepWorkStart} onChange={(deepWorkStart) => set({ deepWorkStart })} />
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Deep work minutes</span>
        <input type="number" min={15} max={240} value={schedule.deepWorkMinutes} onChange={(e) => set({ deepWorkMinutes: Number(e.target.value) })} className={`${FIELD} w-24`} />
      </label>
      <TimeField label="Shutdown" value={schedule.shutdownTime} onChange={(shutdownTime) => set({ shutdownTime })} />
      <TimeField label="Office opens" value={schedule.officeStart} onChange={(officeStart) => set({ officeStart })} />
      <TimeField label="Office closes" value={schedule.officeEnd} onChange={(officeEnd) => set({ officeEnd })} />
      {reversed && <p className="text-sm">Office hours must start before they end.</p>}
      <BuildBlocksField value={schedule.buildBlocks} onChange={(buildBlocks) => set({ buildBlocks })} />
      <button type="submit" disabled={reversed || pending} className="rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink">
        Save settings
      </button>
    </form>
  );
}

/** Spec D Phase 4: a minimal panel for the times, the work days and the build blocks. The time zone and week start are fixed. */
export default function SettingsScreen() {
  const settings = useSettings();
  const update = useUpdateSettings();
  const report = useReportError();
  const toast = useToast();
  return (
    <ScreenShell title="Settings">
      {settings.isError && <LoadError what="the schedule" error={settings.error} onRetry={() => void settings.refetch()} />}
      {settings.data && (
        <ScheduleForm
          initial={scheduleOf(settings.data)}
          pending={update.isPending}
          onSave={(schedule) => update.mutate(schedule, { onSuccess: () => toast.show('Settings saved.'), onError: report('save the settings') })}
        />
      )}
    </ScreenShell>
  );
}
