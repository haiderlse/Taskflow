import { useEffect, useRef, useState } from 'react';
import type { ApiError } from '../../api/client';
import { useDay } from '../../api/days';
import { useCreateBlock, useStartBlock } from '../../api/deepWork';
import { useSettings } from '../../api/settings';
import { useToday } from '../../lib/useToday';
import { newBlockFor, planFocus, type FocusSubject } from '../../shared/exec/focus';
import type { DeepWorkBlock, MustShipStatus } from '../../shared/exec/todaySchemas';

export type FocusState =
  | { kind: 'loading' }
  | { kind: 'error'; what: string | null; error: ApiError; retry: () => void }
  | { kind: 'starting' }
  | { kind: 'live'; block: DeepWorkBlock; subject: FocusSubject }
  | { kind: 'closed'; title: string; status: MustShipStatus }
  | { kind: 'nothing' };

/**
 * Opening /focus starts or resumes today's block (spec C "Deep Work"). The plan is pure (`planFocus`); this
 * hook only executes a `start` plan, once: a ref guards the effect against StrictMode's double run and a
 * re-render, and a failure is kept until the person retries.
 */
export function useFocusSession(): FocusState {
  const { today, now, ready, settings } = useToday();
  const schedule = useSettings();
  const day = useDay(today, { enabled: ready });
  const create = useCreateBlock();
  const start = useStartBlock();
  const attempted = useRef(false);
  const [failure, setFailure] = useState<ApiError | null>(null);
  const plan = settings && day.data ? planFocus(now, settings, day.data) : null;
  const wantsStart = plan?.kind === 'start';

  useEffect(() => {
    if (!plan || plan.kind !== 'start' || !settings || attempted.current || failure) return;
    attempted.current = true;
    const { context, block } = plan;
    void (async () => {
      try {
        const target = block ?? (await create.mutateAsync(newBlockFor(new Date(), settings, context, today)));
        await start.mutateAsync(target.id);
      } catch (error) {
        setFailure(error as ApiError);
      }
    })();
  }, [wantsStart, failure]);

  const retry = () => {
    attempted.current = false;
    setFailure(null);
  };
  if (schedule.isError) return { kind: 'error', what: 'the schedule', error: schedule.error, retry: () => void schedule.refetch() };
  if (day.isError) return { kind: 'error', what: 'today', error: day.error, retry: () => void day.refetch() };
  if (failure) return { kind: 'error', what: null, error: failure, retry };
  if (!plan) return { kind: 'loading' };
  if (plan.kind === 'live') return { kind: 'live', block: plan.block, subject: plan.subject };
  if (plan.kind === 'closed') return { kind: 'closed', title: plan.title, status: plan.status };
  if (plan.kind === 'nothing') return { kind: 'nothing' };
  return { kind: 'starting' };
}
