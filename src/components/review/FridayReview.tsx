import { useState } from 'react';
import { useFinishReview, useWeekView } from '../../api/review';
import { useReportError } from '../../api/errors';
import { DISPOSITION_LABELS, GRADE_LABELS } from '../../lib/labels';
import { reviewedOutcomes, reviewQueue } from '../../shared/exec/review';
import type { Outcome } from '../../shared/exec/schemas';
import { LoadError } from '../LoadError';
import { OutcomeReviewForm } from './OutcomeReviewForm';

type Props = { weekId: string; today: string };

const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

const verdict = (outcome: Outcome): string => {
  const grade = outcome.reviewGrade ? GRADE_LABELS[outcome.reviewGrade] : 'Not graded';
  return outcome.reviewDisposition ? `${grade} · ${DISPOSITION_LABELS[outcome.reviewDisposition]}` : grade;
};

function Graded({ outcomes }: { outcomes: Outcome[] }) {
  return (
    <ul aria-label="Graded outcomes" className="space-y-1">
      {outcomes.map((outcome) => (
        <li key={outcome.id}>{outcome.title}: {verdict(outcome)}</li>
      ))}
    </ul>
  );
}

/** Step 2 (spec C): with every outcome graded, the review is stamped done, with an optional note. */
function Finish({ weekId, outcomes }: { weekId: string; outcomes: Outcome[] }) {
  const finish = useFinishReview();
  const report = useReportError();
  const [notes, setNotes] = useState('');
  const done = () => finish.mutate({ weekId, notes: notes.trim() }, { onError: report('finish the review') });
  return (
    <div className="space-y-2">
      <p>{outcomes.length === 0 ? 'No outcomes to grade this week.' : 'Every outcome is graded.'}</p>
      {outcomes.length > 0 && <Graded outcomes={outcomes} />}
      <label htmlFor="review-notes" className="block text-sm">Notes (optional)</label>
      <textarea id="review-notes" rows={2} maxLength={4000} value={notes} onChange={(event) => setNotes(event.target.value)} className="w-full rounded border border-line px-3 py-2 dark:border-ink-muted dark:bg-ink" />
      <button type="button" disabled={finish.isPending} onClick={done} className={PRIMARY}>Review done</button>
    </div>
  );
}

/** The Friday review (spec C): each outcome in turn, then the stamp. A reload resumes at the first ungraded outcome. */
export function FridayReview({ weekId, today }: Props) {
  const view = useWeekView(weekId);
  if (view.isError) return <LoadError what="the week's outcomes" error={view.error} onRetry={() => void view.refetch()} />;
  if (!view.isSuccess) return <p className="text-ink-muted">Loading the review…</p>;
  const { week, outcomes } = view.data;
  const covered = reviewedOutcomes(outcomes);
  const queue = reviewQueue(outcomes);
  const next = queue.length > 0 ? queue[0] : null;
  return (
    <section aria-label="Friday review" className="space-y-3">
      <h2 className="text-xl font-medium">Friday review</h2>
      {week.reviewedAt !== null ? (
        <>
          <p>Reviewed.</p>
          {week.reviewNotes && <p className="text-ink-muted">{week.reviewNotes}</p>}
          <Graded outcomes={covered} />
        </>
      ) : next ? (
        <OutcomeReviewForm key={next.id} outcome={next} weekStartDate={week.startDate} today={today} position={`Outcome ${covered.length - queue.length + 1} of ${covered.length}`} />
      ) : (
        <Finish weekId={weekId} outcomes={covered} />
      )}
    </section>
  );
}
