import { useState } from 'react';
import { useBlockMustShip, useRollMustShip, useUpdateMustShip } from '../../api/mustShips';
import { useReportError } from '../../api/errors';
import type { ApiError } from '../../api/client';
import { dayLabel } from '../../shared/exec/today';
import type { Blocker } from '../../shared/exec/deepWorkSchemas';
import type { MustShip } from '../../shared/exec/todaySchemas';
import { BlockerForm } from '../focus/BlockerForm';

type Props = { next: string; mustShip: MustShip };
type Grade = 'shipped' | 'partial' | 'missed' | 'blocked';

const GRADES: { grade: Grade; label: string }[] = [
  { grade: 'shipped', label: 'Shipped' },
  { grade: 'partial', label: 'Partial' },
  { grade: 'missed', label: 'Missed' },
  { grade: 'blocked', label: 'Blocked' },
];
const CHOICE =
  'rounded border border-line px-3 py-1.5 aria-pressed:bg-ink aria-pressed:text-paper dark:border-ink-muted dark:aria-pressed:bg-paper dark:aria-pressed:text-ink';
const PRIMARY = 'rounded bg-ink px-3 py-1.5 text-paper disabled:opacity-40 dark:bg-paper dark:text-ink';

/** Shutdown step 1 (spec C): grade today's Must Ship. Partial and Missed roll it to the next work day unless unticked. */
export function GradeToday({ next, mustShip }: Props) {
  const update = useUpdateMustShip();
  const roll = useRollMustShip();
  const block = useBlockMustShip();
  const report = useReportError();
  const [grade, setGrade] = useState<Grade | null>(null);
  const [rollOn, setRollOn] = useState(true);
  const pending = update.isPending || roll.isPending || block.isPending;
  const slipped = grade === 'partial' || grade === 'missed';

  // Roll first, then grade: the grade moves Shutdown on to step 2, and a roll must not be left to a step that has gone.
  const save = async () => {
    if (grade === null || grade === 'blocked') return;
    if (slipped && rollOn) await roll.mutateAsync({ id: mustShip.id, date: next }).catch((error: ApiError) => report(`roll it to ${dayLabel(next)}`)(error));
    await update.mutateAsync({ id: mustShip.id, patch: { status: grade } }).catch((error: ApiError) => report('grade the Must Ship')(error));
  };
  const saveBlocked = (blocker: Blocker) => block.mutateAsync({ id: mustShip.id, blocker }).catch((error: ApiError) => report('record the blocker')(error));

  return (
    <section aria-label="What shipped today?" className="space-y-3">
      <h2 className="text-xl font-medium">What shipped today?</h2>
      <p className="text-2xl font-semibold">{mustShip.title}</p>
      {mustShip.definitionOfDone && <p className="text-ink-muted">{mustShip.definitionOfDone}</p>}
      <div role="group" aria-label="Grade" className="flex flex-wrap gap-2">
        {GRADES.map((choice) => (
          <button key={choice.grade} type="button" aria-pressed={grade === choice.grade} onClick={() => setGrade(choice.grade)} className={CHOICE}>
            {choice.label}
          </button>
        ))}
      </div>
      {slipped && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={rollOn} onChange={(event) => setRollOn(event.target.checked)} />
          Roll to {dayLabel(next)}
        </label>
      )}
      {grade === 'blocked' ? (
        <BlockerForm pending={pending} submitLabel="Record the blocker" onCancel={() => setGrade(null)} onSubmit={(blocker) => void saveBlocked(blocker)} />
      ) : (
        <button type="button" disabled={grade === null || pending} onClick={() => void save()} className={PRIMARY}>
          Save
        </button>
      )}
    </section>
  );
}
