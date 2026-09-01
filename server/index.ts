import { createApp } from './app';

const PORT = 4000;
const HOST = '127.0.0.1'; // never 0.0.0.0 — no auth guards this API

createApp().listen(PORT, HOST, () => {
  console.log(`TaskFlow API listening on http://${HOST}:${PORT}`);
});
