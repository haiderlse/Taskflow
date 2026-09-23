import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import request from 'supertest';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';

function legacyDb() {
  const db = openDb(':memory:');
  initSchema(db);
  return db;
}

describe('GET /api/exec/health', () => {
  it('answers in the envelope with the schema version', async () => {
    const app = createApp(legacyDb(), prepareExecDb(':memory:'));
    const res = await request(app).get('/api/exec/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { status: 'ok', schemaVersion: 1 } });
  });

  it('opens an in-memory execution database, never a file, when none is injected under the test runner', async () => {
    const before = existsSync('data/execution.db');
    const app = createApp(legacyDb());
    const res = await request(app).get('/api/exec/health');
    expect(res.status).toBe(200);
    expect(existsSync('data/execution.db')).toBe(before);
  });

  it('leaves the legacy health route untouched', async () => {
    const res = await request(createApp(legacyDb(), prepareExecDb(':memory:'))).get('/api/health');
    expect(res.body).toEqual({ status: 'ok' });
  });
});
