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
