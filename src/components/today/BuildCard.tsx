import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MUST_SHIP_STATUS_LABELS } from '../../lib/labels';
import { MustShipPicker } from '../mustShip/MustShipPicker';
import type { Outcome, Settings } from '../../shared/exec/schemas';
import type { DeepWorkBlock, MustShip } from '../../shared/exec/todaySchemas';

type Block = Settings['buildBlocks'][number];
type Props = { mustShip: MustShip | null; outcome: Outcome | null; block: Block | null; tomorrow: string | null; date: string; outcomes: Outcome[]; live?: DeepWorkBlock | null };

/** Outside office hours and on non-work days: the build Must Ship or outcome and its block (§16). Never beside the office Must Ship. */
export function BuildCard({ mustShip, outcome, block, tomorrow, date, outcomes, live = null }: Props) {
  const [setting, setSetting] = useState(false);
  const title = mustShip?.title ?? outcome?.title ?? null;
  const planned = !mustShip || mustShip.status === 'planned';
  return (
    <section aria-label="Build" className="space-y-2 rounded-lg border border-line bg-paper-raised p-5 dark:border-ink-muted dark:bg-ink">
      <p className="text-xs uppercase tracking-wide text-ink-muted">Build{mustShip ? ' · Must Ship' : outcome ? ' · Outcome' : ''}
        {mustShip && !planned && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-paper dark:bg-paper dark:text-ink">{MUST_SHIP_STATUS_LABELS[mustShip.status]}</span>}
      </p>
      {title ? <h2 className="text-2xl font-semibold">{title}</h2> : <h2 className="text-xl">Nothing planned for Build</h2>}
      <p className="text-sm text-ink-muted">{block ? `Build block ${block.start} · ${block.minutes} min` : 'No build block today'}</p>
      <div className="pt-1">
        {!planned ? null : live ? (
          <Link to="/focus" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Resume focus</Link>
        ) : title ? (
          <Link to="/focus" className="rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Start</Link>
        ) : (
          <Link to="/week" className="underline">Open the week</Link>
        )}
      </div>
      {!mustShip && (
        <div className="pt-1">
          {setting ? (
            <MustShipPicker date={date} context="build" outcomes={outcomes} onDone={() => setSetting(false)} />
          ) : (
            <button type="button" onClick={() => setSetting(true)} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">Set a build Must Ship</button>
          )}
        </div>
      )}
      {tomorrow && <p className="text-sm text-ink-muted">Tomorrow: {tomorrow}</p>}
    </section>
  );
}
