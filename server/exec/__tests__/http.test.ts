import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError, execErrorHandler } from '../http';
import { BadRequestError } from '../../db/sql';

function fakeResponse() {
  const res = {
    statusCode: 0,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

const run = (err: unknown) => {
  const res = fakeResponse();
  execErrorHandler(err, {} as Request, res as unknown as Response, () => {});
  return res;
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('execErrorHandler', () => {
  it('sends an ApiError as its status, code, message and details', () => {
    const res = run(new ApiError(409, 'WEEK_FULL', 'the week already has three outcomes', { outcomes: [] }));
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: 'the week already has three outcomes',
      code: 'WEEK_FULL',
      details: { outcomes: [] },
    });
  });

  it('omits details when an ApiError has none', () => {
    const res = run(new ApiError(404, 'NOT_FOUND', 'no such task'));
    expect(res.body).toEqual({ success: false, error: 'no such task', code: 'NOT_FOUND' });
  });

  it('turns a zod failure into 400 VALIDATION with the failing paths, never the input', () => {
    const result = z.object({ title: z.string(), context: z.enum(['work', 'build']) }).safeParse({ context: 'home' });
    const res = run(result.error);
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, code: 'VALIDATION', error: 'invalid request body' });
    const details = (res.body as { details: { path: string }[] }).details;
    expect(details.map((d) => d.path).sort()).toEqual(['context', 'title']);
    expect(JSON.stringify(res.body)).not.toContain('home');
  });

  it('maps body-parser rejections to their 4xx status', () => {
    const tooLarge = run(Object.assign(new Error('request entity too large'), { status: 413 }));
    expect(tooLarge.statusCode).toBe(413);
    expect(tooLarge.body).toEqual({ success: false, error: 'request body too large', code: 'VALIDATION' });

    const malformed = run(Object.assign(new Error('Unexpected token'), { status: 400 }));
    expect(malformed.body).toEqual({ success: false, error: 'invalid request body', code: 'VALIDATION' });
  });

  it('maps a BadRequestError to 400 VALIDATION with its message', () => {
    const res = run(new BadRequestError('unknown column: pwned'));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'invalid request body', code: 'VALIDATION' });
  });

  it('never echoes an unknown column name', () => {
    const res = run(new BadRequestError('unknown column: evil'));
    expect(JSON.stringify(res.body)).not.toContain('evil');
  });

  it('maps SQLite constraint failures to 400 CONSTRAINT without the driver message', () => {
    const res = run(Object.assign(new Error('UNIQUE constraint failed: must_ships.date'), { code: 'SQLITE_CONSTRAINT_UNIQUE' }));
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'constraint violation', code: 'CONSTRAINT' });
  });

  it('hides everything else behind 500 INTERNAL', () => {
    const res = run(new Error('boom at /mnt/secret/path.ts:12'));
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ success: false, error: 'internal server error', code: 'INTERNAL' });
    expect(JSON.stringify(res.body)).not.toContain('/mnt/');
  });
});
