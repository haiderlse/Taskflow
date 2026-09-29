import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { CaptureBar } from '../components/CaptureBar';
import { useWeekLookup } from '../api/weeks';
import { useToday } from '../lib/useToday';
import type { Outcome } from '../shared/exec/schemas';

function PlanBanner({ firstWeek }: { firstWeek: boolean }) {
  return (
    <>
      <Link to="/plan" className="block rounded-lg border border-line bg-paper-raised px-4 py-3 text-lg font-medium hover:border-ink dark:border-ink-muted dark:bg-ink">
        {firstWeek ? 'Plan your first week' : 'Plan this week'}
      </Link>
      <p className="text-ink-muted">Nothing is planned yet. The week's outcomes come first.</p>
    </>
  );
}

function ThisWeek({ outcomes }: { outcomes: Outcome[] }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm uppercase tracking-wide text-ink-muted">This week</h2>
      <ol aria-label="This week" className="space-y-1">
        {outcomes.map((outcome) => (
          <li key={outcome.id} className="flex justify-between gap-3">
            <span>{outcome.title}</span>
            <span className="text-ink-muted">{outcome.progress}%</span>
          </li>
        ))}
      </ol>
      <Link to="/week" className="text-sm underline">Open the week</Link>
    </section>
  );
}

/** Phase 3: the week's outcomes or the invitation to plan them, with capture pinned below. Phase 4 adds the Must Ship. */
export default function Today() {
  const { today } = useToday();
  const lookup = useWeekLookup(today);
  const outcomes = (lookup.data?.current?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  return (
    <ScreenShell title="Today">
      {lookup.isSuccess && outcomes.length === 0 && <PlanBanner firstWeek={lookup.data?.hasHistory !== true} />}
      {outcomes.length > 0 && <ThisWeek outcomes={outcomes} />}
      <div className="sticky bottom-20 pt-6 md:bottom-6">
        <CaptureBar />
      </div>
    </ScreenShell>
  );
}
