import { useState } from 'react';
import { useCreateBlock, useBlocks, useUpdateBlock } from '../../api/deepWork';
import { useReportError } from '../../api/errors';
import { useSettings } from '../../api/settings';
import { defaultBlocksFor, weekRange, withoutPlaced } from '../../shared/exec/deepWork';
import type { Outcome } from '../../shared/exec/schemas';
import { LoadError } from '../LoadError';
import { BlockPanel, type PanelFields, type PanelTarget } from './BlockPanel';
import { WeekGrid, type GridTarget } from './WeekGrid';

type Props = { weekStartDate: string; today: string; outcomes: Outcome[]; flagMissing?: boolean };

/** The week's deep-work grid with the panel that assigns blocks, and (for /plan step 3) the outcomes still without time. */
export function WeekDeepWork({ weekStartDate, today, outcomes, flagMissing = false }: Props) {
  const settings = useSettings();
  const blocks = useBlocks(weekRange(weekStartDate));
  const create = useCreateBlock();
  const update = useUpdateBlock();
  const report = useReportError();
  const [panel, setPanel] = useState<{ target: PanelTarget; key: number } | null>(null);
  const open = (target: PanelTarget) => setPanel((current) => ({ target, key: (current?.key ?? 0) + 1 }));

  if (settings.isError) return <LoadError what="the schedule" error={settings.error} onRetry={() => void settings.refetch()} />;
  if (blocks.isError) return <LoadError what="deep work" error={blocks.error} onRetry={() => void blocks.refetch()} />;
  if (!settings.data || !blocks.data) return <p className="text-ink-muted">Loading deep work…</p>;

  const proposals = withoutPlaced(defaultBlocksFor(weekStartDate, settings.data), blocks.data).filter((proposal) => proposal.date >= today);
  const active = outcomes.filter((outcome) => outcome.slot !== null && outcome.status === 'active');
  const flagged = active.filter((outcome) => !blocks.data.some((block) => block.outcomeId === outcome.id));
  const pick = (target: GridTarget) => open(target);

  const save = (fields: PanelFields) => {
    if (!panel) return;
    const settle = { onSuccess: () => setPanel(null), onError: report('save the block') };
    const { target } = panel;
    if (target.kind === 'block') {
      update.mutate({ id: target.block.id, patch: { plannedStart: fields.plannedStart, plannedMinutes: fields.plannedMinutes, outcomeId: fields.outcomeId } }, settle);
      return;
    }
    const date = target.kind === 'proposal' ? target.proposal.date : target.date;
    create.mutate({ date, context: fields.context, plannedStart: fields.plannedStart, plannedMinutes: fields.plannedMinutes, outcomeId: fields.outcomeId }, settle);
  };

  return (
    <section aria-label="Deep work" className="space-y-3">
      <h2 className="text-xl font-medium">Deep work</h2>
      <WeekGrid weekStartDate={weekStartDate} blocks={blocks.data} proposals={proposals} outcomes={outcomes} onSelect={pick} onAdd={(date) => open({ kind: 'new', date })} />
      {panel && <BlockPanel key={panel.key} target={panel.target} outcomes={outcomes} pending={create.isPending || update.isPending} onSave={save} onClose={() => setPanel(null)} />}
      {flagMissing && active.length > 0 && <p className="text-sm text-ink-muted">{flagged.length > 0 ? `No time yet: ${flagged.map((outcome) => outcome.title).join(', ')}` : 'Every outcome has time.'}</p>}
    </section>
  );
}
