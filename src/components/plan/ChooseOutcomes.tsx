import { useState } from 'react';
import { useAddOutcome } from '../../api/weeks';
import { useReportError } from '../../api/errors';
import { fridayOf } from '../../shared/exec/week';
import type { WeekView } from '../../shared/exec/schemas';
import { OutcomeForm } from '../outcomes/OutcomeForm';

type Props = { view: WeekView | null; today: string; weekStartDate: string; onDone: () => void };

/** Step 2 (§4): up to three outcomes, one at a time, each with a definition of done. */
export function ChooseOutcomes({ view, today, weekStartDate, onDone }: Props) {
  const add = useAddOutcome();
  const report = useReportError();
  const [formKey, setFormKey] = useState(0);
  const chosen = (view?.outcomes ?? []).filter((outcome) => outcome.slot !== null);
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-medium">This week's outcomes</h2>
      <p className="text-ink-muted">Up to three. Results, not activities.</p>
      {chosen.length > 0 && (
        <ol aria-label="Chosen outcomes" className="list-decimal space-y-1 pl-5">
          {chosen.map((outcome) => <li key={outcome.id}>{outcome.title}</li>)}
        </ol>
      )}
      <OutcomeForm
        key={formKey}
        requireDefinition
        defaultTargetDate={fridayOf(weekStartDate)}
        submitLabel={`Add outcome ${chosen.length + 1}`}
        pending={add.isPending}
        onSubmit={(input) =>
          add.mutate({ date: today, weekId: view?.week.id, input }, { onSuccess: () => setFormKey((key) => key + 1), onError: report('add the outcome') })
        }
      />
      {chosen.length > 0 && (
        <button type="button" onClick={onDone} className="rounded border border-line px-3 py-1.5 text-sm dark:border-ink-muted">
          Done choosing
        </button>
      )}
    </section>
  );
}
