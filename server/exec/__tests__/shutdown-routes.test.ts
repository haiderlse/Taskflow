import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { dayViewSchema } from '../../../src/shared/exec/todaySchemas';
import { mustShipBlockResultSchema } from '../../../src/shared/exec/reviewSchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const tuesdayShip = async () =>
  (await request(app).post('/api/exec/must-ships').send({ title: 'Venue booked', context: 'work', date: '2026-09-29' })).body.data.id as string;

describe('the shutdown routes', () => {
  it('refuses to close the day while the Must Ship is planned, then closes it once graded', async () => {
    const id = await tuesdayShip();
    const early = await request(app).post('/api/exec/days/2026-09-29/shutdown').send({});
    expect(early.status).toBe(409);
    expect(early.body).toEqual({ success: false, error: "grade today's Must Ship before closing the day", code: 'SHUTDOWN_NOT_READY' });
    await request(app).patch(`/api/exec/must-ships/${id}`).send({ status: 'shipped' });
    const closed = await request(app).post('/api/exec/days/2026-09-29/shutdown').send({});
    expect(closed.status).toBe(200);
    expect(dayViewSchema.parse(closed.body.data).day?.shutdownAt).toEqual(expect.any(String));
  });

  it('refuses a stray field without echoing it, and a date that is not a date', async () => {
    const stray = await request(app).post('/api/exec/days/2026-09-29/shutdown').send({ force: true });
    expect(stray.status).toBe(400);
    expect(JSON.stringify(stray.body)).not.toContain('force');
    const bad = await request(app).post('/api/exec/days/2026-02-30/shutdown').send({});
    expect(bad.status).toBe(400);
  });

  it('blocks a Must Ship and files its next action, refusing an incomplete blocker', async () => {
    const id = await tuesdayShip();
    const incomplete = await request(app).post(`/api/exec/must-ships/${id}/block`).send({ what: 'No quote', owner: '' });
    expect(incomplete.status).toBe(400);
    const res = await request(app).post(`/api/exec/must-ships/${id}/block`).send({ what: 'No quote', owner: 'Sana', nextAction: 'Chase the quote' });
    expect(res.status).toBe(200);
    expect(mustShipBlockResultSchema.parse(res.body.data)).toMatchObject({
      mustShip: { status: 'blocked' },
      task: { status: 'waiting', followUpDate: '2026-09-30' },
    });
    const missing = await request(app).post('/api/exec/must-ships/40000000-0000-4000-8000-00000000dead/block').send({ what: 'a', owner: 'b', nextAction: 'c' });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: 'no such must ship', code: 'NOT_FOUND' });
  });
});
