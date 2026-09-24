import type { Settings, Task } from '../shared/exec/schemas';

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
