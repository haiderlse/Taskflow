// The API has no authentication, so it must never listen beyond this machine.
export const API_HOST = '127.0.0.1';

const DEFAULT_API_PORT = 4100;

/**
 * The API port, read by both server/index.ts and the Vite /api proxy so the two can never
 * disagree — a proxy pointed at the wrong port would send TaskFlow's writes to whatever
 * other local service owns it. An invalid value throws rather than falling back silently.
 */
export function apiPort(env: Record<string, string | undefined>): number {
  const raw = env.TASKFLOW_API_PORT;
  if (raw === undefined || raw === '') return DEFAULT_API_PORT;
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1 || port > 65535) {
    throw new Error(`TASKFLOW_API_PORT must be an integer from 1 to 65535, got "${raw}"`);
  }
  return port;
}

/** Where the execution system keeps its data. Tests and e2e runs point this at a temp file. */
export function execDbPath(env: Record<string, string | undefined>): string {
  return env.EXEC_DB_PATH || 'data/execution.db';
}

const LOOPBACK = '127.0.0.1';
const HOST_PATTERN = /^[A-Za-z0-9.\-:[\]]+$/;

/**
 * Where the Vite dev server listens. Loopback unless TASKFLOW_BIND names a
 * tailnet address or hostname; the API never follows it (API_HOST is fixed).
 */
export function bindHost(env: Record<string, string | undefined>): string {
  const raw = env.TASKFLOW_BIND;
  if (raw === undefined || raw === '') return LOOPBACK;
  if (!HOST_PATTERN.test(raw)) {
    throw new Error(`TASKFLOW_BIND must be an IP address or hostname, got "${raw}"`);
  }
  return raw;
}

export function isLoopback(host: string): boolean {
  return host === LOOPBACK || host === 'localhost' || host === '::1';
}

/** Undefined keeps Vite's default Host check, which blocks DNS rebinding. */
export function allowedHosts(env: Record<string, string | undefined>): string[] | undefined {
  const host = env.TASKFLOW_ALLOWED_HOST;
  return host ? [host] : undefined;
}
