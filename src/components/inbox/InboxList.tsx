import type { Task } from '../../shared/exec/schemas';
import { InboxRow } from './InboxRow';
import type { InboxAction } from './useInboxKeys';

type Props = {
  label: 'Inbox' | 'Later';
  tasks: Task[];
  selected: number;
  now: Date;
  emptyText: string;
  onSelect: (index: number) => void;
  onAction: (action: InboxAction, index: number) => void;
};

export function InboxList({ label, tasks, selected, now, emptyText, onSelect, onAction }: Props) {
  if (tasks.length === 0) return <p className="text-ink-muted">{emptyText}</p>;
  return (
    <ul role="listbox" aria-label={label} className="space-y-1">
      {tasks.map((task, index) => (
        <InboxRow
          key={task.id}
          task={task}
          selected={index === selected}
          parked={label === 'Later'}
          now={now}
          onSelect={() => onSelect(index)}
          onAction={(action) => onAction(action, index)}
        />
      ))}
    </ul>
  );
}
