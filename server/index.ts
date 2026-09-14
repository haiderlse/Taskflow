import { mkdirSync } from 'node:fs';
import { createApp } from './app';
import { API_HOST, apiPort } from './config';

const PORT = apiPort(process.env); // validate config before touching the filesystem

mkdirSync('data', { recursive: true });

createApp().listen(PORT, API_HOST, () => {
  console.log(`TaskFlow API listening on http://${API_HOST}:${PORT}`);
});
