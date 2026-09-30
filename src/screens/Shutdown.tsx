import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ScreenShell } from '../components/ScreenShell';
import { LoadError } from '../components/LoadError';
import { GradeToday } from '../components/shutdown/GradeToday';
import { OpenItems } from '../components/shutdown/OpenItems';
import { TomorrowMustShip, TomorrowSecondaries } from '../components/shutdown/TomorrowSteps';
import { TomorrowCard } from '../components/today/TomorrowCard';
import { useDay, useShutdown } from '../api/days';
import { useReportError } from '../api/errors';
import { useToday } from '../lib/useToday';
import { MUST_SHIP_STATUS_LABELS } from '../lib/labels';
import { dayLabel, nextWorkDay } from '../shared/exec/today';
import type { DayView } from '../shared/exec/todaySchemas';

type After = 'open' | 'tomorrow' | 'secondaries';
const WAIT = 'text-ink-muted';

/** "Tomorrow is ready" with tomorrow's plan (spec C, §12). */
function Ready({ tomorrow }: { tomorrow: DayView }) {
  return (
    <div className="space-y-3">
      <TomorrowCard date={tomorrow.date} mustShip={tomorrow.mustShip} />
      {tomorrow.secondaries.length > 0 && (
        <ul aria-label="Tomorrow's secondaries" className="list-disc pl-5">
          {tomorrow.secondaries.map(({ task }) => <li key={task.id}>{task.title}</li>)}
        </ul>
      )}
      <Link to="/" className="underline">Back to Today</Link>
    </div>
  );
}

type StepsProps = { today: DayView; tomorrow: DayView; weekStartDay: number; after: After; onAfter: (step: After) => void; closing: boolean; onClose: () => void };

/** Steps 2 to 4. Step 1 is behind them once today's Must Ship is graded, or when there is none. */
function LaterSteps({ today, tomorrow, weekStartDay, after, onAfter, closing, onClose }: StepsProps) {
  return (
    <>
      {today.mustShip && <p className={WAIT}>Today: {today.mustShip.title} · {MUST_SHIP_STATUS_LABELS[today.mustShip.status]}</p>}
      {after === 'open' && <OpenItems today={today.date} next={tomorrow.date} weekStartDay={weekStartDay} view={today} onNext={() => onAfter('tomorrow')} />}
      {after === 'tomorrow' && <TomorrowMustShip view={tomorrow} onNext={() => onAfter('secondaries')} />}
      {after === 'secondaries' && <TomorrowSecondaries view={tomorrow} pending={closing} onFinish={onClose} />}
    </>
  );
}

/** Shutdown (spec C, §12): four steps, each saved as it is taken, then "Tomorrow is ready". A reload resumes from the data. */
export default function Shutdown() {
  const { today, weekStartDay, ready, settings } = useToday();
  const next = settings ? nextWorkDay(today, settings.workDays) : today;
  const day = useDay(today, { enabled: ready });
  const tomorrow = useDay(next, { enabled: ready });
  const shutdown = useShutdown();
  const report = useReportError();
  const [after, setAfter] = useState<After>('open');
  const loaded = day.data && tomorrow.data ? { today: day.data, tomorrow: tomorrow.data } : null;
  const todays = loaded ? loaded.today.mustShip : null;
  const toGrade = todays?.status === 'planned' ? todays : null;
  const close = () => shutdown.mutate(today, { onError: report('close the day') });
  return (
    <ScreenShell title="Shutdown">
      <p className={WAIT}>{dayLabel(today)}</p>
      {day.isError && <LoadError what="today" error={day.error} onRetry={() => void day.refetch()} />}
      {tomorrow.isError && <LoadError what="tomorrow" error={tomorrow.error} onRetry={() => void tomorrow.refetch()} />}
      {!loaded && !day.isError && !tomorrow.isError && <p className={WAIT}>Loading…</p>}
      {loaded && loaded.today.day?.shutdownAt && <Ready tomorrow={loaded.tomorrow} />}
      {loaded && !loaded.today.day?.shutdownAt && toGrade && <GradeToday next={next} mustShip={toGrade} />}
      {loaded && !loaded.today.day?.shutdownAt && !toGrade && (
        <LaterSteps today={loaded.today} tomorrow={loaded.tomorrow} weekStartDay={weekStartDay} after={after} onAfter={setAfter} closing={shutdown.isPending} onClose={close} />
      )}
    </ScreenShell>
  );
}
