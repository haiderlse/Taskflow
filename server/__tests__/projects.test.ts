import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { openDb, initSchema } from '../db/connection';
import { seed } from '../db/seed';
import { createApp } from '../app';

let app: any;
beforeEach(() => {
  const db = openDb(':memory:');
  initSchema(db);
  seed(db);
  app = createApp(db);
});

describe('projects routes', () => {
  it('lists seeded projects with array fields decoded', async () => {
    const res = await request(app).get('/api/projects');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body[0].members)).toBe(true);
    expect(Array.isArray(res.body[0].tags)).toBe(true);
  });

  it('preserves nested fields the old SQL schema dropped', async () => {
    const res = await request(app).get('/api/projects');
    const proj1 = res.body.find((p: any) => p.id === 'proj-1');
    expect(Array.isArray(proj1.sections)).toBe(true);
    expect(typeof proj1.brief).toBe('object');
    expect(proj1.brief).not.toBeNull();
    expect(Array.isArray(proj1.brief)).toBe(false);
    expect(Array.isArray(proj1.statusUpdates)).toBe(true);
    expect(Array.isArray(proj1.customFields)).toBe(true);
  });

  it('creates a project with name and ownerId', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'New Initiative', ownerId: 'user-1' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.members).toEqual(['user-1']);
    expect(res.body.status).toBe('active');
  });

  it('creates a project and ignores a client-supplied id', async () => {
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Custom', ownerId: 'user-1', id: 'my-chosen-id' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.id).not.toBe('my-chosen-id');
  });

  it('rejects a project owned by a non-existent user', async () => {
    const before = await request(app).get('/api/projects');
    const res = await request(app)
      .post('/api/projects')
      .send({ name: 'Orphan', ownerId: 'ghost' });
    expect(res.status).toBe(400);
    const after = await request(app).get('/api/projects');
    expect(after.body.length).toBe(before.body.length);
  });

  it('patches a project name', async () => {
    const { body } = await request(app).post('/api/projects').send({ name: 'X', ownerId: 'user-1' });
    const res = await request(app).patch(`/api/projects/${body.id}`).send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Renamed');
  });

  it('404s when patching a non-existent project', async () => {
    const res = await request(app).patch('/api/projects/does-not-exist').send({ name: 'Renamed' });
    expect(res.status).toBe(404);
  });

  it('deletes a project', async () => {
    const { body } = await request(app).post('/api/projects').send({ name: 'X', ownerId: 'user-1' });
    expect((await request(app).delete(`/api/projects/${body.id}`)).status).toBe(204);
  });

  it('404s when deleting a non-existent project', async () => {
    const res = await request(app).delete('/api/projects/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('rejects a column-name injection attempt via PATCH and leaves other projects unchanged', async () => {
    const res = await request(app)
      .patch('/api/projects/proj-1')
      .send({ "name = 'x' where 1=1 -- ": 'y' });
    expect(res.status).toBe(400);

    const all = await request(app).get('/api/projects');
    const nameById: Record<string, string> = {};
    for (const p of all.body) nameById[p.id] = p.name;
    expect(nameById['proj-1']).toBe('AOP 2025-26 Enterprise Plan');
    expect(nameById['proj-2']).toBe('Retail Store Digital Hub');
    expect(nameById['proj-3']).toBe('Shahlimar Franchise Expansion');
    expect(nameById['proj-4']).toBe('Dvago Omnichannel Platform');
    expect(nameById['proj-5']).toBe('Mungwao Customer Delivery');
  });
});
