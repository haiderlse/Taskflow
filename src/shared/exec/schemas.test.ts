import { describe, it, expect } from 'vitest';
import { taskCreateSchema, taskPatchSchema, taskRollSchema, taskListQuerySchema, settingsSchema, taskSchema, outcomeCreateSchema, outcomePatchSchema, outcomeRollSchema, weekQuerySchema, projectCreateSchema, projectPatchSchema, outcomeSchema } from './schemas';

const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.path.join('.'));

describe('taskCreateSchema', () => {
  it('trims the title, defaults notes and keeps the context', () => {
    expect(taskCreateSchema.parse({ title: '  Call the supplier ', context: 'work' })).toEqual({
      title: 'Call the supplier',
      context: 'work',
      notes: '',
    });
  });

  it('rejects an empty or oversized title, an unknown context and unknown keys', () => {
    expect(issuePaths(taskCreateSchema.safeParse({ title: '   ', context: 'work' }))).toEqual(['title']);
    expect(issuePaths(taskCreateSchema.safeParse({ title: 'x'.repeat(201), context: 'work' }))).toEqual(['title']);
    expect(issuePaths(taskCreateSchema.safeParse({ title: 'ok', context: 'home' }))).toEqual(['context']);
    expect(issuePaths(taskCreateSchema.safeParse({ title: 'ok', context: 'work', status: 'done' }))).toEqual(['']);
  });
});

describe('taskPatchSchema', () => {
  it('accepts a partial patch with null dates and rejects an empty one', () => {
    expect(taskPatchSchema.parse({ status: 'later', scheduledDate: null })).toEqual({ status: 'later', scheduledDate: null });
    expect(taskPatchSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an impossible calendar date, a blank owner and a non-uuid project', () => {
    expect(issuePaths(taskPatchSchema.safeParse({ scheduledDate: '2026-02-30' }))).toEqual(['scheduledDate']);
    expect(issuePaths(taskPatchSchema.safeParse({ ownerName: '   ' }))).toEqual(['ownerName']);
    expect(issuePaths(taskPatchSchema.safeParse({ projectId: 'proj-1' }))).toEqual(['projectId']);
  });
});

describe('taskRollSchema and taskListQuerySchema', () => {
  it('parses a roll date and a comma-separated status list', () => {
    expect(taskRollSchema.parse({ date: '2026-09-23' })).toEqual({ date: '2026-09-23' });
    expect(taskListQuerySchema.parse({ status: 'inbox, later', context: 'work' })).toEqual({
      status: ['inbox', 'later'],
      context: 'work',
    });
    expect(taskListQuerySchema.parse({})).toEqual({});
  });

  it('rejects an unknown status, a bad week date and an unknown query key', () => {
    expect(taskListQuerySchema.safeParse({ status: 'inbox,someday' }).success).toBe(false);
    expect(taskListQuerySchema.safeParse({ week: '2026-9-20' }).success).toBe(false);
    expect(taskListQuerySchema.safeParse({ page: '2' }).success).toBe(false);
  });
});

describe('settingsSchema and taskSchema', () => {
  it('accepts the seeded defaults once the JSON columns are decoded', () => {
    expect(
      settingsSchema.safeParse({
        timezone: 'Asia/Karachi',
        weekStartDay: 0,
        workDays: [1, 2, 3, 4, 5],
        deepWorkStart: '08:35',
        deepWorkMinutes: 90,
        shutdownTime: '17:00',
        officeStart: '08:15',
        officeEnd: '18:00',
        buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }],
      }).success
    ).toBe(true);
  });

  it('rejects a task row with a malformed timestamp', () => {
    const row = {
      id: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f',
      title: 'x',
      notes: '',
      context: 'work',
      status: 'inbox',
      projectId: null,
      outcomeId: null,
      mustShipId: null,
      scheduledDate: null,
      dueDate: null,
      ownerName: null,
      expectedOutput: null,
      followUpDate: null,
      rollCount: 0,
      rolledAt: null,
      capturedAt: 'yesterday',
      processedAt: null,
      delegatedAt: null,
      closedAt: null,
      createdAt: '2026-09-22T03:00:00.000Z',
      updatedAt: '2026-09-22T03:00:00.000Z',
    };
    expect(issuePaths(taskSchema.safeParse(row))).toEqual(['capturedAt']);
    expect(taskSchema.safeParse({ ...row, capturedAt: row.createdAt }).success).toBe(true);
  });
});

describe('outcome schemas', () => {
  it('trims the title and fills defaults on create', () => {
    expect(outcomeCreateSchema.parse({ title: '  Supplier plan confirmed ', category: 'office' })).toEqual({
      title: 'Supplier plan confirmed',
      category: 'office',
      description: '',
      definitionOfDone: '',
      targetDate: null,
      projectId: null,
      notes: '',
    });
  });

  it('accepts a replace instruction and rejects a bad one', () => {
    const replace = { outcomeId: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f', reason: 'priority_changed' };
    expect(outcomeCreateSchema.parse({ title: 'x', category: 'career', replace }).replace).toEqual(replace);
    expect(issuePaths(outcomeCreateSchema.safeParse({ title: 'x', category: 'career', replace: { ...replace, reason: 'bored' } }))).toEqual(['replace.reason']);
  });

  it('rejects an unknown category, a blank title and unknown keys', () => {
    expect(issuePaths(outcomeCreateSchema.safeParse({ title: 'x', category: 'hobby' }))).toEqual(['category']);
    expect(issuePaths(outcomeCreateSchema.safeParse({ title: ' ', category: 'office' }))).toEqual(['title']);
    expect(issuePaths(outcomeCreateSchema.safeParse({ title: 'x', category: 'office', slot: 4 }))).toEqual(['']);
  });

  it('patches partially, bounds progress and never accepts a slot or timestamp', () => {
    expect(outcomePatchSchema.parse({ progress: 60 })).toEqual({ progress: 60 });
    expect(outcomePatchSchema.safeParse({}).success).toBe(false);
    expect(issuePaths(outcomePatchSchema.safeParse({ progress: 101 }))).toEqual(['progress']);
    expect(outcomePatchSchema.safeParse({ slot: 1 }).success).toBe(false);
    expect(outcomePatchSchema.safeParse({ closedAt: '2026-09-22T03:00:00.000Z' }).success).toBe(false);
  });

  it('rolls into a week by id and looks weeks up by a calendar date', () => {
    expect(outcomeRollSchema.safeParse({ weekId: 'w1' }).success).toBe(false);
    expect(weekQuerySchema.parse({ date: '2026-09-22' })).toEqual({ date: '2026-09-22' });
    expect(weekQuerySchema.safeParse({ date: '2026-09-31' }).success).toBe(false);
  });

  it('parses an outcome row as the server returns it', () => {
    const row = {
      id: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f',
      weekId: '5f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f',
      slot: 1,
      title: 'x',
      description: '',
      category: 'office',
      definitionOfDone: '',
      targetDate: '2026-09-25',
      projectId: null,
      progress: 0,
      status: 'active',
      reviewGrade: null,
      reviewReason: null,
      reviewDisposition: null,
      rolledFromId: null,
      notes: '',
      closedAt: null,
      createdAt: '2026-09-22T03:00:00.000Z',
      updatedAt: '2026-09-22T03:00:00.000Z',
    };
    expect(outcomeSchema.safeParse(row).success).toBe(true);
    expect(outcomeSchema.safeParse({ ...row, slot: 4 }).success).toBe(false);
  });
});

describe('project schemas', () => {
  it('creates with a trimmed name and patches the status', () => {
    expect(projectCreateSchema.parse({ name: ' Supply plan ', context: 'work' })).toEqual({ name: 'Supply plan', context: 'work', notes: '' });
    expect(projectPatchSchema.parse({ status: 'archived' })).toEqual({ status: 'archived' });
    expect(issuePaths(projectPatchSchema.safeParse({ status: 'paused' }))).toEqual(['status']);
    expect(projectPatchSchema.safeParse({}).success).toBe(false);
  });
});
