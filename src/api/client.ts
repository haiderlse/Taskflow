import type { ApiResponse, ErrorCode } from '../shared/exec/api';

export const EXEC_API_BASE = '/api/exec';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** What every failed call rejects with, so screens can branch on `code`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode | 'NETWORK',
    message: string,
    readonly details?: unknown,
    cause?: unknown
  ) {
    super(message, { cause });
    this.name = 'ApiError';
  }
}

async function readEnvelope<T>(res: Response): Promise<ApiResponse<T> | null> {
  try {
    const body = (await res.json()) as ApiResponse<T>;
    return typeof body === 'object' && body !== null && 'success' in body ? body : null;
  } catch {
    return null;
  }
}

async function call<T>(method: Method, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${EXEC_API_BASE}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new ApiError(0, 'NETWORK', 'The local API is not reachable', undefined, cause);
  }
  const envelope = await readEnvelope<T>(res);
  if (envelope === null) throw new ApiError(res.status, 'INTERNAL', 'The API returned an unreadable response');
  if (!envelope.success) throw new ApiError(res.status, envelope.code, envelope.error, envelope.details);
  return envelope.data;
}

export const api = {
  get: <T>(path: string) => call<T>('GET', path),
  post: <T>(path: string, body: unknown) => call<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => call<T>('PATCH', path, body),
  put: <T>(path: string, body: unknown) => call<T>('PUT', path, body),
  delete: <T>(path: string) => call<T>('DELETE', path),
};
