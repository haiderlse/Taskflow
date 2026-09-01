import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';
import { openDb, initSchema } from '../db/connection';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const db = openDb(':memory:');
    initSchema(db);
    const res = await request(createApp(db)).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
