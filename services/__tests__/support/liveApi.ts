import { vi } from 'vitest';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { openDb, initSchema } from '../../../server/db/connection';
import { seed } from '../../../server/db/seed';
import { createApp } from '../../../server/app';

export type ApiCall = { method: string; path: string; body?: unknown };

export type LiveApi = {
  db: ReturnType<typeof openDb>;
  calls: ApiCall[];
  stop: () => Promise<void>;
};

// Captured at import, before any stub, so the forwarding wrapper never calls itself.
const realFetch = globalThis.fetch;

/**
 * Starts the real Express app on a fresh seeded in-memory database and points the browser
 * client's same-origin '/api/...' requests at it (Vite proxies them in dev). Every request
 * is recorded so tests can assert exactly which writes were made.
 */
export async function startLiveApi(): Promise<LiveApi> {
  const db = openDb(':memory:');
  initSchema(db);
  seed(db);
  const server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const calls: ApiCall[] = [];
  vi.stubGlobal('fetch', (path: string, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    calls.push({ method: init?.method ?? 'GET', path, body });
    return realFetch(`${origin}${path}`, init);
  });

  return {
    db,
    calls,
    stop: async () => {
      vi.unstubAllGlobals();
      server.closeAllConnections(); // fetch keeps connections alive, which would stall close()
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
