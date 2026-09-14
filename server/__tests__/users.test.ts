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

describe('users routes', () => {
  it('lists seeded users', async () => {
    const res = await request(app).get('/api/users');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body[0]).toHaveProperty('displayName');
  });

  it('returns user-1 from /me (no auth)', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(200);
    expect(res.body.uid).toBe('user-1');
  });

  it('fetches one user by uid', async () => {
    const res = await request(app).get('/api/users/user-2');
    expect(res.body.displayName).toBe('Bob');
  });

  it('404s an unknown uid', async () => {
    expect((await request(app).get('/api/users/nope')).status).toBe(404);
  });

  it('creates a user and ignores a client-supplied uid', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ uid: 'client-supplied-uid', email: 'd@example.com', displayName: 'Dana', role: 'member' });
    expect(res.status).toBe(201);
    expect(res.body.uid).toBeTruthy();
    expect(res.body.uid).not.toBe('client-supplied-uid');
    expect(res.body.isActive).toBe(true);
  });

  it('patches only the provided fields', async () => {
    const res = await request(app).patch('/api/users/user-3').send({ workload: 12 });
    expect(res.status).toBe(200);
    expect(res.body.workload).toBe(12);
    expect(res.body.displayName).toBe('Charlie');
  });

  it('accepts a decimal approvalLimit, matching the old DECIMAL(15,2) column', async () => {
    const res = await request(app).patch('/api/users/user-2').send({ approvalLimit: 1500.5 });
    expect(res.status).toBe(200);
    expect(res.body.approvalLimit).toBe(1500.5);
  });

  it('rejects a non-numeric workload under the STRICT schema', async () => {
    const res = await request(app).patch('/api/users/user-3').send({ workload: 'lots' });
    expect(res.status).toBe(400);
  });

  it('patches with an empty body and changes nothing', async () => {
    const before = await request(app).get('/api/users/user-3');
    const res = await request(app).patch('/api/users/user-3').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual(before.body);
  });

  it('deletes a user', async () => {
    expect((await request(app).delete('/api/users/user-3')).status).toBe(204);
    expect((await request(app).get('/api/users/user-3')).status).toBe(404);
  });

  it('rejects a column-name injection attempt via PATCH and leaves other rows unchanged', async () => {
    const res = await request(app)
      .patch('/api/users/user-2')
      .send({ 'role = coalesce(?, ?) -- ': 'HACKED-ROLE' });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);

    const all = await request(app).get('/api/users');
    const roleByUid: Record<string, string> = {};
    for (const u of all.body) roleByUid[u.uid] = u.role;
    expect(roleByUid['user-1']).toBe('admin');
    expect(roleByUid['user-2']).toBe('manager');
    expect(roleByUid['user-3']).toBe('member');
  });

  it('rejects an unknown column name on PATCH with 400, not 500', async () => {
    const res = await request(app).patch('/api/users/user-2').send({ notARealColumn: 'x' });
    expect(res.status).toBe(400);
  });

  it('rejects an unknown column name on POST with 400, not 500', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'x@example.com', displayName: 'X', role: 'member', notARealColumn: 'x' });
    expect(res.status).toBe(400);
  });

  it('rejects a naive datetime in PATCH with 400 and leaks no internals', async () => {
    const res = await request(app)
      .patch('/api/users/user-2')
      .send({ lastLogin: '2026-01-01 10:00:00' }); // no timezone designator
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/\/mnt\//);
    expect(body).not.toMatch(/\.ts:\d+/);
    expect(body).not.toMatch(/at \S+ \(/); // no stack-trace frame
  });

  it('rejects a duplicate email on POST with 400, not a raw SQLite error', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'bob@example.com', displayName: 'Bob Two', role: 'member' });
    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    const body = JSON.stringify(res.body);
    expect(body).not.toMatch(/\/mnt\//);
    expect(body).not.toMatch(/\.ts:\d+/);
  });
});
