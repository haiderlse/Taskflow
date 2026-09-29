import { BLOCK_RESULT_LABELS } from '../../lib/labels';
import { addDays } from '../../shared/exec/dates';
import { blockBox, gridRange, type ProposedBlock } from '../../shared/exec/deepWork';
import { dayLabel } from '../../shared/exec/today';
import type { Outcome } from '../../shared/exec/schemas';
import type { DeepWorkBlock } from '../../shared/exec/todaySchemas';

export type GridTarget = { kind: 'block'; block: DeepWorkBlock } | { kind: 'proposal'; proposal: ProposedBlock };

type Props = {
  weekStartDate: string;
  blocks: DeepWorkBlock[];
  proposals: ProposedBlock[];
  outcomes: Outcome[];
  onSelect: (target: GridTarget) => void;
  onAdd: (date: string) => void;
};

const TONES = {
  saved: 'bg-ink text-paper dark:bg-paper dark:text-ink',
  suggested: 'border border-dashed border-ink-muted text-ink-muted',
  done: 'border border-line bg-paper-raised text-ink-muted dark:border-ink-muted dark:bg-ink',
};

const shortDay = (date: string): string => `${dayLabel(date).slice(0, 3)} ${Number(date.slice(8))}`;

type CellProps = { label: string; text: string; tone: keyof typeof TONES; box: { top: number; height: number }; onClick: () => void };

function Cell({ label, text, tone, box, onClick }: CellProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      style={{ top: `${box.top}%`, height: `${box.height}%` }}
      className={`absolute inset-x-0.5 overflow-hidden rounded px-1 text-left text-xs ${TONES[tone]}`}
    >
      {text}
    </button>
  );
}

function statusOf(block: DeepWorkBlock): string {
  if (block.endedAt !== null) return `, ${block.result ? BLOCK_RESULT_LABELS[block.result] : 'finished'}`;
  return block.startedAt !== null ? ', running' : '';
}

/** Spec C "Week" item 4: seven columns over the day's hours. A block is saved, a suggestion is dashed. */
export function WeekGrid({ weekStartDate, blocks, proposals, outcomes, onSelect, onAdd }: Props) {
  const range = gridRange([...blocks, ...proposals]);
  const titles = new Map(outcomes.map((outcome) => [outcome.id, outcome.title]));
  const days = Array.from({ length: 7 }, (_, offset) => addDays(weekStartDate, offset));
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] grid-cols-7 gap-1">
        {days.map((date) => (
          <section key={date} aria-label={dayLabel(date)} className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase tracking-wide text-ink-muted">{shortDay(date)}</h3>
              <button type="button" aria-label={`Add a block on ${dayLabel(date)}`} onClick={() => onAdd(date)} className="px-1 text-xs text-ink-muted hover:text-ink">+</button>
            </div>
            <div className="relative h-[36rem] rounded border border-line dark:border-ink-muted">
              {blocks.filter((block) => block.date === date).map((block) => {
                const title = block.outcomeId ? titles.get(block.outcomeId) ?? null : null;
                return (
                  <Cell
                    key={block.id}
                    tone={block.endedAt !== null ? 'done' : 'saved'}
                    box={blockBox(block.plannedStart, block.plannedMinutes, range)}
                    label={`${dayLabel(date)} ${block.plannedStart}, ${block.plannedMinutes} minutes, ${title ?? 'no outcome'}${statusOf(block)}`}
                    text={`${block.plannedStart} ${title ?? ''}`}
                    onClick={() => onSelect({ kind: 'block', block })}
                  />
                );
              })}
              {proposals.filter((proposal) => proposal.date === date).map((proposal) => (
                <Cell
                  key={`${proposal.context}-${proposal.plannedStart}`}
                  tone="suggested"
                  box={blockBox(proposal.plannedStart, proposal.plannedMinutes, range)}
                  label={`${dayLabel(date)} ${proposal.plannedStart}, ${proposal.plannedMinutes} minutes, no outcome, suggested`}
                  text={`${proposal.plannedStart} ${proposal.context === 'build' ? 'Build' : 'Work'}`}
                  onClick={() => onSelect({ kind: 'proposal', proposal })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
