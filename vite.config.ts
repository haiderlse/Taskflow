import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');

    return {
      // GitHub Pages serves the app from /<repo-name>/, so every asset URL needs
      // that prefix or it 404s. The deploy workflow sets VITE_BASE_PATH; local
      // dev and preview stay on '/'.
      base: env.VITE_BASE_PATH || '/',
      server: { host: '0.0.0.0', port: 3000, allowedHosts: true },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
