import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { settingsSchema } from '../../../src/shared/exec/schemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

describe('GET /api/exec/settings', () => {
  it('returns the seeded schedule with its JSON columns decoded', async () => {
    const res = await request(app).get('/api/exec/settings');
    expect(res.status).toBe(200);
    expect(settingsSchema.safeParse(res.body.data).success).toBe(true);
    expect(res.body.data).toMatchObject({
      timezone: 'Asia/Karachi',
      weekStartDay: 0,
      workDays: [1, 2, 3, 4, 5],
      officeStart: '08:15',
      officeEnd: '18:00',
      buildBlocks: [{ weekday: 2, start: '06:30', minutes: 50 }, { weekday: 4, start: '06:30', minutes: 50 }, { weekday: 6, start: '09:00', minutes: 180 }],
    });
    expect(res.body.data).not.toHaveProperty('id');
  });
});

describe('GET /api/exec/projects', () => {
  it('is an empty list until Phase 3 creates projects', async () => {
    const res = await request(app).get('/api/exec/projects');
    expect(res.body).toEqual({ success: true, data: [] });
  });
});
