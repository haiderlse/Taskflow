import { useTasks } from '../api/tasks';
import { CaptureBar } from '../components/CaptureBar';

/** The phone page (§10, spec C "Capture"): one field, the count, the last five. Nothing else. */
export default function Capture() {
  const inbox = useTasks({ status: ['inbox'] });
  const count = inbox.data?.length ?? 0;
  const recent = (inbox.data ?? []).slice(0, 5);
  return (
    <section className="mx-auto max-w-md space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Capture</h1>
      <CaptureBar autoFocus large />
      <p className="text-ink-muted" aria-live="polite">
        {count} in inbox
      </p>
      <ul aria-label="Recent captures" className="space-y-1">
        {recent.map((task) => (
          <li key={task.id} className="flex justify-between gap-3 border-t border-line py-2 text-sm dark:border-ink-muted">
            <span>{task.title}</span>
            <span className="text-ink-muted">{task.context}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
