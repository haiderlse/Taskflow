import { useId } from 'react';
import { REVIEW_REASONS, type ReviewReason } from '../../shared/exec/schemas';
import { REASON_LABELS } from '../../lib/labels';

type Props = { label: string; value: ReviewReason; onChange: (value: ReviewReason) => void };

export function ReasonSelect({ label, value, onChange }: Props) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value as ReviewReason)} className="rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink">
        {REVIEW_REASONS.map((reason) => (
          <option key={reason} value={reason}>
            {REASON_LABELS[reason]}
          </option>
        ))}
      </select>
    </div>
  );
}
