import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { API_HOST, apiPort } from './server/config';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        // Loopback only: /api proxies to an unauthenticated API, so anything that can
        // reach this server could otherwise read and change all data. Vite's default
        // allowedHosts check stays on to block DNS rebinding from other websites.
        host: '127.0.0.1',
        port: 3000,
        // process.env, not loadEnv's .env values: server/index.ts reads only the shell
        // environment, so this keeps the proxy and the API on the same port.
        proxy: { '/api': { target: `http://${API_HOST}:${apiPort(process.env)}`, changeOrigin: true } },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
