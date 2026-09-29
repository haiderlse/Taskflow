import { Link } from 'react-router-dom';
import type { Outcome, Settings } from '../../shared/exec/schemas';
import type { MustShip } from '../../shared/exec/todaySchemas';

type Block = Settings['buildBlocks'][number];
type Props = { mustShip: MustShip | null; outcome: Outcome | null; block: Block | null; tomorrow: string | null };

/** Outside office hours and on non-work days: the build Must Ship or outcome and its block (§16). Never beside the office Must Ship. */
export function BuildCard({ mustShip, outcome, block, tomorrow }: Props) {
  const title = mustShip?.title ?? outcome?.title ?? null;
  return (
    <section aria-label="Build" className="space-y-2 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <p className="text-xs uppercase tracking-wide text-ink-muted">Build{mustShip ? ' · Must Ship' : outcome ? ' · Outcome' : ''}</p>
      {title ? <h2 className="text-2xl font-semibold">{title}</h2> : <h2 className="text-xl">Nothing planned for Build</h2>}
      <p className="text-sm text-ink-muted">{block ? `Build block ${block.start} · ${block.minutes} min` : 'No build block today'}</p>
      <div className="pt-1">
        {title ? (
          <Link to="/focus" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Start</Link>
        ) : (
          <Link to="/week" className="underline">Open the week</Link>
        )}
      </div>
      {tomorrow && <p className="text-sm text-ink-muted">Tomorrow: {tomorrow}</p>}
    </section>
  );
}
