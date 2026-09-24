import { vi } from 'vitest';

export type FetchCall = { url: string; method: string; body?: unknown };

/** Stubs global fetch; `handler` answers each call and every call is recorded for assertions. */
export function stubFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): FetchCall[] {
  const calls: FetchCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      return handler(url, init);
    })
  );
  return calls;
}

const headers = { 'content-type': 'application/json' };

export const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify({ success: true, data }), { status, headers });

export const failure = (status: number, code: string, error: string): Response =>
  new Response(JSON.stringify({ success: false, error, code }), { status, headers });
