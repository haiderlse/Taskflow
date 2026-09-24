import type { Context } from '../shared/exec/schemas';

type Props = { value: Context; onChange: (value: Context) => void };

const OPTIONS: { value: Context; label: string }[] = [
  { value: 'work', label: 'Work' },
  { value: 'build', label: 'Build' },
];

/** Work or Build. The two contexts never mix on screen (§16), so the choice is always visible. */
export function ContextToggle({ value, onChange }: Props) {
  return (
    <div role="group" aria-label="Context" className="inline-flex rounded-md border border-line p-0.5 dark:border-ink-muted">
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded px-3 py-1.5 text-sm ${option.value === value ? 'bg-ink text-paper dark:bg-paper dark:text-ink' : 'text-ink-muted'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
