import { z } from 'zod';
import { calendarDateSchema, fields, REVIEW_DISPOSITIONS, REVIEW_GRADES, reviewReasonSchema, taskSchema } from './schemas';
import { mustShipSchema, mustShipStatusSchema } from './todaySchemas';

/** Shutdown, the scoreboard and the Friday review (Phase 6). Every body, query and result of those routes is parsed by one of these. */

const { uuid, timestamp, longText } = fields;
const count = z.number().int().nonnegative();
const fraction = z.object({ shipped: count, total: count });

/** The week's numbers (spec B "Scoreboard"); the strip holds one entry per work day, in order. */
export const scoreboardSchema = z.object({
  weekId: uuid,
  startDate: calendarDateSchema,
  reviewedAt: timestamp.nullable(),
  outcomes: fraction,
  mustShips: fraction,
  deepWorkMinutes: count,
  rolledForward: count,
  killed: count,
  delegated: count,
  strip: z.array(z.object({ date: calendarDateSchema, status: mustShipStatusSchema.nullable() })),
});
export type Scoreboard = z.infer<typeof scoreboardSchema>;

/** Earlier weeks than the one containing `before`, newest first. */
export const weekHistoryQuerySchema = z.strictObject({ before: calendarDateSchema });

/** Stamping a week reviewed can keep a note (weeks.review_notes). */
export const weekReviewSchema = z.strictObject({ notes: longText.default('') });
export type WeekReviewInput = z.input<typeof weekReviewSchema>;

/** A route that takes no fields still parses its body, so a stray field is refused as it is everywhere else. */
export const emptyBodySchema = z.strictObject({});

const owner = z.string().trim().min(1, 'owner is required').max(120, 'owner is too long');
const DONE_ONLY = ['reason', 'disposition', 'date', 'owner', 'followUpDate'] as const;

/**
 * One outcome's Friday grade (spec C "Friday review"): done stands alone; partial and missed need a reason and a
 * disposition. A reschedule carries the date the outcome moves to; a delegation carries the owner and a follow-up date.
 */
export const outcomeReviewSchema = z
  .strictObject({
    grade: z.enum(REVIEW_GRADES),
    reason: reviewReasonSchema.optional(),
    disposition: z.enum(REVIEW_DISPOSITIONS).optional(),
    date: calendarDateSchema.optional(),
    owner: owner.optional(),
    followUpDate: calendarDateSchema.optional(),
  })
  .superRefine((body, context) => {
    const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message });
    if (body.grade === 'done') {
      for (const key of DONE_ONLY) if (body[key] !== undefined) issue(key, 'a done outcome takes no reason or disposition');
      return;
    }
    if (body.reason === undefined) issue('reason', 'a partial or missed outcome needs a reason');
    if (body.disposition === undefined) issue('disposition', 'choose roll, reschedule, delegate or kill');
    if ((body.disposition === 'reschedule') !== (body.date !== undefined)) issue('date', 'a reschedule, and only a reschedule, takes a date');
    const delegating = body.disposition === 'delegate';
    if (delegating && (body.owner === undefined || body.followUpDate === undefined)) issue('owner', 'a delegation needs an owner and a follow-up date');
    if (!delegating && (body.owner !== undefined || body.followUpDate !== undefined)) issue('owner', 'only a delegation takes an owner');
  });
export type OutcomeReview = z.infer<typeof outcomeReviewSchema>;

/** What blocking a Must Ship from Shutdown returns: the Must Ship and the waiting task filed for the next action. */
export const mustShipBlockResultSchema = z.object({ mustShip: mustShipSchema, task: taskSchema });
export type MustShipBlockResult = z.infer<typeof mustShipBlockResultSchema>;
