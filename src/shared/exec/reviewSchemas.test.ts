import { describe, it, expect } from 'vitest';
import { emptyBodySchema, outcomeReviewSchema, scoreboardSchema, weekHistoryQuerySchema, weekReviewSchema } from './reviewSchemas';
import { ERROR_CODES } from './api';

const messages = (input: unknown): string[] => {
  const parsed = outcomeReviewSchema.safeParse(input);
  return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
};

describe('outcomeReviewSchema', () => {
  it('takes done on its own', () => {
    expect(outcomeReviewSchema.parse({ grade: 'done' })).toEqual({ grade: 'done' });
    expect(messages({ grade: 'done', reason: 'other' })).toEqual(['reason: a done outcome takes no reason or disposition']);
  });

  it('needs a reason and a disposition for partial and missed', () => {
    expect(messages({ grade: 'partial' })).toEqual([
      'reason: a partial or missed outcome needs a reason',
      'disposition: choose roll, reschedule, delegate or kill',
    ]);
    expect(outcomeReviewSchema.parse({ grade: 'missed', reason: 'procrastination', disposition: 'kill' })).toEqual({
      grade: 'missed',
      reason: 'procrastination',
      disposition: 'kill',
    });
    expect(outcomeReviewSchema.parse({ grade: 'partial', reason: 'insufficient_time', disposition: 'roll_forward' }).disposition).toBe('roll_forward');
  });

  it('takes a date only with a reschedule, and an owner and follow-up only with a delegation', () => {
    const slipped = { grade: 'partial', reason: 'insufficient_time' } as const;
    expect(messages({ ...slipped, disposition: 'reschedule' })).toEqual(['date: a reschedule, and only a reschedule, takes a date']);
    expect(messages({ ...slipped, disposition: 'kill', date: '2026-10-12' })).toEqual(['date: a reschedule, and only a reschedule, takes a date']);
    expect(outcomeReviewSchema.parse({ ...slipped, disposition: 'reschedule', date: '2026-10-12' }).date).toBe('2026-10-12');
    expect(messages({ ...slipped, disposition: 'delegate', owner: 'Bilal' })).toEqual(['owner: a delegation needs an owner and a follow-up date']);
    expect(messages({ ...slipped, disposition: 'roll_forward', owner: 'Bilal' })).toEqual(['owner: only a delegation takes an owner']);
    expect(outcomeReviewSchema.parse({ ...slipped, disposition: 'delegate', owner: '  Bilal ', followUpDate: '2026-10-05' }).owner).toBe('Bilal');
  });

  it('refuses unknown fields, unknown grades and a blank owner', () => {
    expect(outcomeReviewSchema.safeParse({ grade: 'done', extra: 1 }).success).toBe(false);
    expect(outcomeReviewSchema.safeParse({ grade: 'great' }).success).toBe(false);
    expect(
      outcomeReviewSchema.safeParse({ grade: 'missed', reason: 'other', disposition: 'delegate', owner: '  ', followUpDate: '2026-10-05' }).success
    ).toBe(false);
  });
});

describe('the other Phase 6 schemas', () => {
  it('defaults the review notes and refuses stray fields on an empty body', () => {
    expect(weekReviewSchema.parse({})).toEqual({ notes: '' });
    expect(emptyBodySchema.safeParse({}).success).toBe(true);
    expect(emptyBodySchema.safeParse({ date: '2026-09-29' }).success).toBe(false);
    expect(weekHistoryQuerySchema.safeParse({ before: '2026-02-30' }).success).toBe(false);
    expect(weekHistoryQuerySchema.parse({ before: '2026-09-29' })).toEqual({ before: '2026-09-29' });
  });

  it('describes a scoreboard with a nullable day strip status', () => {
    const board = {
      weekId: '20000000-0000-4000-8000-000000000001',
      startDate: '2026-09-27',
      reviewedAt: null,
      outcomes: { shipped: 1, total: 3 },
      mustShips: { shipped: 2, total: 5 },
      deepWorkMinutes: 90,
      rolledForward: 1,
      killed: 0,
      delegated: 2,
      strip: [
        { date: '2026-09-28', status: 'shipped' },
        { date: '2026-09-29', status: null },
      ],
    };
    expect(scoreboardSchema.safeParse(board).success).toBe(true);
    expect(scoreboardSchema.safeParse({ ...board, killed: -1 }).success).toBe(false);
  });

  it('adds REVIEW_NOT_READY to the error codes', () => {
    expect(ERROR_CODES).toContain('REVIEW_NOT_READY');
  });
});
