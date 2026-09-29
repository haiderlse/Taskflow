import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { LoadError } from '../components/LoadError';
import { MustShipPicker } from '../components/mustShip/MustShipPicker';
import { CarryOver } from '../components/plan/CarryOver';
import { ChooseOutcomes } from '../components/plan/ChooseOutcomes';
import { useWeekLookup } from '../api/weeks';
import { useDay } from '../api/days';
import { useToday } from '../lib/useToday';
import { contextOf, weekNumber, weekRangeLabel } from '../shared/exec/week';
import { dayLabel, nextWorkDay } from '../shared/exec/today';
import { weekStartOf } from '../shared/exec/time';
import type { Outcome, Settings } from '../shared/exec/schemas';

type Step = 'carry' | 'choose' | 'done';

/** Step 4 (spec C "Sunday planning"): the next work day's Must Ship can be set here too. */
function NextMustShip({ today, settings, outcomes }: { today: string; settings: Settings; outcomes: Outcome[] }) {
  const next = nextWorkDay(today, settings.workDays);
  const day = useDay(next);
  const work = outcomes.filter((outcome) => outcome.status === 'active' && contextOf(outcome.category) === 'work');
  return (
    <section aria-label="Next Must Ship" className="space-y-2 border-t border-line pt-4 dark:border-ink-muted">
      <h3 className="text-lg font-medium">Must Ship for {dayLabel(next)}</h3>
      {day.isError && <LoadError what="that day" error={day.error} onRetry={() => void day.refetch()} />}
      {!day.isSuccess && !day.isError && <p className="text-ink-muted">Loading…</p>}
      {day.isSuccess && (day.data.mustShip ? <p>{day.data.mustShip.title}</p> : <MustShipPicker date={next} context="work" outcomes={work} />)}
    </section>
  );
}

function Planned({ startDate, outcomes, today, settings }: { startDate: string; outcomes: Outcome[]; today: string; settings: Settings | undefined }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Week {weekNumber(startDate)} is planned.</h2>
      <ol className="list-decimal space-y-1 pl-5">{outcomes.map((outcome) => <li key={outcome.id}>{outcome.title}</li>)}</ol>
      <div className="flex gap-4">
        <Link to="/week" className="underline">Open the week</Link>
        <Link to="/" className="underline">Back to Today</Link>
      </div>
      {settings && <NextMustShip today={today} settings={settings} outcomes={outcomes} />}
    </section>
  );
}

/** Sunday planning (spec C, §4): steps 1, 2 and 4. Step 3, assigning deep-work blocks, arrives with the blocks. */
export default function Plan() {
  const { today, weekStartDay, ready, settings } = useToday();
  const lookup = useWeekLookup(today, { enabled: ready });
  const [chosenStep, setChosenStep] = useState<Step | null>(null);
  const current = lookup.data?.current ?? null;
  const startDate = current?.week.startDate ?? weekStartOf(today, weekStartDay);
  const slotted = (current?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  const carryable = (lookup.data?.previous?.outcomes ?? []).filter(
    (outcome) => outcome.status === 'active' && outcome.slot !== null && !slotted.some((mine) => mine.rolledFromId === outcome.id)
  );
  const natural: Step = carryable.length > 0 ? 'carry' : 'choose';
  const step: Step = slotted.length === 3 || chosenStep === 'done' ? 'done' : chosenStep === 'choose' ? 'choose' : natural;

  return (
    <ScreenShell title="Plan the week">
      <p className="text-ink-muted">Week {weekNumber(startDate)} · {weekRangeLabel(startDate)}</p>
      {lookup.isError && <LoadError what="the week" error={lookup.error} onRetry={() => void lookup.refetch()} />}
      {!lookup.isSuccess && !lookup.isError && <p className="text-ink-muted">Loading the week…</p>}
      {lookup.isSuccess && step === 'carry' && <CarryOver outcomes={carryable} today={today} weekId={current?.week.id} onNext={() => setChosenStep('choose')} />}
      {lookup.isSuccess && step === 'choose' && <ChooseOutcomes view={current} today={today} weekStartDate={startDate} onDone={() => setChosenStep('done')} />}
      {lookup.isSuccess && step === 'done' && <Planned startDate={startDate} outcomes={slotted} today={today} settings={settings} />}
    </ScreenShell>
  );
}
