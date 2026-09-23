/** The response envelope of every /api/exec route, shared by server and client. */

export const ERROR_CODES = [
  'VALIDATION',
  'NOT_FOUND',
  'WEEK_FULL',
  'DAY_TAKEN',
  'SLOT_LIMIT',
  'SHUTDOWN_NOT_READY',
  'DELETE_NOT_ALLOWED',
  'CONSTRAINT',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = { success: false; error: string; code: ErrorCode; details?: unknown };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type Health = { status: 'ok'; schemaVersion: number };
