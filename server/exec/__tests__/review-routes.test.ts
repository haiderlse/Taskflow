import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { scoreboardSchema } from '../../../src/shared/exec/reviewSchemas';

let app: Express;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  app = createApp(legacy, prepareExecDb(':memory:'));
});

const MISSING = '20000000-0000-4000-8000-00000000dead';
const weekFor = async (date: string) => (await request(app).post('/api/exec/weeks').send({ date })).body.data.week.id as string;
const addOutcome = async (weekId: string, title: string) =>
  (await request(app).post(`/api/exec/weeks/${weekId}/outcomes`).send({ title, category: 'office' })).body.data.id as string;

describe('/api/exec/weeks, the review routes', () => {
  it("reads a week's scoreboard, and 404s an unknown week", async () => {
    const id = await weekFor('2026-09-29');
    const res = await request(app).get(`/api/exec/weeks/${id}/scoreboard`);
    expect(res.status).toBe(200);
    expect(scoreboardSchema.parse(res.body.data)).toMatchObject({ weekId: id, startDate: '2026-09-27' });
    expect(res.body.data.strip).toHaveLength(5);
    const missing = await request(app).get(`/api/exec/weeks/${MISSING}/scoreboard`);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ success: false, error: 'no such week', code: 'NOT_FOUND' });
  });

  it('lists earlier weeks newest first and refuses a bad date', async () => {
    await weekFor('2026-09-15');
    await weekFor('2026-09-22');
    await weekFor('2026-09-29');
    const res = await request(app).get('/api/exec/weeks/history?before=2026-09-29');
    expect(res.status).toBe(200);
    expect(res.body.data.map((board: { startDate: string }) => board.startDate)).toEqual(['2026-09-20', '2026-09-13']);
    const bad = await request(app).get('/api/exec/weeks/history?before=soon');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('VALIDATION');
  });

  it('refuses the review until every outcome is graded, then stamps it', async () => {
    const id = await weekFor('2026-09-29');
    const outcomeId = await addOutcome(id, 'Supplier plan confirmed');
    const early = await request(app).post(`/api/exec/weeks/${id}/review`).send({});
    expect(early.status).toBe(409);
    expect(early.body).toEqual({ success: false, error: 'grade every outcome before the review is done', code: 'REVIEW_NOT_READY' });
    await request(app).patch(`/api/exec/outcomes/${outcomeId}`).send({ reviewGrade: 'done', status: 'done' });
    const done = await request(app).post(`/api/exec/weeks/${id}/review`).send({ notes: 'Good week' });
    expect(done.status).toBe(200);
    expect(done.body.data).toMatchObject({ id, reviewNotes: 'Good week', reviewedAt: expect.any(String) });
  });

  it('refuses a stray field without echoing it, and 404s an unknown week on review', async () => {
    const id = await weekFor('2026-09-29');
    const stray = await request(app).post(`/api/exec/weeks/${id}/review`).send({ reviewedAt: 'now' });
    expect(stray.status).toBe(400);
    expect(stray.body.code).toBe('VALIDATION');
    expect(JSON.stringify(stray.body)).not.toContain('reviewedAt');
    const missing = await request(app).post(`/api/exec/weeks/${MISSING}/review`).send({});
    expect(missing.status).toBe(404);
  });
});
