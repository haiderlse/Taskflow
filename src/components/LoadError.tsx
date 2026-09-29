import type { ApiError } from '../api/client';
import { errorMessage } from '../api/errors';

type Props = { what: string; error: ApiError; onRetry: () => void };

/** A read failed: say what, in plain words, and offer to try again instead of showing an empty screen. */
export function LoadError({ what, error, onRetry }: Props) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-4 dark:border-ink-muted">
      <p className="flex-1">Could not load {what}: {errorMessage(error)}</p>
      <button type="button" onClick={onRetry} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">Try again</button>
    </div>
  );
}
