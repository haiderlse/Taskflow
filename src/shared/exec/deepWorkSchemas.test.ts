import { describe, it, expect } from 'vitest';
import { deepWorkCreateSchema, deepWorkFinishSchema, deepWorkPatchSchema, deepWorkQuerySchema } from './deepWorkSchemas';

const BASE = { date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 };
const BLOCKER = { what: 'Supplier has not replied', owner: 'Bilal', nextAction: 'Call Bilal about the tracker' };

describe('deepWorkCreateSchema', () => {
  it('fills the links with null', () => {
    expect(deepWorkCreateSchema.parse(BASE)).toEqual({ ...BASE, outcomeId: null, mustShipId: null });
  });

  it('bounds the length, the start and the context', () => {
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedMinutes: 14 }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedMinutes: 601 }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedMinutes: 90.5 }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedStart: '8:35' }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, plannedStart: '24:00' }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, context: 'home' }).success).toBe(false);
  });

  it('never lets a client write timestamps or a result', () => {
    expect(deepWorkCreateSchema.safeParse({ ...BASE, startedAt: '2026-09-29T03:35:00.000Z' }).success).toBe(false);
    expect(deepWorkCreateSchema.safeParse({ ...BASE, result: 'completed' }).success).toBe(false);
  });
});

describe('deepWorkPatchSchema', () => {
  it('takes only the planning fields, and at least one', () => {
    expect(deepWorkPatchSchema.parse({ plannedMinutes: 60 })).toEqual({ plannedMinutes: 60 });
    expect(deepWorkPatchSchema.safeParse({}).success).toBe(false);
    expect(deepWorkPatchSchema.safeParse({ date: '2026-09-30' }).success).toBe(false);
    expect(deepWorkPatchSchema.safeParse({ context: 'build' }).success).toBe(false);
    expect(deepWorkPatchSchema.safeParse({ pausedSeconds: 5 }).success).toBe(false);
  });
});

describe('deepWorkQuerySchema', () => {
  it('reads a range and refuses a backwards or oversized one', () => {
    expect(deepWorkQuerySchema.parse({ from: '2026-09-27', to: '2026-10-03' })).toEqual({ from: '2026-09-27', to: '2026-10-03' });
    const backwards = deepWorkQuerySchema.safeParse({ from: '2026-10-03', to: '2026-09-27' });
    expect(backwards.success).toBe(false);
    expect(backwards.error?.issues[0]).toMatchObject({ path: ['to'], message: 'from must not be after to' });
    expect(deepWorkQuerySchema.safeParse({ from: '2026-01-01', to: '2026-03-05' }).error?.issues[0]).toMatchObject({ message: 'at most 62 days at a time' });
    expect(deepWorkQuerySchema.safeParse({ from: '2026-01-01' }).success).toBe(false);
  });
});

describe('deepWorkFinishSchema', () => {
  it('takes the three plain results without a blocker, with empty notes by default', () => {
    for (const result of ['completed', 'progress', 'abandoned']) {
      expect(deepWorkFinishSchema.parse({ result })).toEqual({ result, notes: '' });
    }
  });

  it('needs the whole blocker to be blocked, trims it, and refuses a blocker on any other result', () => {
    expect(deepWorkFinishSchema.parse({ result: 'blocked', blocker: { what: ' Supplier silent ', owner: ' Bilal ', nextAction: ' Call them ' } })).toEqual({
      result: 'blocked',
      notes: '',
      blocker: { what: 'Supplier silent', owner: 'Bilal', nextAction: 'Call them' },
    });
    const missing = deepWorkFinishSchema.safeParse({ result: 'blocked' });
    expect(missing.error?.issues[0]).toMatchObject({ path: ['blocker'], message: 'a blocked session needs what blocks it, who owns it and the next action' });
    expect(deepWorkFinishSchema.safeParse({ result: 'completed', blocker: BLOCKER }).error?.issues[0]).toMatchObject({ message: 'only a blocked session carries a blocker' });
  });

  it('refuses an empty or oversized blocker field', () => {
    expect(deepWorkFinishSchema.safeParse({ result: 'blocked', blocker: { ...BLOCKER, owner: '   ' } }).success).toBe(false);
    expect(deepWorkFinishSchema.safeParse({ result: 'blocked', blocker: { ...BLOCKER, nextAction: 'x'.repeat(201) } }).success).toBe(false);
    expect(deepWorkFinishSchema.safeParse({ result: 'blocked', blocker: { ...BLOCKER, extra: 'no' } }).success).toBe(false);
    expect(deepWorkFinishSchema.safeParse({ result: 'lost' }).success).toBe(false);
  });
});
