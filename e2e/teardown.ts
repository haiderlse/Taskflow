import { rmSync } from 'node:fs';

/** Removes the temporary database directory the config created for this run. */
export default function teardown(): void {
  const dir = process.env.TASKFLOW_E2E_DATA_DIR;
  if (dir) rmSync(dir, { recursive: true, force: true });
}
