import type { Task } from '../../shared/exec/schemas';
import { relativeTime } from '../../lib/relativeTime';
import { RowActions } from './RowActions';
import type { InboxAction } from './useInboxKeys';

type Props = { task: Task; selected: boolean; parked: boolean; now: Date; onSelect: () => void; onAction: (action: InboxAction) => void };

export function InboxRow({ task, selected, parked, now, onSelect, onAction }: Props) {
  return (
    <li
      role="option"
      aria-selected={selected}
      onClick={onSelect}
      className={`cursor-default rounded-md border px-3 py-2 ${selected ? 'border-ink bg-paper-raised dark:border-paper dark:bg-ink' : 'border-transparent'}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{task.title}</span>
        <span className="shrink-0 text-xs text-ink-muted">
          {task.context} · {relativeTime(task.capturedAt, now)}
        </span>
      </div>
      {selected && <RowActions onAction={onAction} parked={parked} />}
    </li>
  );
}
