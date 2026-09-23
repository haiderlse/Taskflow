import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // The legacy workspace is imported as 'legacy-app' so the strict TypeScript
    // program never follows the import into the untyped legacy tree.
    alias: { 'legacy-app': path.resolve(__dirname, 'App.tsx') },
  },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['server/**/*.test.ts', 'services/**/*.test.ts', 'src/shared/**/*.test.ts'],
        },
      },
      {
        test: {
          name: 'jsdom',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/shared/**', 'node_modules/**'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
    ],
    coverage: {
      include: ['server/**/*.ts', 'services/apiClient.ts', 'services/apiSync.ts', 'src/**/*.{ts,tsx}'],
      exclude: [
        'server/index.ts',
        'src/**/*.test.*',
        'src/test/**',
        'src/app/Legacy.tsx',
        'src/**/*.d.ts',
      ],
      thresholds: { lines: 80 },
    },
  },
});
