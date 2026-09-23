import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';

/** Phase 1: an empty day. Phase 3 replaces the unconditional banner with the real check. */
export default function Today() {
  return (
    <ScreenShell title="Today">
      <Link
        to="/plan"
        className="block rounded-lg border border-line bg-paper-raised px-4 py-3 text-lg font-medium hover:border-ink dark:border-ink-muted dark:bg-ink"
      >
        Plan your first week
      </Link>
      <p className="text-ink-muted">Nothing is planned yet. The week's outcomes come first.</p>
    </ScreenShell>
  );
}
