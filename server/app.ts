import express from 'express';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  return app;
}
