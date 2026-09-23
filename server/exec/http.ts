import type { ErrorRequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import type { ErrorCode } from '../../src/shared/exec/api';

/** An error a route raises on purpose; the handler sends it as-is. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function ok(res: Response, data: unknown, status = 200): void {
  res.status(status).json({ success: true, data });
}

export function fail(res: Response, status: number, code: ErrorCode, error: string, details?: unknown): void {
  const body = details === undefined ? { success: false, error, code } : { success: false, error, code, details };
  res.status(status).json(body);
}

const httpStatus = (err: unknown): number | undefined => {
  const status = (err as { status?: unknown } | null | undefined)?.status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
};

const sqliteCode = (err: unknown): string | undefined => {
  const code = (err as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && code.startsWith('SQLITE_CONSTRAINT') ? code : undefined;
};

/**
 * Never a stack trace, never a path, never a driver message: only a short,
 * safe description and a code the client can branch on.
 */
export const execErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ApiError) {
    fail(res, err.status, err.code, err.message, err.details);
    return;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    fail(res, 400, 'VALIDATION', 'invalid request body', details);
    return;
  }
  const status = httpStatus(err);
  if (status !== undefined) {
    fail(res, status, 'VALIDATION', status === 413 ? 'request body too large' : 'invalid request body');
    return;
  }
  if (sqliteCode(err) !== undefined) {
    console.error('Constraint violation:', err);
    fail(res, 400, 'CONSTRAINT', 'constraint violation');
    return;
  }
  console.error('Unhandled error:', err);
  fail(res, 500, 'INTERNAL', 'internal server error');
};
