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

export const projectSchema = z.object({
  id: uuid,
  name: z.string(),
  context: contextSchema,
  status: z.enum(['active', 'done', 'archived']),
  notes: z.string(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Project = z.infer<typeof projectSchema>;
