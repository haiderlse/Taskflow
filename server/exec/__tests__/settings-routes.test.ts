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

describe('PUT /api/exec/settings', () => {
  const schedule = {
    workDays: [1, 2, 3, 4],
    deepWorkStart: '08:35',
    deepWorkMinutes: 90,
    shutdownTime: '17:00',
    officeStart: '08:15',
    officeEnd: '18:00',
    buildBlocks: [],
  };

  it('saves the schedule and serves it back', async () => {
    const res = await request(app).put('/api/exec/settings').send(schedule);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ workDays: [1, 2, 3, 4], buildBlocks: [], timezone: 'Asia/Karachi' });
    expect((await request(app).get('/api/exec/settings')).body.data.workDays).toEqual([1, 2, 3, 4]);
  });

  it('refuses reversed office hours with a message and path, and a time zone as an unknown field', async () => {
    const reversed = await request(app).put('/api/exec/settings').send({ ...schedule, officeStart: '18:00', officeEnd: '08:00' });
    expect(reversed.status).toBe(400);
    expect(reversed.body).toMatchObject({ code: 'VALIDATION', details: [{ path: 'officeEnd', message: 'office hours must start before they end' }] });
    const zone = await request(app).put('/api/exec/settings').send({ ...schedule, timezone: 'UTC' });
    expect(zone.status).toBe(400);
    expect(JSON.stringify(zone.body)).not.toContain('timezone');
    expect(zone.body.details).toEqual([{ path: '', message: 'unknown field' }]);
  });
});

describe('GET /api/exec/projects', () => {
  it('is an empty list until Phase 3 creates projects', async () => {
    const res = await request(app).get('/api/exec/projects');
    expect(res.body).toEqual({ success: true, data: [] });
  });
});
