import { z } from 'zod';
import { isCalendarDate } from './dates';

/** Every body and query of /api/exec is parsed by one of these before anything else runs. */

export const CONTEXTS = ['work', 'build'] as const;
export const contextSchema = z.enum(CONTEXTS);
export type Context = z.infer<typeof contextSchema>;

export const TASK_STATUSES = ['inbox', 'this_week', 'later', 'delegated', 'waiting', 'done', 'killed'] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export const OPEN_STATUSES: readonly TaskStatus[] = ['inbox', 'this_week', 'later', 'delegated', 'waiting'];
export const WAITING_STATUSES: readonly TaskStatus[] = ['delegated', 'waiting'];

export const calendarDateSchema = z.string().refine(isCalendarDate, 'expected a calendar date YYYY-MM-DD');
const timestamp = z.iso.datetime();
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM');
const uuid = z.uuid();
const title = z.string().trim().min(1, 'title is required').max(200, 'title is too long');
const notes = z.string().max(4000, 'notes are too long');

export const taskSchema = z.object({
  id: uuid,
  title,
  notes,
  context: contextSchema,
  status: taskStatusSchema,
  projectId: uuid.nullable(),
  outcomeId: uuid.nullable(),
  mustShipId: uuid.nullable(),
  scheduledDate: calendarDateSchema.nullable(),
  dueDate: calendarDateSchema.nullable(),
  ownerName: z.string().nullable(),
  expectedOutput: z.string().nullable(),
  followUpDate: calendarDateSchema.nullable(),
  rollCount: z.number().int().nonnegative(),
  rolledAt: timestamp.nullable(),
  capturedAt: timestamp,
  processedAt: timestamp.nullable(),
  delegatedAt: timestamp.nullable(),
  closedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Task = z.infer<typeof taskSchema>;

/** Capture: a title and a context, nothing else. Status is always inbox. */
export const taskCreateSchema = z.strictObject({
  title,
  context: contextSchema,
  notes: notes.default(''),
});
export type TaskCreate = z.infer<typeof taskCreateSchema>;

/** Processing and disposition. Timestamps are never client-writable. */
export const taskPatchSchema = z
  .strictObject({
    title: title.optional(),
    notes: notes.optional(),
    context: contextSchema.optional(),
    status: taskStatusSchema.optional(),
    projectId: uuid.nullable().optional(),
    outcomeId: uuid.nullable().optional(),
    mustShipId: uuid.nullable().optional(),
    scheduledDate: calendarDateSchema.nullable().optional(),
    dueDate: calendarDateSchema.nullable().optional(),
    ownerName: z.string().trim().min(1, 'owner is required').max(120).nullable().optional(),
    expectedOutput: z.string().max(2000).nullable().optional(),
    followUpDate: calendarDateSchema.nullable().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export const taskRollSchema = z.strictObject({ date: calendarDateSchema });
export type TaskRoll = z.infer<typeof taskRollSchema>;

const statusList = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()).filter(Boolean))
  .pipe(z.array(taskStatusSchema).min(1));

export const taskListQuerySchema = z.strictObject({
  status: statusList.optional(),
  context: contextSchema.optional(),
  week: calendarDateSchema.optional(),
  followUpBy: calendarDateSchema.optional(),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

const weekday = z.number().int().min(0).max(6);

export const settingsSchema = z.object({
  timezone: z.string().min(1),
  weekStartDay: weekday,
  workDays: z.array(weekday),
  deepWorkStart: hhmm,
  deepWorkMinutes: z.number().int().positive(),
  shutdownTime: hhmm,
  officeStart: hhmm,
  officeEnd: hhmm,
  buildBlocks: z.array(z.object({ weekday, start: hhmm, minutes: z.number().int().positive() })),
});
export type Settings = z.infer<typeof settingsSchema>;

export const PROJECT_STATUSES = ['active', 'done', 'archived'] as const;
export const projectStatusSchema = z.enum(PROJECT_STATUSES);
export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export const projectSchema = z.object({
  id: uuid,
  name: z.string(),
  context: contextSchema,
  status: projectStatusSchema,
  notes: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Project = z.infer<typeof projectSchema>;

// ---- Weeks, outcomes and projects (Phase 3) ----

export const OUTCOME_CATEGORIES = ['office', 'business', 'career', 'personal'] as const;
export const outcomeCategorySchema = z.enum(OUTCOME_CATEGORIES);
export type OutcomeCategory = z.infer<typeof outcomeCategorySchema>;

export const OUTCOME_STATUSES = ['active', 'done', 'killed'] as const;
const outcomeStatusSchema = z.enum(OUTCOME_STATUSES);
export type OutcomeStatus = z.infer<typeof outcomeStatusSchema>;

export const REVIEW_GRADES = ['done', 'partial', 'missed'] as const;
export const REVIEW_REASONS = [
  'insufficient_time',
  'unexpected_urgent_work',
  'dependency_blocker',
  'poor_estimation',
  'too_many_meetings',
  'priority_changed',
  'procrastination',
  'unclear_outcome',
  'delegated_dependency',
  'no_longer_important',
  'other',
] as const;
export const reviewReasonSchema = z.enum(REVIEW_REASONS);
export type ReviewReason = z.infer<typeof reviewReasonSchema>;
export const REVIEW_DISPOSITIONS = ['roll_forward', 'reschedule', 'delegate', 'kill'] as const;

const outcomeTitle = z.string().trim().min(1, 'title is required').max(200, 'title is too long');
const longText = z.string().max(4000, 'text is too long');

export const weekSchema = z.object({
  id: uuid,
  startDate: calendarDateSchema,
  reviewedAt: timestamp.nullable(),
  reviewNotes: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Week = z.infer<typeof weekSchema>;

export const outcomeSchema = z.object({
  id: uuid,
  weekId: uuid,
  slot: z.number().int().min(1).max(3).nullable(),
  title: z.string(),
  description: z.string(),
  category: outcomeCategorySchema,
  definitionOfDone: z.string(),
  targetDate: calendarDateSchema.nullable(),
  projectId: uuid.nullable(),
  progress: z.number().int().min(0).max(100),
  status: outcomeStatusSchema,
  reviewGrade: z.enum(REVIEW_GRADES).nullable(),
  reviewReason: reviewReasonSchema.nullable(),
  reviewDisposition: z.enum(REVIEW_DISPOSITIONS).nullable(),
  rolledFromId: uuid.nullable(),
  notes: z.string(),
  closedAt: timestamp.nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Outcome = z.infer<typeof outcomeSchema>;

export const weekViewSchema = z.object({ week: weekSchema, outcomes: z.array(outcomeSchema) });
export type WeekView = z.infer<typeof weekViewSchema>;

export const weekLookupSchema = z.object({
  current: weekViewSchema.nullable(),
  previous: weekViewSchema.nullable(),
  hasHistory: z.boolean(),
});
export type WeekLookup = z.infer<typeof weekLookupSchema>;

export const weekQuerySchema = z.strictObject({ date: calendarDateSchema });
export const weekCreateSchema = z.strictObject({ date: calendarDateSchema });

export const outcomeCreateSchema = z.strictObject({
  title: outcomeTitle,
  category: outcomeCategorySchema,
  description: longText.default(''),
  definitionOfDone: longText.default(''),
  targetDate: calendarDateSchema.nullable().default(null),
  projectId: uuid.nullable().default(null),
  notes: longText.default(''),
  replace: z.strictObject({ outcomeId: uuid, reason: reviewReasonSchema }).optional(),
});
export type OutcomeCreate = z.infer<typeof outcomeCreateSchema>;
export type OutcomeInput = z.input<typeof outcomeCreateSchema>;

/** Slot, lineage and timestamps are never client-writable; status changes set them. */
export const outcomePatchSchema = z
  .strictObject({
    title: outcomeTitle.optional(),
    description: longText.optional(),
    category: outcomeCategorySchema.optional(),
    definitionOfDone: longText.optional(),
    targetDate: calendarDateSchema.nullable().optional(),
    projectId: uuid.nullable().optional(),
    progress: z.number().int().min(0).max(100).optional(),
    status: outcomeStatusSchema.optional(),
    reviewGrade: z.enum(REVIEW_GRADES).nullable().optional(),
    reviewReason: reviewReasonSchema.nullable().optional(),
    reviewDisposition: z.enum(REVIEW_DISPOSITIONS).nullable().optional(),
    notes: longText.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type OutcomePatch = z.infer<typeof outcomePatchSchema>;

export const outcomeRollSchema = z.strictObject({ weekId: uuid });

export const projectCreateSchema = z.strictObject({
  name: z.string().trim().min(1, 'name is required').max(120, 'name is too long'),
  context: contextSchema,
  notes: longText.default(''),
});
export type ProjectCreate = z.infer<typeof projectCreateSchema>;
export type ProjectInput = z.input<typeof projectCreateSchema>;

export const projectPatchSchema = z
  .strictObject({
    name: z.string().trim().min(1, 'name is required').max(120, 'name is too long').optional(),
    context: contextSchema.optional(),
    status: projectStatusSchema.optional(),
    notes: longText.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, 'nothing to change');
export type ProjectPatch = z.infer<typeof projectPatchSchema>;

export const projectSummarySchema = projectSchema.extend({
  activeOutcomes: z.number().int().nonnegative(),
  openTasks: z.number().int().nonnegative(),
  mustShipCandidates: z.number().int().nonnegative(),
});
export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const projectDetailSchema = z.object({
  project: projectSchema,
  outcomes: z.array(outcomeSchema.extend({ weekStartDate: calendarDateSchema })),
  tasks: z.array(taskSchema),
});
export type ProjectDetail = z.infer<typeof projectDetailSchema>;

/** The field primitives, for schema modules that live beside this one (todaySchemas.ts). */
export const fields = { uuid, timestamp, hhmm, weekday, title: outcomeTitle, longText };
