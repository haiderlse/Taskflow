import { useId, useState, type FormEvent } from 'react';
import { useReviewOutcome } from '../../api/review';
import { useReportError } from '../../api/errors';
import { CATEGORY_LABELS, DISPOSITION_LABELS, GRADE_LABELS } from '../../lib/labels';
import { addDays } from '../../shared/exec/dates';
import { REVIEW_DISPOSITIONS, REVIEW_GRADES } from '../../shared/exec/schemas';
import type { Outcome, ReviewReason } from '../../shared/exec/schemas';
import type { OutcomeReview } from '../../shared/exec/reviewSchemas';
import { ReasonSelect } from '../outcomes/ReasonSelect';

type Grade = OutcomeReview['grade'];
type Disposition = NonNullable<OutcomeReview['disposition']>;
type Slip = { reason: ReviewReason; disposition: Disposition | null; date: string; owner: string; followUpDate: string };
type Props = { outcome: Outcome; weekStartDate: string; today: string; position: string };

const FIELD = 'rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink';
const CHOICE = 'mr-4 inline-flex items-center gap-1';
const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

/** The body this form would send, or null while it is incomplete. A reschedule must land in a later week. */
function toReview(grade: Grade | null, slip: Slip, nextWeek: string): OutcomeReview | null {
  if (grade === null) return null;
  if (grade === 'done') return { grade };
  const { reason, disposition } = slip;
  if (disposition === 'reschedule') return slip.date >= nextWeek ? { grade, reason, disposition, date: slip.date } : null;
  if (disposition === 'delegate') {
    const owner = slip.owner.trim();
    return owner && slip.followUpDate ? { grade, reason, disposition, owner, followUpDate: slip.followUpDate } : null;
  }
  return disposition === null ? null : { grade, reason, disposition };
}

/** Why it slipped, and what happens to it (spec C "Friday review": Roll / Reschedule / Delegate / Kill). */
function SlipFields({ id, slip, nextWeek, onChange }: { id: string; slip: Slip; nextWeek: string; onChange: (slip: Slip) => void }) {
  const set = (fields: Partial<Slip>) => onChange({ ...slip, ...fields });
  return (
    <div className="space-y-3">
      <ReasonSelect label="Why did it slip?" value={slip.reason} onChange={(reason) => set({ reason })} />
      <fieldset className="space-y-1">
        <legend className="text-sm">What happens to it?</legend>
        {REVIEW_DISPOSITIONS.map((value) => (
          <label key={value} className={CHOICE}>
            <input type="radio" name={`${id}-disposition`} checked={slip.disposition === value} onChange={() => set({ disposition: value })} />
            {DISPOSITION_LABELS[value]}
          </label>
        ))}
      </fieldset>
      {slip.disposition === 'reschedule' && (
        <div className="space-y-1">
          <label htmlFor={`${id}-date`} className="block text-sm">Move to</label>
          <input id={`${id}-date`} type="date" min={nextWeek} value={slip.date} onChange={(event) => set({ date: event.target.value })} className={FIELD} />
        </div>
      )}
      {slip.disposition === 'delegate' && (
        <div className="space-y-1">
          <label htmlFor={`${id}-owner`} className="block text-sm">Owner</label>
          <input id={`${id}-owner`} value={slip.owner} maxLength={120} onChange={(event) => set({ owner: event.target.value })} className={FIELD} />
          <label htmlFor={`${id}-follow-up`} className="block text-sm">Follow up on</label>
          <input id={`${id}-follow-up`} type="date" value={slip.followUpDate} onChange={(event) => set({ followUpDate: event.target.value })} className={FIELD} />
        </div>
      )}
    </div>
  );
}

/** One outcome's Friday grade (spec C "Friday review" step 1): Done, or Partial or Missed with a reason and what happens next. */
export function OutcomeReviewForm({ outcome, weekStartDate, today, position }: Props) {
  const id = useId();
  const review = useReviewOutcome();
  const report = useReportError();
  const nextWeek = addDays(weekStartDate, 7);
  const finished = outcome.status === 'done';
  const [grade, setGrade] = useState<Grade | null>(finished ? 'done' : null);
  const [slip, setSlip] = useState<Slip>({ reason: 'insufficient_time', disposition: null, date: addDays(nextWeek, 1), owner: '', followUpDate: addDays(today, 3) });
  const input = toReview(grade, slip, nextWeek);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (input && !review.isPending) review.mutate({ id: outcome.id, input }, { onError: report('save the grade') });
  };
  return (
    <form aria-label={`Review "${outcome.title}"`} onSubmit={submit} className="space-y-3 rounded-lg border border-line p-5 dark:border-ink-muted">
      <p className="text-sm text-ink-muted">{position} · {CATEGORY_LABELS[outcome.category]}</p>
      <h3 className="text-xl font-semibold">{outcome.title}</h3>
      {outcome.definitionOfDone && <p className="text-ink-muted">Done means: {outcome.definitionOfDone}</p>}
      <fieldset className="space-y-1">
        <legend className="text-sm">Grade</legend>
        {REVIEW_GRADES.map((value) => (
          <label key={value} className={CHOICE}>
            <input type="radio" name={`${id}-grade`} checked={grade === value} disabled={finished && value !== 'done'} onChange={() => setGrade(value)} />
            {GRADE_LABELS[value]}
          </label>
        ))}
      </fieldset>
      {grade !== null && grade !== 'done' && <SlipFields id={id} slip={slip} nextWeek={nextWeek} onChange={setSlip} />}
      <button type="submit" disabled={input === null || review.isPending} className={PRIMARY}>Save grade</button>
    </form>
  );
}
