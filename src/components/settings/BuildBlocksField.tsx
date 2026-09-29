import type { Settings } from '../../shared/exec/schemas';
import { WEEKDAY_NAMES } from '../../lib/labels';

type Block = Settings['buildBlocks'][number];
type Props = { value: Block[]; onChange: (blocks: Block[]) => void };

const FIELD = 'rounded border border-line px-2 py-1 dark:border-ink-muted dark:bg-ink';

/** The build blocks (§16): a weekday, a start and a length each. Saturday 09:00 for two hours is the default for a new one. */
export function BuildBlocksField({ value, onChange }: Props) {
  const set = (index: number, patch: Partial<Block>) => onChange(value.map((block, at) => (at === index ? { ...block, ...patch } : block)));
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm">Build blocks</legend>
      {value.length === 0 && <p className="text-sm text-ink-muted">No build blocks.</p>}
      {value.map((block, index) => (
        <div key={index} className="flex flex-wrap items-center gap-2">
          <select aria-label={`Build block ${index + 1} day`} value={block.weekday} onChange={(e) => set(index, { weekday: Number(e.target.value) })} className={FIELD}>
            {WEEKDAY_NAMES.map((name, day) => <option key={name} value={day}>{name}</option>)}
          </select>
          <input type="time" aria-label={`Build block ${index + 1} start`} value={block.start} onChange={(e) => set(index, { start: e.target.value })} className={FIELD} />
          <input type="number" min={15} max={600} aria-label={`Build block ${index + 1} minutes`} value={block.minutes} onChange={(e) => set(index, { minutes: Number(e.target.value) })} className={`${FIELD} w-24`} />
          <button type="button" aria-label={`Remove build block ${index + 1}`} onClick={() => onChange(value.filter((_, at) => at !== index))} className="text-sm text-ink-muted">Remove</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...value, { weekday: 6, start: '09:00', minutes: 120 }])} className="rounded border border-line px-2 py-1 text-sm dark:border-ink-muted">
        Add a build block
      </button>
    </fieldset>
  );
}
