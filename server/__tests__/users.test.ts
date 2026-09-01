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

  it('creates a user and returns it with a generated uid', async () => {
    const res = await request(app)
      .post('/api/users')
      .send({ email: 'd@example.com', displayName: 'Dana', role: 'member' });
    expect(res.status).toBe(201);
    expect(res.body.uid).toBeTruthy();
    expect(res.body.isActive).toBe(true);
  });

  it('patches only the provided fields', async () => {
    const res = await request(app).patch('/api/users/user-3').send({ workload: 12 });
    expect(res.status).toBe(200);
    expect(res.body.workload).toBe(12);
    expect(res.body.displayName).toBe('Charlie');
  });

  it('deletes a user', async () => {
    expect((await request(app).delete('/api/users/user-3')).status).toBe(204);
    expect((await request(app).get('/api/users/user-3')).status).toBe(404);
  });
});
