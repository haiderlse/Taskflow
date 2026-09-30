import { contextOf } from '../../shared/exec/week';
import { dayLabel } from '../../shared/exec/today';
import type { DayView } from '../../shared/exec/todaySchemas';
import { MustShipPicker } from '../mustShip/MustShipPicker';
import { Secondaries } from '../today/Secondaries';

const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

const rolled = (count: number): string => (count === 1 ? 'Rolled forward once' : `Rolled forward ${count} times`);

/** Step 3 (spec C): tomorrow's Must Ship is required; one rolled in step 1 is already there. */
export function TomorrowMustShip({ view, onNext }: { view: DayView; onNext: () => void }) {
  // A week with no plan yet has no outcomes: the picker then offers "No outcome" only.
  const work = (view.week?.outcomes ?? []).filter((outcome) => outcome.slot !== null && outcome.status === 'active' && contextOf(outcome.category) === 'work');
  return (
    <section aria-label="Tomorrow's Must Ship" className="space-y-3">
      <h2 className="text-xl font-medium">Must Ship for {dayLabel(view.date)}</h2>
      {view.mustShip ? (
        <>
          <p className="text-2xl font-semibold">{view.mustShip.title}</p>
          {view.mustShip.rollCount > 0 && <p className="text-sm text-ink-muted">{rolled(view.mustShip.rollCount)}</p>}
          <button type="button" onClick={onNext} className={PRIMARY}>Continue</button>
        </>
      ) : (
        <MustShipPicker date={view.date} context="work" outcomes={work} />
      )}
    </section>
  );
}

/** Step 4 (spec C): up to two secondaries for tomorrow, optional; then the day closes. */
export function TomorrowSecondaries({ view, pending, onFinish }: { view: DayView; pending: boolean; onFinish: () => void }) {
  return (
    <section aria-label="Tomorrow's secondaries" className="space-y-3">
      <h2 className="text-xl font-medium">Secondary priorities for {dayLabel(view.date)}</h2>
      <p className="text-ink-muted">Optional. At most two.</p>
      <Secondaries date={view.date} secondaries={view.secondaries} />
      <button type="button" disabled={pending} onClick={onFinish} className={PRIMARY}>Close the day</button>
    </section>
  );
}
