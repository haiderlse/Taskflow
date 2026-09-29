import { useState } from 'react';
import { useAddOutcome, useUpdateOutcome } from '../../api/weeks';
import { useReportError, weekFullOutcomes } from '../../api/errors';
import { fridayOf } from '../../shared/exec/week';
import type { Outcome, OutcomeInput, ReviewReason, WeekView } from '../../shared/exec/schemas';
import { OutcomeCard } from '../outcomes/OutcomeCard';
import { OutcomeForm } from '../outcomes/OutcomeForm';
import { ReplacePicker } from '../outcomes/ReplacePicker';

type Props = { view: WeekView | null; today: string; weekStartDate: string };
type PendingReplace = { input: OutcomeInput; outcomes: Outcome[] };

function Slots({ outcomes }: { outcomes: Outcome[] }) {
  const update = useUpdateOutcome();
  const report = useReportError();
  return (
    <>
      {[1, 2, 3].map((slot) => {
        const outcome = outcomes.find((candidate) => candidate.slot === slot);
        if (!outcome) return <p key={slot} className="rounded-lg border border-dashed border-line p-4 text-ink-muted dark:border-ink-muted">Outcome {slot} is open.</p>;
        return (
          <OutcomeCard
            key={outcome.id}
            outcome={outcome}
            onUpdate={(patch) => update.mutate({ id: outcome.id, patch }, { onError: report('save the outcome') })}
            onKill={(reason) => update.mutate({ id: outcome.id, patch: { status: 'killed', reviewReason: reason } }, { onError: report('kill the outcome') })}
          />
        );
      })}
    </>
  );
}

/** The three slots and the only way to change them: add while one is open, replace when all three are taken (§4). */
export function WeekSlots({ view, today, weekStartDate }: Props) {
  const add = useAddOutcome();
  const report = useReportError();
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<PendingReplace | null>(null);
  const slotted = (view?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  const full = slotted.length === 3;
  const replaceable = slotted.filter((outcome) => outcome.status === 'active');

  const send = (input: OutcomeInput, replace?: { outcomeId: string; reason: ReviewReason }) =>
    add.mutate(
      { date: today, weekId: view?.week.id, input: replace ? { ...input, replace } : input },
      {
        onSuccess: () => { setAdding(false); setPending(null); },
        onError: (error) => {
          const outcomes = weekFullOutcomes(error)?.filter((outcome) => outcome.status === 'active');
          if (outcomes?.length) setPending({ input, outcomes });
          else report('add the outcome')(error);
        },
      }
    );

  return (
    <section aria-label="Outcomes" className="space-y-3">
      <Slots outcomes={slotted} />
      {pending ? (
        <ReplacePicker outcomes={pending.outcomes} pending={add.isPending} onCancel={() => setPending(null)} onPick={(outcomeId, reason) => send(pending.input, { outcomeId, reason })} />
      ) : adding ? (
        <OutcomeForm
          defaultTargetDate={fridayOf(weekStartDate)}
          submitLabel={full ? 'Choose what it replaces' : 'Add outcome'}
          pending={add.isPending}
          onCancel={() => setAdding(false)}
          onSubmit={(input) => (full ? setPending({ input, outcomes: replaceable }) : send(input))}
        />
      ) : full && replaceable.length === 0 ? (
        <p className="text-sm text-ink-muted">All three outcomes are done.</p>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">
          {full ? 'Replace an outcome' : 'Add an outcome'}
        </button>
      )}
    </section>
  );
}
