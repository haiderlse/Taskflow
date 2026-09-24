import { useCallback, useState } from 'react';
import { useDeleteTask, useTasks, useUpdateTask } from '../api/tasks';
import { useSettings } from '../api/settings';
import { useToast } from '../components/Toast';
import { InboxList } from '../components/inbox/InboxList';
import { DelegatePanel } from '../components/inbox/DelegatePanel';
import { SchedulePanel } from '../components/inbox/SchedulePanel';
import { ProjectPicker } from '../components/inbox/ProjectPicker';
import { useInboxKeys, type InboxAction } from '../components/inbox/useInboxKeys';
import { scheduleStatus, tomorrowFrom } from '../lib/inboxRules';
import { toCalendarDate } from '../shared/exec/dates';
import { localClock } from '../shared/exec/time';
import type { ApiError } from '../api/client';
import type { Task } from '../shared/exec/schemas';

type Tab = 'inbox' | 'later';
type Panel = { kind: 'delegate' | 'schedule' | 'project'; task: Task } | null;

const TABS: { id: Tab; label: 'Inbox' | 'Later' }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'later', label: 'Later' },
];

/** Everything captured but not decided about (§10). Keyboard first; the row buttons mirror the keys. */
export default function Inbox() {
  const [tab, setTab] = useState<Tab>('inbox');
  const [panel, setPanel] = useState<Panel>(null);
  const tasks = useTasks({ status: [tab] });
  const settings = useSettings();
  const update = useUpdateTask();
  const remove = useDeleteTask();
  const toast = useToast();

  const items = tasks.data ?? [];
  const now = new Date();
  const today = settings.data ? localClock(now, settings.data.timezone).date : toCalendarDate(now);
  const weekStartDay = settings.data?.weekStartDay ?? 0;
  const parked = tab === 'later';

  const report = (verb: string) => (error: ApiError) => toast.show(`Could not ${verb}: ${error.message}`);

  const act = useCallback(
    (action: InboxAction, index: number) => {
      const task = items[index];
      if (!task) return;
      if (action === 'this_week') update.mutate({ id: task.id, patch: { status: 'this_week' } }, { onError: report('update') });
      else if (action === 'later') {
        if (parked) toast.show('This item is already parked.');
        else update.mutate({ id: task.id, patch: { status: 'later' } }, { onError: report('update') });
      } else if (action === 'delete') {
        if (parked) toast.show('Only an inbox item can be deleted.');
        else remove.mutate(task.id, { onError: report('delete') });
      } else if (action === 'delegate' || action === 'schedule' || action === 'project') setPanel({ kind: action, task });
    },
    [items, parked, update, remove, toast]
  );

  const { selected, setSelected } = useInboxKeys(items.length, act, panel === null);
  const close = () => setPanel(null);
  const patchAndClose = (id: string, patch: Parameters<typeof update.mutate>[0]['patch']) =>
    update.mutate({ id, patch }, { onSuccess: close, onError: report('update') });

  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Inbox</h1>
      <div role="tablist" className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => { setTab(t.id); setPanel(null); }} className={`rounded-md px-3 py-1.5 text-sm ${tab === t.id ? 'bg-ink text-paper dark:bg-paper dark:text-ink' : 'text-ink-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-ink-muted">{parked ? `${items.length} parked` : `${items.length} to process`}</p>
      <InboxList
        label={parked ? 'Later' : 'Inbox'}
        tasks={items}
        selected={selected}
        now={now}
        emptyText={parked ? 'Nothing parked for later.' : 'Inbox zero.'}
        onSelect={setSelected}
        onAction={act}
      />
      {panel?.kind === 'delegate' && (
        <DelegatePanel task={panel.task} defaultFollowUp={tomorrowFrom(today)} onCancel={close} onSubmit={(fields) => patchAndClose(panel.task.id, { status: 'delegated', ...fields })} />
      )}
      {panel?.kind === 'schedule' && (
        <SchedulePanel task={panel.task} defaultDate={tomorrowFrom(today)} onCancel={close} onSubmit={(date) => patchAndClose(panel.task.id, { status: scheduleStatus(date, today, weekStartDay), scheduledDate: date })} />
      )}
      {panel?.kind === 'project' && (
        <ProjectPicker task={panel.task} onCancel={close} onPick={(projectId) => patchAndClose(panel.task.id, { projectId, status: 'later' })} />
      )}
      <p className="text-xs text-ink-muted">T this week · L later · D delegate · S schedule · P project · X delete · j/k move</p>
    </section>
  );
}
