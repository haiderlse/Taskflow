import { Link } from 'react-router-dom';
import { contextOf } from '../../shared/exec/week';
import type { TodayMode } from '../../shared/exec/today';
import type { Settings } from '../../shared/exec/schemas';
import type { DayView, MustShip } from '../../shared/exec/todaySchemas';
import { BuildCard } from './BuildCard';
import { ChooseMustShip } from './ChooseMustShip';
import { MustShipCard } from './MustShipCard';
import { TomorrowCard } from './TomorrowCard';

type Props = { mode: TodayMode; view: DayView; settings: Settings; tomorrow: { date: string; mustShip: MustShip | null } | null };

/** The one card this moment needs (spec C "Today is time-aware", first matching row). */
export function PrimaryCard({ mode, view, settings, tomorrow }: Props) {
  const active = (view.week?.outcomes ?? []).filter((outcome) => outcome.slot !== null && outcome.status === 'active');
  const work = active.filter((outcome) => contextOf(outcome.category) === 'work');
  const primary = mode.primary;
  if (primary.kind === 'build') {
    return (
      <BuildCard
        mustShip={view.buildMustShip}
        date={view.date}
        outcomes={active.filter((outcome) => contextOf(outcome.category) === 'build')}
        outcome={active.find((outcome) => contextOf(outcome.category) === 'build') ?? null}
        block={settings.buildBlocks.find((block) => block.weekday === mode.clock.weekday) ?? null}
        tomorrow={view.day?.shutdownAt ? tomorrow?.mustShip?.title ?? null : null}
        live={view.blocks.find((block) => block.startedAt !== null && block.endedAt === null) ?? null}
      />
    );
  }
  if (primary.kind === 'tomorrow') return tomorrow ? <TomorrowCard date={tomorrow.date} mustShip={tomorrow.mustShip} /> : null;
  if (primary.kind === 'choose') return <ChooseMustShip date={view.date} outcomes={work} />;
  if (primary.kind === 'resume') {
    return (
      <section aria-label="Focus" className="space-y-2 rounded-lg border border-line p-5 dark:border-ink-muted">
        <p className="text-xs uppercase tracking-wide text-ink-muted">Deep work in progress</p>
        {view.mustShip && <h2 className="text-2xl font-semibold">{view.mustShip.title}</h2>}
        <Link to="/focus" className="inline-block rounded bg-ink px-3 py-1.5 text-paper dark:bg-paper dark:text-ink">Resume focus</Link>
      </section>
    );
  }
  if (!view.mustShip) return null;
  const outcome = (view.week?.outcomes ?? []).find((candidate) => candidate.id === view.mustShip?.outcomeId) ?? null;
  return <MustShipCard mustShip={view.mustShip} outcome={outcome} outcomes={work} settings={settings} mode={primary.kind} />;
}
