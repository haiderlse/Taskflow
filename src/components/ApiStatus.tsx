import { useHealth } from '../api/health';

/** One line, only when the local API cannot be reached; silent otherwise. */
export function ApiStatus() {
  const health = useHealth();
  if (!health.isError) return null;
  return (
    <p role="status" className="rounded-md border border-line bg-paper-raised px-3 py-2 text-sm text-ink-muted dark:border-ink-muted dark:bg-ink">
      Local API not reachable. Start it with <code className="font-mono">npm run server</code>.
    </p>
  );
}
