import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useCaptureTask } from '../api/tasks';
import { useSettings } from '../api/settings';
import { defaultContext } from '../shared/exec/time';
import type { Context, Task } from '../shared/exec/schemas';
import { ContextToggle } from './ContextToggle';
import { useToast } from './Toast';

type Props = { inputId?: string; autoFocus?: boolean; large?: boolean; onCaptured?: (task: Task) => void };

export const CAPTURED_MESSAGE = 'Captured. It is in the Inbox, not on Today.';

/** Capture is not commitment: this only ever creates an inbox item (§10). */
export function CaptureBar({ inputId = 'capture-input', autoFocus = false, large = false, onCaptured }: Props) {
  const settings = useSettings();
  const capture = useCaptureTask();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [chosen, setChosen] = useState<Context | null>(null);

  // The toggle follows the clock until the user picks; Work in office hours, Build otherwise.
  const context: Context = chosen ?? (settings.data ? defaultContext(new Date(), settings.data) : 'work');
  const trimmed = title.trim();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!trimmed || capture.isPending) return;
    capture.mutate(
      { title: trimmed, context },
      {
        onSuccess: (task) => {
          setTitle('');
          toast.show(CAPTURED_MESSAGE);
          onCaptured?.(task);
        },
      }
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') event.currentTarget.blur();
  };

  return (
    <form onSubmit={submit} aria-label="Capture" className="space-y-2">
      <div className="flex gap-2">
        <input
          id={inputId}
          type="text"
          aria-label="Capture"
          autoFocus={autoFocus}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Capture anything. It goes to the Inbox."
          className={`min-w-0 flex-1 rounded-md border border-line bg-paper-raised px-3 ${large ? 'py-3 text-lg' : 'py-2'} dark:border-ink-muted dark:bg-ink`}
        />
        <button
          type="submit"
          disabled={!trimmed || capture.isPending}
          className={`rounded-md bg-ink text-paper disabled:opacity-40 dark:bg-paper dark:text-ink ${large ? 'px-5 py-3 text-lg' : 'px-4 py-2'}`}
        >
          Capture
        </button>
      </div>
      <ContextToggle value={context} onChange={setChosen} />
      {capture.isError && (
        <p role="alert" className="text-sm text-ink-muted">
          Could not capture: {capture.error.message}
        </p>
      )}
    </form>
  );
}
