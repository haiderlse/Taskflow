import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { type Router } from 'express';
import request from 'supertest';
import { z } from 'zod';
import { createApp } from '../../app';
import { openDb, initSchema } from '../../db/connection';
import { prepareExecDb } from '../db/prepare';
import { createExecRouter } from '../router';
import { ApiError } from '../http';
import { BadRequestError } from '../../db/sql';

function legacyDb() {
  const db = openDb(':memory:');
  initSchema(db);
  return db;
}

function realApp() {
  return createApp(legacyDb(), prepareExecDb(':memory:'));
}

/** Mounts createExecRouter directly with an `extend` hook, the same way createApp mounts it in production, minus the hook. */
function appWithExtendedExecRouter(extend: (router: Router) => void) {
  const app = express();
  app.use('/api/exec', createExecRouter(prepareExecDb(':memory:'), { extend }));
  return app;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the /api/exec envelope, end to end', () => {
  it('keeps the envelope for a malformed body', async () => {
    const res = await request(realApp())
      .post('/api/exec/health')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'invalid request body', code: 'VALIDATION' });
  });

  it('keeps the envelope for an oversized body', async () => {
    const res = await request(realApp())
      .post('/api/exec/health')
      .set('Content-Type', 'application/json')
      .send({ padding: 'a'.repeat(6 * 1024 * 1024) });
    expect(res.status).toBe(413);
    expect(res.body).toEqual({ success: false, error: 'request body too large', code: 'VALIDATION' });
  });

  it('keeps the envelope for an unknown /api/exec path', async () => {
    const res = await request(realApp()).get('/api/exec/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'no such endpoint', code: 'NOT_FOUND' });
    expect(res.headers['content-type']).toMatch(/json/);
  });

  it('does not change the legacy health route', async () => {
    const res = await request(realApp()).get('/api/health');
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('does not change legacy malformed-JSON handling', async () => {
    const res = await request(realApp())
      .post('/api/tasks')
      .set('Content-Type', 'application/json')
      .send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'invalid request body' });
  });

  it('sends an ApiError through a real mount as its status, code and message', async () => {
    const app = appWithExtendedExecRouter((router) => {
      router.get('/throws-api-error', (_req, _res, next) => next(new ApiError(404, 'NOT_FOUND', 'no such task')));
    });
    const res = await request(app).get('/api/exec/throws-api-error');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'no such task', code: 'NOT_FOUND' });
  });

  it('sends a ZodError through a real mount as 400 VALIDATION', async () => {
    const app = appWithExtendedExecRouter((router) => {
      router.get('/throws-zod', (_req, _res, next) => {
        const result = z.object({ title: z.string() }).safeParse({});
        next(result.error);
      });
    });
    const res = await request(app).get('/api/exec/throws-zod');
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'VALIDATION', error: 'invalid request body' });
  });

  it('sends a BadRequestError through a real mount as 400 VALIDATION', async () => {
    const app = appWithExtendedExecRouter((router) => {
      router.get('/throws-bad-request', (_req, _res, next) => next(new BadRequestError('unknown column: pwned')));
    });
    const res = await request(app).get('/api/exec/throws-bad-request');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'invalid request body', code: 'VALIDATION' });
  });

  it('sends a SQLITE_CONSTRAINT error through a real mount as 400 CONSTRAINT', async () => {
    const app = appWithExtendedExecRouter((router) => {
      router.get('/throws-constraint', (_req, _res, next) =>
        next(Object.assign(new Error('UNIQUE constraint failed: must_ships.date'), { code: 'SQLITE_CONSTRAINT_UNIQUE' }))
      );
    });
    const res = await request(app).get('/api/exec/throws-constraint');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'constraint violation', code: 'CONSTRAINT' });
  });

  it('sends an unknown Error through a real mount as 500 INTERNAL with no path or stack', async () => {
    const app = appWithExtendedExecRouter((router) => {
      router.get('/throws-unknown', (_req, _res, next) => next(new Error('boom at /mnt/secret/path.ts:12')));
    });
    const res = await request(app).get('/api/exec/throws-unknown');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'internal server error', code: 'INTERNAL' });
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('/mnt/');
    expect(raw).not.toContain('at ');
  });
});
