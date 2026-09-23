import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const API_PORT = 4150;
const WEB_PORT = 3100;
// A fresh database per run: the journeys start from "Plan your first week" every time.
const dataDir = mkdtempSync(join(tmpdir(), 'taskflow-e2e-'));

export default defineConfig({
  testDir: '.',
  timeout: 30_000,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../playwright-report' }]],
  outputDir: '../test-results',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
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
