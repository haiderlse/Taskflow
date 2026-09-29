import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { mustShipSchema } from '../../../src/shared/exec/todaySchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const create = (body: Record<string, unknown>) => request(app).post('/api/exec/must-ships').send(body);
const today = { title: 'Supplier tracker sent', context: 'work', date: '2026-09-29' };
const missing = { success: false, error: 'no such must ship', code: 'NOT_FOUND' };

describe('/api/exec/must-ships', () => {
  it('creates a Must Ship (201) and refuses a second for the day with DAY_TAKEN and the first', async () => {
    const first = await create(today);
    expect(first.status).toBe(201);
    expect(mustShipSchema.safeParse(first.body.data).success).toBe(true);
    const second = await create({ ...today, title: 'Something else' });
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ success: false, code: 'DAY_TAKEN', error: 'that day already has a must ship', details: { mustShip: { title: 'Supplier tracker sent' } } });
  });

  it('lists candidates with date=none and a day with its date', async () => {
    await create({ title: 'Candidate', context: 'work' });
    await create(today);
    expect((await request(app).get('/api/exec/must-ships?date=none')).body.data.map((m: { title: string }) => m.title)).toEqual(['Candidate']);
    expect((await request(app).get('/api/exec/must-ships?date=2026-09-29&status=planned')).body.data.map((m: { title: string }) => m.title)).toEqual(['Supplier tracker sent']);
    const bad = await request(app).get('/api/exec/must-ships?date=tomorrow');
    expect(bad.status).toBe(400);
  });

  it('patches, refuses a half-filled blocker, and 404s an unknown id', async () => {
    const id = (await create(today)).body.data.id as string;
    expect((await request(app).patch(`/api/exec/must-ships/${id}`).send({ status: 'shipped' })).body.data).toMatchObject({ status: 'shipped' });
    const half = await request(app).patch(`/api/exec/must-ships/${id}`).send({ status: 'blocked', blockerWhat: 'Supplier silent' });
    expect(half.status).toBe(400);
    expect(half.body.code).toBe('VALIDATION');
    const unknown = await request(app).patch('/api/exec/must-ships/40000000-0000-4000-8000-000000000999').send({ title: 'x' });
    expect(unknown.status).toBe(404);
    expect(unknown.body).toEqual(missing);
  });

  it('rolls to a new day (201) with lineage', async () => {
    const id = (await create(today)).body.data.id as string;
    const copy = await request(app).post(`/api/exec/must-ships/${id}/roll`).send({ date: '2026-09-30' });
    expect(copy.status).toBe(201);
    expect(copy.body.data).toMatchObject({ date: '2026-09-30', rolledFromId: id, rollCount: 1 });
    expect((await request(app).post('/api/exec/must-ships/40000000-0000-4000-8000-000000000999/roll').send({ date: '2026-09-30' })).body).toEqual(missing);
  });

  it('never echoes an unknown field', async () => {
    const res = await create({ ...today, status: 'shipped' });
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual([{ path: '', message: 'unknown field' }]);
  });
});
