import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { CarryOver } from '../components/plan/CarryOver';
import { ChooseOutcomes } from '../components/plan/ChooseOutcomes';
import { useWeekLookup } from '../api/weeks';
import { useToday } from '../lib/useToday';
import { weekNumber, weekRangeLabel } from '../shared/exec/week';
import { weekStartOf } from '../shared/exec/time';
import type { Outcome } from '../shared/exec/schemas';

type Step = 'carry' | 'choose' | 'done';

function Planned({ startDate, outcomes }: { startDate: string; outcomes: Outcome[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">Week {weekNumber(startDate)} is planned.</h2>
      <ol className="list-decimal space-y-1 pl-5">{outcomes.map((outcome) => <li key={outcome.id}>{outcome.title}</li>)}</ol>
      <div className="flex gap-4">
        <Link to="/week" className="underline">Open the week</Link>
        <Link to="/" className="underline">Back to Today</Link>
      </div>
    </section>
  );
}

/** Sunday planning (spec C, §4): steps 1, 2 and 4. Step 3, assigning deep-work blocks, arrives with the blocks. */
export default function Plan() {
  const { today, weekStartDay, ready } = useToday();
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
      {!lookup.isSuccess && <p className="text-ink-muted">Loading the week…</p>}
      {lookup.isSuccess && step === 'carry' && <CarryOver outcomes={carryable} today={today} weekId={current?.week.id} onNext={() => setChosenStep('choose')} />}
      {lookup.isSuccess && step === 'choose' && <ChooseOutcomes view={current} today={today} weekStartDate={startDate} onDone={() => setChosenStep('done')} />}
      {lookup.isSuccess && step === 'done' && <Planned startDate={startDate} outcomes={slotted} />}
    </ScreenShell>
  );
}
