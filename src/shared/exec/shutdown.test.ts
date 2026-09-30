import { describe, it, expect } from 'vitest';
import { openAtShutdown } from './shutdown';
import { makeTask } from '../../test/fixtures';

const DATE = '2026-09-29';

describe('openAtShutdown', () => {
  it("keeps today's secondaries not done and the tasks scheduled today, each once", () => {
    const secondary = makeTask({ title: 'Memo', status: 'this_week', scheduledDate: DATE });
    const chosen = makeTask({ title: 'Captured and chosen', status: 'inbox' });
    const scheduled = makeTask({ title: 'Call the bank', status: 'this_week', scheduledDate: DATE });
    const done = makeTask({ title: 'Done already', status: 'done', scheduledDate: DATE });
    const open = openAtShutdown(DATE, [secondary, chosen, done], [secondary, scheduled], []);
    expect(open.tasks.map((task) => task.title)).toEqual(['Memo', 'Captured and chosen', 'Call the bank']);
    expect(open.waiting).toEqual([]);
  });

  it('drops a task moved to a later day, parked, handed off or closed', () => {
    const moved = makeTask({ status: 'this_week', scheduledDate: '2026-09-30' });
    const parked = makeTask({ status: 'later', scheduledDate: null });
    const parkedForToday = makeTask({ title: 'Parked for today', status: 'later', scheduledDate: DATE });
    const handed = makeTask({ status: 'delegated', ownerName: 'Bilal', scheduledDate: DATE, followUpDate: '2026-10-01' });
    const killed = makeTask({ status: 'killed', scheduledDate: DATE });
    const open = openAtShutdown(DATE, [moved, parked, handed], [parkedForToday, killed], []);
    expect(open.tasks.map((task) => task.title)).toEqual(['Parked for today']);
  });

  it('lists waiting items due by today, not later ones or closed ones', () => {
    const due = makeTask({ title: 'Quote from Sana', status: 'waiting', ownerName: 'Sana', followUpDate: DATE });
    const overdue = makeTask({ title: 'Deck from Bilal', status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-25' });
    const later = makeTask({ status: 'waiting', ownerName: 'Sana', followUpDate: '2026-09-30' });
    const received = makeTask({ status: 'done', ownerName: 'Sana', followUpDate: DATE });
    const open = openAtShutdown(DATE, [], [], [due, overdue, later, received]);
    expect(open.waiting.map((task) => task.title)).toEqual(['Quote from Sana', 'Deck from Bilal']);
  });
});
