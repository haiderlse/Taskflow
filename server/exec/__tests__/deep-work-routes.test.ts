import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { deepWorkBlockSchema } from '../../../src/shared/exec/todaySchemas';
import { finishResultSchema } from '../../../src/shared/exec/deepWorkSchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const create = (body: Record<string, unknown>) => request(app).post('/api/exec/deep-work').send(body);
const block = { date: '2026-09-29', context: 'work', plannedStart: '08:35', plannedMinutes: 90 };
const missing = { success: false, error: 'no such block', code: 'NOT_FOUND' };
const UNKNOWN = '50000000-0000-4000-8000-000000000999';

describe('/api/exec/deep-work', () => {
  it('plans a block (201), lists a range, and patches it', async () => {
    const made = await create(block);
    expect(made.status).toBe(201);
    expect(deepWorkBlockSchema.safeParse(made.body.data).success).toBe(true);
    await create({ ...block, date: '2026-10-08' });
    const listed = await request(app).get('/api/exec/deep-work?from=2026-09-27&to=2026-10-03');
    expect(listed.body.data.map((row: { date: string }) => row.date)).toEqual(['2026-09-29']);
    const patched = await request(app).patch(`/api/exec/deep-work/${made.body.data.id}`).send({ plannedMinutes: 60 });
    expect(patched.body.data).toMatchObject({ plannedMinutes: 60 });
  });

  it('runs a session from start to a blocked finish and leaves every trace', async () => {
    const ship = (await request(app).post('/api/exec/must-ships').send({ title: 'Delivery tracker sent', context: 'work', date: '2026-09-29' })).body.data;
    const id = (await create(block)).body.data.id as string;
    const started = await request(app).post(`/api/exec/deep-work/${id}/start`).send({});
    expect(started.body.data).toMatchObject({ mustShipId: ship.id });
    expect(started.body.data.startedAt).not.toBeNull();
    expect((await request(app).post(`/api/exec/deep-work/${id}/pause`).send({})).body.data.pauseStartedAt).not.toBeNull();
    expect((await request(app).post(`/api/exec/deep-work/${id}/resume`).send({})).body.data.pauseStartedAt).toBeNull();
    const finished = await request(app)
      .post(`/api/exec/deep-work/${id}/finish`)
      .send({ result: 'blocked', blocker: { what: 'Supplier has not replied', owner: 'Bilal', nextAction: 'Call Bilal about the tracker' } });
    expect(finished.status).toBe(200);
    expect(finishResultSchema.safeParse(finished.body.data).success).toBe(true);
    expect(finished.body.data).toMatchObject({ block: { result: 'blocked' }, mustShip: { status: 'blocked' }, task: { status: 'waiting', ownerName: 'Bilal', followUpDate: '2026-09-30' } });
    const waiting = await request(app).get('/api/exec/tasks?status=waiting');
    expect(waiting.body.data.map((task: { title: string }) => task.title)).toEqual(['Call Bilal about the tracker']);
    const day = await request(app).get('/api/exec/days/2026-09-29');
    expect(day.body.data.blocks).toMatchObject([{ id, result: 'blocked' }]);
  });

  it('answers 404 with the exact body for an unknown block on every verb', async () => {
    const calls = [
      request(app).patch(`/api/exec/deep-work/${UNKNOWN}`).send({ plannedMinutes: 30 }),
      request(app).post(`/api/exec/deep-work/${UNKNOWN}/start`).send({}),
      request(app).post(`/api/exec/deep-work/${UNKNOWN}/pause`).send({}),
      request(app).post(`/api/exec/deep-work/${UNKNOWN}/resume`).send({}),
      request(app).post(`/api/exec/deep-work/${UNKNOWN}/finish`).send({ result: 'progress' }),
    ];
    for (const response of await Promise.all(calls)) {
      expect(response.status).toBe(404);
      expect(response.body).toEqual(missing);
    }
  });

  it('refuses with the rule that failed, and never echoes an unknown field', async () => {
    await create(block);
    const overlap = await create({ ...block, plannedStart: '09:00' });
    expect(overlap.status).toBe(400);
    expect(overlap.body).toMatchObject({ code: 'VALIDATION', error: 'that time overlaps another block' });
    const range = await request(app).get('/api/exec/deep-work?from=2026-10-03&to=2026-09-27');
    expect(range.body).toMatchObject({ code: 'VALIDATION', details: [{ path: 'to', message: 'from must not be after to' }] });
    const blocker = await request(app).post(`/api/exec/deep-work/${UNKNOWN}/finish`).send({ result: 'blocked' });
    expect(blocker.body.details).toEqual([{ path: 'blocker', message: 'a blocked session needs what blocks it, who owns it and the next action' }]);
    const extra = await create({ ...block, plannedStart: '15:00', startedAt: '2026-09-29T10:00:00.000Z' });
    expect(extra.status).toBe(400);
    expect(extra.body.details).toEqual([{ path: '', message: 'unknown field' }]);
  });
});
