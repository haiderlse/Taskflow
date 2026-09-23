import path from 'node:path';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { API_HOST, apiPort, bindHost, allowedHosts, isLoopback } from './server/config';

export default defineConfig(() => {
  const host = bindHost(process.env);
  if (!isLoopback(host)) {
    // Operator-facing: /api proxies to an unauthenticated API, so anything that can reach
    // this server can read and change all data. Only bind beyond loopback on a private tailnet.
    console.warn(`[taskflow] Vite is bound to ${host}; the /api proxy is reachable from that network.`);
  }
  return {
    plugins: [tailwindcss()],
    server: {
      host,
      port: 3000,
      allowedHosts: allowedHosts(process.env),
      // process.env, not a .env file: server/index.ts reads only the shell environment,
      // so this keeps the proxy and the API on the same port.
      proxy: { '/api': { target: `http://${API_HOST}:${apiPort(process.env)}`, changeOrigin: true } },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        // The legacy workspace is imported as 'legacy-app' so the strict TypeScript
        // program never follows the import into the untyped legacy tree.
        'legacy-app': path.resolve(__dirname, 'App.tsx'),
      },
    },
  };
});
