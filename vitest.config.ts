import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'services/**/*.test.ts'],
    coverage: {
      include: ['server/**/*.ts', 'services/apiClient.ts', 'services/apiSync.ts'],
      exclude: ['server/index.ts'],
      thresholds: { lines: 80 },
    },
  },
});
