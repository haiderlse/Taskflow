import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb, initSchema } from '../db/connection';
import { seed } from '../db/seed';
import { createApp } from '../app';

let app: any;
let projectId: string;

beforeEach(async () => {
  const db = openDb(':memory:');
  initSchema(db);
  seed(db);
  app = createApp(db);
  projectId = (await request(app).get('/api/projects')).body[0].id;
});

describe('tasks routes', () => {
  it('lists tasks for a project', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/tasks`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('lists a project\'s seeded tasks sorted by the quoted order column', async () => {
    const res = await request(app).get('/api/projects/proj-1/tasks');
    expect(res.body.map((t: any) => t.id).sort()).toEqual(['task-1', 'task-2', 'task-3', 'task-8']);
    const orders = res.body.map((t: any) => t.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
  });

  it('decodes JSON and date columns on seeded tasks', async () => {
    const res = await request(app).get('/api/projects/proj-1/tasks');
    const task1 = res.body.find((t: any) => t.id === 'task-1');
    expect(task1.blocking).toEqual(['task-3']);
    expect(task1.customFields).toEqual({});
    expect(Number.isNaN(Date.parse(task1.dueDate))).toBe(false);
    expect(task1.completedDate).toBeNull();
  });

  it('returns an empty list for a project with no tasks', async () => {
    const res = await request(app).get('/api/projects/does-not-exist/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('creates a task with defaults and a quoted order column', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Ship it', projectId, createdBy: 'user-1', order: 5 });
    expect(res.status).toBe(201);
    expect(res.body.order).toBe(5);
    expect(res.body.timeTracked).toBe(0);
    expect(res.body.dependencies).toEqual([]);
    expect(res.body.status).toBe('To Do');
    expect(res.body.taskStatus).toBe('not_started');
    expect(res.body.isMilestone).toBe(false);
  });

  it('creates a task and ignores a client-supplied id', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Custom', projectId, createdBy: 'user-1', id: 'my-chosen-id' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.id).not.toBe('my-chosen-id');
  });

  it('round-trips nested fields the old schema dropped', async () => {
    const res = await request(app).post('/api/tasks').send({
      title: 'Nested', projectId, createdBy: 'user-1',
      subtaskItems: [{ id: 's1', title: 'step', done: false }],
      blockedBy: ['t-9'],
    });
    expect(res.body.subtaskItems[0].title).toBe('step');
    expect(res.body.blockedBy).toEqual(['t-9']);
  });

  it('rejects a task in a non-existent project', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Orphan', projectId: 'ghost', createdBy: 'user-1' });
    expect(res.status).toBe(400);
    expect((await request(app).get('/api/projects/ghost/tasks')).body).toEqual([]);
  });

  it('rejects an unknown field on create', async () => {
    const res = await request(app)
      .post('/api/tasks')
      .send({ title: 'Bad', projectId, createdBy: 'user-1', notAColumn: 1 });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'unknown column: not_a_column' });
  });

  it('lists tasks assigned to a user', async () => {
    await request(app).post('/api/tasks')
      .send({ title: 'Mine', projectId, createdBy: 'user-1', assigneeId: 'user-2' });
    const res = await request(app).get('/api/users/user-2/tasks');
    expect(res.status).toBe(200);
    expect(res.body.some((t: any) => t.title === 'Mine')).toBe(true);
    expect(res.body.every((t: any) => t.assigneeId === 'user-2')).toBe(true);
  });

  it('does not shadow the single-user lookup', async () => {
    const res = await request(app).get('/api/users/user-2');
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('user-2');
  });

  it('patches a task status', async () => {
    const { body } = await request(app).post('/api/tasks')
      .send({ title: 'T', projectId, createdBy: 'user-1' });
    const res = await request(app).patch(`/api/tasks/${body.id}`).send({ status: 'Done' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Done');
    expect(res.body.title).toBe('T');
  });

  it('patches the order column', async () => {
    const res = await request(app).patch('/api/tasks/task-1').send({ order: 42 });
    expect(res.status).toBe(200);
    expect(res.body.order).toBe(42);
  });

  it('ignores a client-supplied id on patch', async () => {
    const res = await request(app).patch('/api/tasks/task-1').send({ id: 'hijacked', title: 'Kept id' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('task-1');
    expect(res.body.title).toBe('Kept id');
  });

  it('404s when patching a non-existent task', async () => {
    const res = await request(app).patch('/api/tasks/does-not-exist').send({ status: 'Done' });
    expect(res.status).toBe(404);
  });

  it('rejects a column-name injection attempt via PATCH and leaves other tasks unchanged', async () => {
    const res = await request(app)
      .patch('/api/tasks/task-1')
      .send({ "title = 'x' where 1=1 -- ": 'y' });
    expect(res.status).toBe(400);

    const tasks = (await request(app).get('/api/projects/proj-1/tasks')).body;
    const titleById: Record<string, string> = {};
    for (const t of tasks) titleById[t.id] = t.title;
    expect(titleById['task-1']).toBe('Follow up on Pharma Receivables Plan');
    expect(titleById['task-2']).toBe('Follow up on FW: MOM Route 2 Health x DVAGO 20-Nov-2024');
    expect(titleById['task-3']).toBe('IBP - Forecasting to Process & Priorities');
    expect(titleById['task-8']).toBe('Design new homepage mockups');
  });

  it('deletes a task', async () => {
    expect((await request(app).delete('/api/tasks/task-1')).status).toBe(204);
    const ids = (await request(app).get('/api/projects/proj-1/tasks')).body.map((t: any) => t.id);
    expect(ids).not.toContain('task-1');
  });

  it('404s when deleting a non-existent task', async () => {
    const res = await request(app).delete('/api/tasks/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('cascades task deletion when its project is deleted', async () => {
    const { body: p } = await request(app).post('/api/projects').send({ name: 'Temp', ownerId: 'user-1' });
    await request(app).post('/api/tasks').send({ title: 'Doomed', projectId: p.id, createdBy: 'user-1' });
    await request(app).delete(`/api/projects/${p.id}`);
    expect((await request(app).get(`/api/projects/${p.id}/tasks`)).body).toEqual([]);
  });
});
