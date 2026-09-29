import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import type Database from 'better-sqlite3';
import type { Express } from 'express';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { weekViewSchema, weekLookupSchema, outcomeSchema } from '../../../src/shared/exec/schemas';

let app: Express;
let exec: Database.Database;

beforeEach(() => {
  const legacy = openDb(':memory:');
  initSchema(legacy);
  exec = prepareExecDb(':memory:');
  app = createApp(legacy, exec);
});

const ensure = async (date = '2026-09-22') => (await request(app).post('/api/exec/weeks').send({ date })).body.data.week.id as string;
const add = (weekId: string, body: Record<string, unknown>) => request(app).post(`/api/exec/weeks/${weekId}/outcomes`).send(body);
const outcome = (title: string) => ({ title, category: 'office', definitionOfDone: 'It exists' });

describe('/api/exec/weeks', () => {
  it('looks a week up without creating it', async () => {
    const res = await request(app).get('/api/exec/weeks?date=2026-09-22');
    expect(res.body).toEqual({ success: true, data: { current: null, previous: null, hasHistory: false } });
    expect(weekLookupSchema.safeParse(res.body.data).success).toBe(true);
    expect(exec.prepare('SELECT COUNT(*) FROM weeks').pluck().get()).toBe(0);
  });

  it('creates the week once (201 then 200) and reads it by id', async () => {
    const first = await request(app).post('/api/exec/weeks').send({ date: '2026-09-23' });
    expect(first.status).toBe(201);
    expect(weekViewSchema.safeParse(first.body.data).success).toBe(true);
    expect(first.body.data.week.startDate).toBe('2026-09-20');
    const second = await request(app).post('/api/exec/weeks').send({ date: '2026-09-26' });
    expect(second.status).toBe(200);
    expect(second.body.data.week.id).toBe(first.body.data.week.id);
    expect((await request(app).get(`/api/exec/weeks/${first.body.data.week.id}`)).body.data.week.startDate).toBe('2026-09-20');
  });

  it('starts the week on the configured weekday', async () => {
    exec.prepare('UPDATE settings SET week_start_day = 1 WHERE id = 1').run();
    const res = await request(app).post('/api/exec/weeks').send({ date: '2026-09-22' });
    expect(res.body.data.week.startDate).toBe('2026-09-21');
  });

  it('answers 404 for an unknown week and 400 for a bad date', async () => {
    const missing = { success: false, error: 'no such week', code: 'NOT_FOUND' };
    expect((await request(app).get('/api/exec/weeks/nope')).body).toEqual(missing);
    expect((await add('nope', outcome('A'))).body).toEqual(missing);
    expect((await request(app).get('/api/exec/weeks?date=2026-09-31')).status).toBe(400);
    expect((await request(app).get('/api/exec/weeks')).status).toBe(400);
  });
});

describe('POST /api/exec/weeks/:id/outcomes', () => {
  it('adds up to three outcomes and refuses a fourth with WEEK_FULL listing them', async () => {
    const weekId = await ensure();
    for (const [index, title] of ['A', 'B', 'C'].entries()) {
      const res = await add(weekId, outcome(title));
      expect(res.status).toBe(201);
      expect(outcomeSchema.safeParse(res.body.data).success).toBe(true);
      expect(res.body.data.slot).toBe(index + 1);
    }
    const fourth = await add(weekId, outcome('D'));
    expect(fourth.status).toBe(409);
    expect(fourth.body).toMatchObject({ success: false, code: 'WEEK_FULL', error: 'the week already has three outcomes' });
    expect(fourth.body.details.outcomes.map((o: { title: string }) => o.title)).toEqual(['A', 'B', 'C']);
  });

  it('replaces an outcome atomically and refuses a replace target from elsewhere', async () => {
    const weekId = await ensure();
    const ids: string[] = [];
    for (const title of ['A', 'B', 'C']) ids.push((await add(weekId, outcome(title))).body.data.id);
    const replaced = await add(weekId, { ...outcome('D'), replace: { outcomeId: ids[1], reason: 'priority_changed' } });
    expect(replaced.status).toBe(201);
    expect(replaced.body.data.slot).toBe(2);
    const view = (await request(app).get(`/api/exec/weeks/${weekId}`)).body.data;
    expect(view.outcomes.map((o: { title: string; status: string }) => [o.title, o.status])).toEqual([
      ['A', 'active'],
      ['D', 'active'],
      ['C', 'active'],
      ['B', 'killed'],
    ]);

    const otherWeek = await ensure('2026-09-29');
    const foreign = (await add(otherWeek, outcome('X'))).body.data.id;
    const refused = await add(weekId, { ...outcome('E'), replace: { outcomeId: foreign, reason: 'other' } });
    expect(refused.body).toEqual({ success: false, error: 'the outcome to replace is not in this week', code: 'VALIDATION' });
  });

  it('rejects a slot, a timestamp or an unknown category in the body', async () => {
    const weekId = await ensure();
    expect((await add(weekId, { ...outcome('A'), slot: 3 })).status).toBe(400);
    expect((await add(weekId, { ...outcome('A'), createdAt: '2026-09-22T03:00:00.000Z' })).status).toBe(400);
    expect((await add(weekId, { title: 'A', category: 'hobby' })).status).toBe(400);
  });
});

describe('/api/exec/outcomes', () => {
  it('patches progress, marks done, and refuses to reopen a killed outcome', async () => {
    const weekId = await ensure();
    const id = (await add(weekId, outcome('A'))).body.data.id;
    expect((await request(app).patch(`/api/exec/outcomes/${id}`).send({ progress: 60 })).body.data.progress).toBe(60);
    expect((await request(app).patch(`/api/exec/outcomes/${id}`).send({ status: 'done' })).body.data).toMatchObject({ status: 'done', progress: 100 });
    await request(app).patch(`/api/exec/outcomes/${id}`).send({ status: 'active' });
    await request(app).patch(`/api/exec/outcomes/${id}`).send({ status: 'killed' });
    const reopen = await request(app).patch(`/api/exec/outcomes/${id}`).send({ status: 'active' });
    expect(reopen.body).toEqual({ success: false, error: 'a killed outcome cannot be reopened; add it again', code: 'VALIDATION' });
  });

  it('refuses to kill a done outcome, by patch or as a replace target, and changes nothing', async () => {
    const weekId = await ensure();
    const ids: string[] = [];
    for (const title of ['A', 'B', 'C']) ids.push((await add(weekId, outcome(title))).body.data.id);
    await request(app).patch(`/api/exec/outcomes/${ids[1]}`).send({ status: 'done' });
    const killed = await request(app).patch(`/api/exec/outcomes/${ids[1]}`).send({ status: 'killed', reviewReason: 'other' });
    expect(killed.status).toBe(400);
    expect(killed.body).toEqual({ success: false, error: 'a finished outcome keeps its slot; reopen it first', code: 'VALIDATION' });
    const before = (await request(app).get(`/api/exec/weeks/${weekId}`)).body.data;
    const replaced = await add(weekId, { ...outcome('D'), replace: { outcomeId: ids[1], reason: 'other' } });
    expect(replaced.status).toBe(400);
    expect(replaced.body).toEqual({ success: false, error: 'a finished outcome keeps its slot', code: 'VALIDATION' });
    expect((await request(app).get(`/api/exec/weeks/${weekId}`)).body.data).toEqual(before);
  });

  it('answers 404 for an unknown outcome and 400 for an empty or slot patch', async () => {
    const missing = { success: false, error: 'no such outcome', code: 'NOT_FOUND' };
    expect((await request(app).patch('/api/exec/outcomes/nope').send({ progress: 1 })).body).toEqual(missing);
    const weekId = await ensure();
    const id = (await add(weekId, outcome('A'))).body.data.id;
    expect((await request(app).patch(`/api/exec/outcomes/${id}`).send({})).status).toBe(400);
    expect((await request(app).patch(`/api/exec/outcomes/${id}`).send({ slot: 2 })).status).toBe(400);
  });

  it('rolls into another week (201), returns the same copy again (200) and 404s unknowns', async () => {
    const weekId = await ensure();
    const nextWeek = await ensure('2026-09-29');
    const id = (await add(weekId, outcome('A'))).body.data.id;
    const first = await request(app).post(`/api/exec/outcomes/${id}/roll`).send({ weekId: nextWeek });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ weekId: nextWeek, rolledFromId: id, targetDate: '2026-10-02' });
    const again = await request(app).post(`/api/exec/outcomes/${id}/roll`).send({ weekId: nextWeek });
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect((await request(app).post('/api/exec/outcomes/nope/roll').send({ weekId: nextWeek })).body.code).toBe('NOT_FOUND');
    const unknownWeek = await request(app).post(`/api/exec/outcomes/${id}/roll`).send({ weekId: '4f5a1b3c-2d7e-4c9a-8b1f-0a2b3c4d5e6f' });
    expect(unknownWeek.body).toEqual({ success: false, error: 'no such week', code: 'NOT_FOUND' });
  });
});
