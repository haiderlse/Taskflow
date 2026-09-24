import type { InboxAction } from './useInboxKeys';

type Props = { onAction: (action: InboxAction) => void; parked: boolean };

const ACTIONS: { action: InboxAction; label: string; inboxOnly: boolean }[] = [
  { action: 'this_week', label: 'This week (T)', inboxOnly: false },
  { action: 'later', label: 'Later (L)', inboxOnly: true },
  { action: 'delegate', label: 'Delegate (D)', inboxOnly: false },
  { action: 'schedule', label: 'Schedule (S)', inboxOnly: false },
  { action: 'project', label: 'Project (P)', inboxOnly: false },
  { action: 'delete', label: 'Delete (X)', inboxOnly: true },
];

/** The same six actions as the keys, for the mouse and the phone. */
export function RowActions({ onAction, parked }: Props) {
  return (
    <div className="flex flex-wrap gap-1 pt-2">
      {ACTIONS.map(({ action, label, inboxOnly }) => (
        <button
          key={action}
          type="button"
          disabled={parked && inboxOnly}
          onClick={(event) => {
            event.stopPropagation();
            onAction(action);
          }}
          className="rounded border border-line px-2 py-1 text-xs text-ink-muted hover:text-ink disabled:opacity-40 dark:border-ink-muted dark:hover:text-paper"
        >
          {label}
        </button>
      ))}
    </div>
  );
}
