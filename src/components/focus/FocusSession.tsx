import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFinishBlock, usePauseBlock, useResumeBlock } from '../../api/deepWork';
import type { ApiError } from '../../api/client';
import { useReportError } from '../../api/errors';
import type { DeepWorkFinishInput } from '../../shared/exec/deepWorkSchemas';
import type { FocusSubject } from '../../shared/exec/focus';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';
import { BlockerForm } from './BlockerForm';
import { FocusTimer } from './FocusTimer';

type Props = { block: DeepWorkBlock; subject: FocusSubject; onLeaving: (leaving: boolean) => void };

const EXIT = 'rounded border border-line px-4 py-2 disabled:opacity-40 dark:border-ink-muted';

/** The whole screen of a live session: the subject, the timer, Pause, and three exits. Nothing else (spec C "Deep Work"). */
export function FocusSession({ block, subject, onLeaving }: Props) {
  const navigate = useNavigate();
  const pause = usePauseBlock();
  const resume = useResumeBlock();
  const finish = useFinishBlock();
  const report = useReportError();
  const [blocking, setBlocking] = useState(false);
  const paused = block.pauseStartedAt !== null;
  const toggling = pause.isPending || resume.isPending;
  // The screen behind this one changes as soon as the day is re-read, so the parent holds "Saving…" until Today is reached.
  // mutateAsync (not mutate's callbacks) because those do not fire once this component has unmounted.
  const leave = (input: DeepWorkFinishInput) => {
    onLeaving(true);
    finish.mutateAsync({ id: block.id, input }).then(
      () => navigate('/'),
      (error: unknown) => {
        onLeaving(false);
        report('finish the session')(error as ApiError);
      }
    );
  };
  return (
    <section aria-label="Focus session" className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold">{subject.title}</h2>
        {subject.definitionOfDone && <p>{subject.definitionOfDone}</p>}
        {subject.notes && <p className="whitespace-pre-wrap text-ink-muted">{subject.notes}</p>}
      </div>
      <FocusTimer block={block} />
      <div className="flex justify-center">
        <button
          type="button"
          disabled={toggling}
          onClick={() => (paused ? resume : pause).mutate(block.id, { onError: report(paused ? 'resume the session' : 'pause the session') })}
          className={EXIT}
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" disabled={finish.isPending} onClick={() => leave({ result: 'completed' })} className={EXIT}>Completed</button>
        <button type="button" disabled={finish.isPending} onClick={() => leave({ result: 'progress' })} className={EXIT}>Made progress</button>
        <button type="button" disabled={finish.isPending} onClick={() => setBlocking(true)} className={EXIT}>Blocked</button>
      </div>
      {blocking && <BlockerForm pending={finish.isPending} onCancel={() => setBlocking(false)} onSubmit={(blocker) => leave({ result: 'blocked', blocker })} />}
    </section>
  );
}
