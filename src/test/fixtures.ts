import type { Outcome, ProjectSummary, Settings, Task, Week, WeekLookup, WeekView } from '../shared/exec/schemas';

export const SETTINGS: Settings = {
  timezone: 'Asia/Karachi',
  weekStartDay: 0,
  workDays: [1, 2, 3, 4, 5],
  deepWorkStart: '08:35',
  deepWorkMinutes: 90,
  shutdownTime: '17:00',
  officeStart: '08:15',
  officeEnd: '18:00',
  buildBlocks: [
    { weekday: 2, start: '06:30', minutes: 50 },
    { weekday: 4, start: '06:30', minutes: 50 },
    { weekday: 6, start: '09:00', minutes: 180 },
  ],
};

let counter = 0;

/** A captured task with every field set the way the server returns it. */
export function makeTask(overrides: Partial<Task> = {}): Task {
  counter += 1;
  const stamp = `2026-09-22T03:${String(counter).padStart(2, '0')}:00.000Z`;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    title: `Task ${counter}`,
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
    capturedAt: stamp,
    processedAt: null,
    delegatedAt: null,
    closedAt: null,
    createdAt: stamp,
    updatedAt: stamp,
    ...overrides,
  };
}

export const WEEK_ID = '20000000-0000-4000-8000-000000000001';
const STAMP = '2026-09-20T03:00:00.000Z';

/** An outcome as the server returns it; slot 1 in the week of 20 Sep 2026 unless overridden. */
export function makeOutcome(overrides: Partial<Outcome> = {}): Outcome {
  counter += 1;
  return {
    id: `10000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    weekId: WEEK_ID,
    slot: 1,
    title: `Outcome ${counter}`,
    description: '',
    category: 'office',
    definitionOfDone: 'It exists',
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
    createdAt: STAMP,
    updatedAt: STAMP,
    ...overrides,
  };
}

export function makeWeekView(outcomes: Outcome[] = [], weekOverrides: Partial<Week> = {}): WeekView {
  return {
    week: { id: WEEK_ID, startDate: '2026-09-20', reviewedAt: null, reviewNotes: '', createdAt: STAMP, updatedAt: STAMP, ...weekOverrides },
    outcomes,
  };
}

export const makeLookup = (overrides: Partial<WeekLookup> = {}): WeekLookup => ({ current: null, previous: null, hasHistory: false, ...overrides });

export function makeProjectSummary(overrides: Partial<ProjectSummary> = {}): ProjectSummary {
  counter += 1;
  return {
    id: `30000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
    name: `Project ${counter}`,
    context: 'work',
    status: 'active',
    notes: '',
    createdAt: STAMP,
    updatedAt: STAMP,
    activeOutcomes: 0,
    openTasks: 0,
    ...overrides,
  };
}
