import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { projectSummarySchema, projectDetailSchema } from '../../../src/shared/exec/schemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const create = async (body: Record<string, unknown>) => {
  const res = await request(app).post('/api/exec/projects').send(body);
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
};

describe('/api/exec/projects', () => {
  it('creates, lists with counts, details and patches a project', async () => {
    const created = await create({ name: '  Supply plan ', context: 'work' });
    const list = await request(app).get('/api/exec/projects');
    expect(list.body.data).toHaveLength(1);
    expect(projectSummarySchema.safeParse(list.body.data[0]).success).toBe(true);
    expect(list.body.data[0]).toMatchObject({ name: 'Supply plan', activeOutcomes: 0, openTasks: 0 });

    const detail = await request(app).get(`/api/exec/projects/${created.id}`);
    expect(projectDetailSchema.safeParse(detail.body.data).success).toBe(true);

    const patched = await request(app).patch(`/api/exec/projects/${created.id}`).send({ status: 'archived' });
    expect(patched.body.data).toMatchObject({ status: 'archived' });
  });

  it('answers 404 for an unknown project on read and write', async () => {
    const missing = { success: false, error: 'no such project', code: 'NOT_FOUND' };
    expect((await request(app).get('/api/exec/projects/nope')).body).toEqual(missing);
    expect((await request(app).patch('/api/exec/projects/nope').send({ name: 'x' })).body).toEqual(missing);
  });

  it('rejects a blank name, an empty patch and unknown keys without echoing them', async () => {
    expect((await request(app).post('/api/exec/projects').send({ name: ' ', context: 'work' })).status).toBe(400);
    const created = await create({ name: 'x', context: 'build' });
    expect((await request(app).patch(`/api/exec/projects/${created.id}`).send({})).status).toBe(400);
    const extra = await request(app).post('/api/exec/projects').send({ name: 'y', context: 'work', ownerSecret: 'z' });
    expect(extra.status).toBe(400);
    expect(JSON.stringify(extra.body)).not.toContain('ownerSecret');
  });
});
