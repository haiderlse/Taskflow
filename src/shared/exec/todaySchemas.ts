import { z } from 'zod';
import { calendarDateSchema, contextSchema, fields, taskSchema, weekViewSchema } from './schemas';

/** Must Ships, days and the schedule (Phase 4). Every body, query and path of those routes is parsed by one of these. */

const { uuid, timestamp, hhmm, weekday, title: outcomeTitle, longText } = fields;

export const MUST_SHIP_STATUSES = ['planned', 'shipped', 'partial', 'missed', 'blocked', 'killed'] as const;
export const mustShipStatusSchema = z.enum(MUST_SHIP_STATUSES);
export type MustShipStatus = z.infer<typeof mustShipStatusSchema>;

export const mustShipSchema = z.object({
  id: uuid,
  title: z.string(),
  definitionOfDone: z.string(),
  context: contextSchema,
  date: calendarDateSchema.nullable(),
  outcomeId: uuid.nullable(),
  projectId: uuid.nullable(),
  status: mustShipStatusSchema,
  blockerWhat: z.string().nullable(),
  blockerOwner: z.string().nullable(),
  blockerNextAction: z.string().nullable(),
  notes: z.string(),
  rolledFromId: uuid.nullable(),
  rollCount: z.number().int().nonnegative(),
  closedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type MustShip = z.infer<typeof mustShipSchema>;

/** A dated Must Ship holds its day; an undated one is a candidate (§17). Context is explicit; the UI defaults it. */
export const mustShipCreateSchema = z.strictObject({
  title: outcomeTitle,
  context: contextSchema,
  date: calendarDateSchema.nullable().default(null),
  definitionOfDone: longText.default(''),
  outcomeId: uuid.nullable().default(null),
  projectId: uuid.nullable().default(null),
  notes: longText.default(''),
});
export type MustShipCreate = z.infer<typeof mustShipCreateSchema>;
export type MustShipInput = z.input<typeof mustShipCreateSchema>;

const blockerText = z.string().trim().min(1, 'required').max(500, 'too long');

/** Lineage, roll counts and timestamps are never client-writable; a status change sets closedAt. */
export const mustShipPatchSchema = z
  .strictObject({
    title: outcomeTitle.optional(),
    definitionOfDone: longText.optional(),
    context: contextSchema.optional(),
    date: calendarDateSchema.nullable().optional(),
    outcomeId: uuid.nullable().optional(),
    projectId: uuid.nullable().optional(),
    status: mustShipStatusSchema.optional(),
    blockerWhat: blockerText.nullable().optional(),
    blockerOwner: blockerText.nullable().optional(),
    blockerNextAction: blockerText.nullable().optional(),
    notes: longText.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type MustShipPatch = z.infer<typeof mustShipPatchSchema>;

export const mustShipRollSchema = z.strictObject({ date: calendarDateSchema });

const mustShipStatusList = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()).filter(Boolean))
  .pipe(z.array(mustShipStatusSchema).min(1));

/** `date=none` selects candidates; `week` is any day of the planning week it names. */
export const mustShipQuerySchema = z.strictObject({
  date: z.union([calendarDateSchema, z.literal('none')]).optional(),
  week: calendarDateSchema.optional(),
  status: mustShipStatusList.optional(),
  outcome: uuid.optional(),
  project: uuid.optional(),
  context: contextSchema.optional(),
});
export type MustShipQuery = z.infer<typeof mustShipQuerySchema>;

export const daySchema = z.object({
  date: calendarDateSchema,
  shutdownAt: timestamp.nullable(),
  notes: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Day = z.infer<typeof daySchema>;

export const BLOCK_RESULTS = ['completed', 'progress', 'blocked', 'abandoned'] as const;

export const deepWorkBlockSchema = z.object({
  id: uuid,
  date: calendarDateSchema,
  context: contextSchema,
  plannedStart: hhmm,
  plannedMinutes: z.number().int().positive(),
  outcomeId: uuid.nullable(),
  mustShipId: uuid.nullable(),
  startedAt: timestamp.nullable(),
  endedAt: timestamp.nullable(),
  pausedSeconds: z.number().int().nonnegative(),
  pauseStartedAt: timestamp.nullable(),
  result: z.enum(BLOCK_RESULTS).nullable(),
  notes: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type DeepWorkBlock = z.infer<typeof deepWorkBlockSchema>;

export const secondarySchema = z.object({ slot: z.number().int().min(1).max(2), task: taskSchema });
export type Secondary = z.infer<typeof secondarySchema>;

/** The Today screen in one read (spec B, GET /days/:date). */
export const dayViewSchema = z.object({
  date: calendarDateSchema,
  day: daySchema.nullable(),
  week: weekViewSchema.nullable(),
  hasHistory: z.boolean(),
  mustShip: mustShipSchema.nullable(),
  buildMustShip: mustShipSchema.nullable(),
  secondaries: z.array(secondarySchema),
  waiting: z.array(taskSchema),
  blocks: z.array(deepWorkBlockSchema),
  inboxCount: z.number().int().nonnegative(),
});
export type DayView = z.infer<typeof dayViewSchema>;

export const dayParamsSchema = z.strictObject({ date: calendarDateSchema });

/** The limit of two is the store's to enforce, so it can answer SLOT_LIMIT; twenty only bounds the body. */
export const daySlotsSchema = z.strictObject({ taskIds: z.array(uuid).max(20) });

/** The editable schedule. The time zone and week start stay fixed in the MVP (spec "Assumptions in force"). */
export const settingsUpdateSchema = z
  .strictObject({
    workDays: z.array(weekday).max(7),
    deepWorkStart: hhmm,
    deepWorkMinutes: z.number().int().min(15).max(240),
    shutdownTime: hhmm,
    officeStart: hhmm,
    officeEnd: hhmm,
    buildBlocks: z.array(z.strictObject({ weekday, start: hhmm, minutes: z.number().int().min(15).max(600) })).max(14),
  })
  .refine((schedule) => new Set(schedule.workDays).size === schedule.workDays.length, { message: 'each work day once', path: ['workDays'] })
  .refine((schedule) => schedule.officeStart < schedule.officeEnd, { message: 'office hours must start before they end', path: ['officeEnd'] });
export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;
