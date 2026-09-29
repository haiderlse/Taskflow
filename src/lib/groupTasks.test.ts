import { describe, it, expect } from 'vitest';
import { groupTasks } from './groupTasks';
import { makeOutcome, makeTask } from '../test/fixtures';

describe('groupTasks', () => {
  it('groups by outcome, then project, with unlinked tasks last', () => {
    const outcome = makeOutcome({ title: 'Supplier plan confirmed' });
    const project = { id: '30000000-0000-4000-8000-000000000099', name: 'Pinkbox' };
    const tasks = [
      makeTask({ title: 'Call supplier', outcomeId: outcome.id }),
      makeTask({ title: 'Draft dashboard', projectId: project.id }),
      makeTask({ title: 'Loose end' }),
      makeTask({ title: 'Send tracker', outcomeId: outcome.id, projectId: project.id }),
    ];
    expect(groupTasks(tasks, [outcome], [project]).map((g) => [g.label, g.tasks.map((t) => t.title)])).toEqual([
      ['Supplier plan confirmed', ['Call supplier', 'Send tracker']],
      ['Pinkbox', ['Draft dashboard']],
      ['Not linked', ['Loose end']],
    ]);
  });

  it('treats a link to an unknown outcome or project as unlinked and returns nothing for no tasks', () => {
    const tasks = [makeTask({ title: 'Orphan', outcomeId: '10000000-0000-4000-8000-000000009999' })];
    expect(groupTasks(tasks, [], []).map((g) => g.label)).toEqual(['Not linked']);
    expect(groupTasks([], [], [])).toEqual([]);
  });
});
