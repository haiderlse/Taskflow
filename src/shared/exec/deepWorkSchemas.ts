import { z } from 'zod';
import { addDays } from './dates';
import { calendarDateSchema, contextSchema, fields, taskSchema } from './schemas';
import { BLOCK_RESULTS, deepWorkBlockSchema, mustShipSchema } from './todaySchemas';

/** Deep-work blocks (Phase 5). Every body and query of /api/exec/deep-work is parsed by one of these. */

const { uuid, hhmm, longText } = fields;

const plannedMinutes = z.number().int().min(15).max(600);
const MAX_RANGE_DAYS = 62;

/** A planned block. Timestamps, pauses and the result are the server's: a client only plans. */
export const deepWorkCreateSchema = z.strictObject({
  date: calendarDateSchema,
  context: contextSchema,
  plannedStart: hhmm,
  plannedMinutes,
  outcomeId: uuid.nullable().default(null),
  mustShipId: uuid.nullable().default(null),
});
export type DeepWorkCreate = z.infer<typeof deepWorkCreateSchema>;
export type DeepWorkInput = z.input<typeof deepWorkCreateSchema>;

/** The date and context of a block are fixed; only its time and links move, and only before it starts. */
export const deepWorkPatchSchema = z
  .strictObject({
    plannedStart: hhmm.optional(),
    plannedMinutes: plannedMinutes.optional(),
    outcomeId: uuid.nullable().optional(),
    mustShipId: uuid.nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type DeepWorkPatch = z.infer<typeof deepWorkPatchSchema>;

export const deepWorkQuerySchema = z
  .strictObject({ from: calendarDateSchema, to: calendarDateSchema })
  .refine((range) => range.from <= range.to, { message: 'from must not be after to', path: ['to'] })
  .refine((range) => range.to <= addDays(range.from, MAX_RANGE_DAYS), { message: 'at most 62 days at a time', path: ['to'] });
export type DeepWorkQuery = z.infer<typeof deepWorkQuerySchema>;

/** The three answers a blocked session must give (spec C "Deep Work"); the next action becomes a task title. */
export const blockerSchema = z.strictObject({
  what: z.string().trim().min(1, 'required').max(500, 'too long'),
  owner: z.string().trim().min(1, 'required').max(120, 'too long'),
  nextAction: z.string().trim().min(1, 'required').max(200, 'too long'),
});
export type Blocker = z.infer<typeof blockerSchema>;

export const deepWorkFinishSchema = z
  .strictObject({ result: z.enum(BLOCK_RESULTS), notes: longText.default(''), blocker: blockerSchema.optional() })
  .superRefine((body, context) => {
    if (body.result === 'blocked' && !body.blocker) {
      context.addIssue({ code: 'custom', path: ['blocker'], message: 'a blocked session needs what blocks it, who owns it and the next action' });
    }
    if (body.result !== 'blocked' && body.blocker) {
      context.addIssue({ code: 'custom', path: ['blocker'], message: 'only a blocked session carries a blocker' });
    }
  });
export type DeepWorkFinish = z.infer<typeof deepWorkFinishSchema>;
export type DeepWorkFinishInput = z.input<typeof deepWorkFinishSchema>;

/** What finishing returns: the block, the Must Ship it settled, and the waiting task a blocker filed. */
export const finishResultSchema = z.object({
  block: deepWorkBlockSchema,
  mustShip: mustShipSchema.nullable(),
  task: taskSchema.nullable(),
});
export type FinishResult = z.infer<typeof finishResultSchema>;
