import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { LoadError } from '../components/LoadError';
import { FocusSession } from '../components/focus/FocusSession';
import { useFocusSession } from '../components/focus/useFocusSession';
import { errorMessage } from '../api/errors';
import { MUST_SHIP_STATUS_LABELS } from '../lib/labels';

const WAIT = 'text-ink-muted';

function Nothing({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      <p>{text}</p>
      <Link to="/" className="underline">Back to Today</Link>
    </div>
  );
}

/** Deep Work (spec C): opened from Today, it starts or resumes today's block. One subject, one timer, three exits. */
export default function Focus() {
  const state = useFocusSession();
  return (
    <ScreenShell title="Focus">
      {state.kind === 'loading' && <p className={WAIT}>Loading…</p>}
      {state.kind === 'starting' && <p className={WAIT}>Starting your session…</p>}
      {state.kind === 'error' && state.what !== null && <LoadError what={state.what} error={state.error} onRetry={state.retry} />}
      {state.kind === 'error' && state.what === null && (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-4 dark:border-ink-muted">
          <p className="flex-1">Could not start the session: {errorMessage(state.error)}</p>
          <button type="button" onClick={state.retry} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">Try again</button>
        </div>
      )}
      {state.kind === 'nothing' && <Nothing text="Nothing to focus on." />}
      {state.kind === 'closed' && <Nothing text={`${state.title} is ${MUST_SHIP_STATUS_LABELS[state.status].toLowerCase()}. Nothing left to focus on.`} />}
      {state.kind === 'live' && <FocusSession block={state.block} subject={state.subject} />}
    </ScreenShell>
  );
}
