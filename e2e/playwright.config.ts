import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
import { API_PORT, WEB_PORT, BASE_URL } from './ports';

// A fresh database per run: the journeys start from "Plan your first week" every time.
// Playwright loads this config in more than one process; only the first creates the directory.
const dataDir = process.env.TASKFLOW_E2E_DATA_DIR ?? mkdtempSync(join(tmpdir(), 'taskflow-e2e-'));
process.env.TASKFLOW_E2E_DATA_DIR = dataDir;

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  outputDir: '../test-results',
  globalTeardown: './teardown.ts',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /phone\.spec\.ts/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec\.ts/ },
  ],
  webServer: [
    {
      command: 'npx tsx server/index.ts',
      cwd: '..', // Playwright runs webServer commands from the config's directory; the repo root is one level up
      url: `http://127.0.0.1:${API_PORT}/api/exec/health`,
      reuseExistingServer: false,
      env: {
        TASKFLOW_API_PORT: String(API_PORT),
        DB_PATH: join(dataDir, 'taskflow.db'),
        EXEC_DB_PATH: join(dataDir, 'execution.db'),
      },
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: '..', // Playwright runs webServer commands from the config's directory; the repo root is one level up
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: false,
      env: { TASKFLOW_API_PORT: String(API_PORT), TASKFLOW_BIND: '127.0.0.1' },
    },
  ],
});
