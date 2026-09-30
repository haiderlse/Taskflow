import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';

let app: Express;
const MISSING = '10000000-0000-4000-8000-00000000dead';

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

describe('POST /api/exec/outcomes/:id/review', () => {
  it('grades an outcome once', async () => {
    const weekId = (await request(app).post('/api/exec/weeks').send({ date: '2026-09-29' })).body.data.week.id;
    const id = (await request(app).post(`/api/exec/weeks/${weekId}/outcomes`).send({ title: 'Supplier plan confirmed', category: 'office' })).body.data.id;
    const res = await request(app).post(`/api/exec/outcomes/${id}/review`).send({ grade: 'partial', reason: 'insufficient_time', disposition: 'roll_forward' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id, reviewGrade: 'partial', reviewDisposition: 'roll_forward' });
    const again = await request(app).post(`/api/exec/outcomes/${id}/review`).send({ grade: 'done' });
    expect(again.status).toBe(400);
    expect(again.body).toEqual({ success: false, error: 'that outcome is already reviewed', code: 'VALIDATION' });
  });

  it('refuses an incomplete grade with the reasons, and 404s an unknown outcome', async () => {
    const bad = await request(app).post(`/api/exec/outcomes/${MISSING}/review`).send({ grade: 'missed' });
    expect(bad.status).toBe(400);
    expect(bad.body.details).toEqual([
      { path: 'reason', message: 'a partial or missed outcome needs a reason' },
      { path: 'disposition', message: 'choose roll, reschedule, delegate or kill' },
    ]);
    const missing = await request(app).post(`/api/exec/outcomes/${MISSING}/review`).send({ grade: 'done' });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: 'no such outcome', code: 'NOT_FOUND' });
  });
});
