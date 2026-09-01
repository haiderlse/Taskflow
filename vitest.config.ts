import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts'],
    coverage: { include: ['server/**/*.ts'], exclude: ['server/index.ts'], thresholds: { lines: 80 } },
  },
});
