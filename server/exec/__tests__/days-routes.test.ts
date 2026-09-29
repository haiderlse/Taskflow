import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { dayViewSchema } from '../../../src/shared/exec/todaySchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const capture = async (title: string) => (await request(app).post('/api/exec/tasks').send({ title, context: 'work' })).body.data.id as string;

describe('/api/exec/days', () => {
  it('reads a day as the Today screen needs it', async () => {
    const res = await request(app).get('/api/exec/days/2026-09-29');
    expect(res.status).toBe(200);
    expect(dayViewSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toMatchObject({ date: '2026-09-29', day: null, mustShip: null, secondaries: [] });
  });

  it('refuses a date that is not a calendar date', async () => {
    const res = await request(app).get('/api/exec/days/2026-02-30');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION');
  });

  it('sets two secondaries and refuses a third with SLOT_LIMIT', async () => {
    const ids = [await capture('A'), await capture('B'), await capture('C')];
    const two = await request(app).put('/api/exec/days/2026-09-29/slots').send({ taskIds: ids.slice(0, 2) });
    expect(two.status).toBe(200);
    expect(two.body.data.secondaries).toHaveLength(2);
    const three = await request(app).put('/api/exec/days/2026-09-29/slots').send({ taskIds: ids });
    expect(three.status).toBe(400);
    expect(three.body).toEqual({ success: false, error: 'a day holds at most two secondary tasks', code: 'SLOT_LIMIT' });
  });
});
