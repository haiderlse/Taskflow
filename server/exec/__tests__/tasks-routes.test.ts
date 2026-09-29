import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { taskSchema } from '../../../src/shared/exec/schemas';

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
let app: Express;

const capture = async (title: string, context = 'work') => {
  const res = await request(app).post('/api/exec/tasks').send({ title, context });
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
};
const patch = (id: string, body: Record<string, unknown>) => request(app).patch(`/api/exec/tasks/${id}`).send(body);

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

describe('POST /api/exec/tasks', () => {
  it('captures into the inbox and answers 201 with a well-formed task', async () => {
    const res = await request(app).post('/api/exec/tasks').send({ title: '  Call the supplier ', context: 'work' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(taskSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toMatchObject({ title: 'Call the supplier', context: 'work', status: 'inbox', rollCount: 0 });
    expect(res.body.data.capturedAt).toMatch(ISO);
  });

  it('rejects a blank title, an unknown context and an unknown key with VALIDATION details', async () => {
    const blank = await request(app).post('/api/exec/tasks').send({ title: '  ', context: 'work' });
    expect(blank.status).toBe(400);
    expect(blank.body).toMatchObject({ success: false, code: 'VALIDATION', details: [{ path: 'title' }] });
    const context = await request(app).post('/api/exec/tasks').send({ title: 'x', context: 'home' });
    expect(context.body.details.map((d: { path: string }) => d.path)).toEqual(['context']);
    const extra = await request(app).post('/api/exec/tasks').send({ title: 'x', context: 'work', status: 'done' });
    expect(extra.status).toBe(400);
    expect(JSON.stringify(extra.body)).not.toContain('done');
  });

  it('never echoes an unknown key name', async () => {
    const res = await request(app)
      .post('/api/exec/tasks')
      .send({ title: 'x', context: 'work', '<script>alert(1)</script>': 'pwn' });
    expect(res.status).toBe(400);
    expect(res.body.details[0].message).toBe('unknown field');
    expect(JSON.stringify(res.body)).not.toContain('<script>');
  });
});

describe('GET /api/exec/tasks', () => {
  it('lists newest first and filters by status, context, week and follow-up', async () => {
    const a = await capture('a', 'work');
    const b = await capture('b', 'build');
    const c = await capture('c', 'work');
    await patch(a.id, { status: 'later', scheduledDate: '2026-09-25' });
    await patch(b.id, { status: 'delegated', ownerName: 'Bilal', followUpDate: '2026-09-22' });

    const all = await request(app).get('/api/exec/tasks');
    expect(all.body.data.map((t: { title: string }) => t.title)).toEqual(['c', 'b', 'a']);

    const inbox = await request(app).get('/api/exec/tasks?status=inbox');
    expect(inbox.body.data.map((t: { title: string }) => t.title)).toEqual(['c']);

    const build = await request(app).get('/api/exec/tasks?status=inbox,later,delegated&context=build');
    expect(build.body.data.map((t: { title: string }) => t.title)).toEqual(['b']);

    const week = await request(app).get('/api/exec/tasks?week=2026-09-20');
    expect(week.body.data.map((t: { title: string }) => t.title)).toEqual(['a']);

    const followUp = await request(app).get('/api/exec/tasks?followUpBy=2026-09-22');
    expect(followUp.body.data.map((t: { title: string }) => t.title)).toEqual(['b']);
    expect(c.id).toBeTruthy();
  });

  it('normalises week to the planning week that contains the date', async () => {
    const a = await capture('a');
    await patch(a.id, { status: 'later', scheduledDate: '2026-09-25' });
    // The Sunday-start week holding 25 Sep runs 20–26 Sep; any day in it finds the task.
    for (const day of ['2026-09-20', '2026-09-22', '2026-09-26']) {
      const res = await request(app).get(`/api/exec/tasks?week=${day}`);
      expect(res.body.data.map((t: { title: string }) => t.title)).toEqual(['a']);
    }
    const next = await request(app).get('/api/exec/tasks?week=2026-09-27');
    expect(next.body.data).toEqual([]);
  });

  it('rejects an unknown status and an unknown query key', async () => {
    const status = await request(app).get('/api/exec/tasks?status=someday');
    expect(status.status).toBe(400);
    expect(status.body.code).toBe('VALIDATION');
    const key = await request(app).get('/api/exec/tasks?page=2');
    expect(key.status).toBe(400);
  });

  it('never echoes an unknown query key', async () => {
    const res = await request(app).get('/api/exec/tasks?evilKey=2');
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('evilKey');
  });
});

describe('PATCH /api/exec/tasks/:id', () => {
  it('processes a capture and stamps processedAt', async () => {
    const task = await capture('x');
    const res = await patch(task.id, { status: 'this_week' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'this_week' });
    expect(res.body.data.processedAt).toMatch(ISO);
  });

  it('answers 404 for an unknown task and 400 for an empty patch', async () => {
    expect((await patch('does-not-exist', { status: 'later' })).body).toEqual({ success: false, error: 'no such task', code: 'NOT_FOUND' });
    const empty = await patch((await capture('x')).id, {});
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe('VALIDATION');
  });

  it('refuses a hand-off without an owner', async () => {
    const res = await patch((await capture('x')).id, { status: 'waiting' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'ownerName is required when a task is delegated or waiting', code: 'VALIDATION' });
  });

  it('answers 400 CONSTRAINT when a project does not exist', async () => {
    const res = await patch((await capture('x')).id, { projectId: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'constraint violation', code: 'CONSTRAINT' });
  });

  it('refuses timestamps and unknown fields in a patch', async () => {
    const task = await capture('x');
    const stamped = await patch(task.id, { processedAt: '2026-09-22T03:00:00.000Z' });
    expect(stamped.status).toBe(400);
    expect(stamped.body.code).toBe('VALIDATION');
    expect(JSON.stringify(stamped.body)).not.toContain('2026-09-22T03:00:00.000Z');
    const unknown = await patch(task.id, { status: 'later', priority: 'high' });
    expect(unknown.status).toBe(400);
  });
});

describe('POST /api/exec/tasks/:id/roll', () => {
  it('moves the scheduled date and counts the roll', async () => {
    const task = await capture('x');
    const res = await request(app).post(`/api/exec/tasks/${task.id}/roll`).send({ date: '2026-09-23' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ scheduledDate: '2026-09-23', rollCount: 1 });
    expect(res.body.data.rolledAt).toMatch(ISO);
    expect((await request(app).post('/api/exec/tasks/missing/roll').send({ date: '2026-09-23' })).status).toBe(404);
    expect((await request(app).post(`/api/exec/tasks/${task.id}/roll`).send({ date: 'tomorrow' })).status).toBe(400);
  });
});

describe('DELETE /api/exec/tasks/:id', () => {
  it('deletes an inbox item, refuses a processed one and 404s an unknown one', async () => {
    const inbox = await capture('inbox');
    const later = await capture('later');
    await patch(later.id, { status: 'later' });
    const deleted = await request(app).delete(`/api/exec/tasks/${inbox.id}`);
    expect(deleted.status).toBe(200);
    expect(deleted.body).toEqual({ success: true, data: { id: inbox.id } });
    const refused = await request(app).delete(`/api/exec/tasks/${later.id}`);
    expect(refused.status).toBe(409);
    expect(refused.body).toEqual({ success: false, error: 'only an inbox item can be deleted; kill it instead', code: 'DELETE_NOT_ALLOWED' });
    expect((await request(app).delete('/api/exec/tasks/missing')).status).toBe(404);
  });
});
