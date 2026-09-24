import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createApp } from './app';
import { API_HOST, apiPort, execDbPath } from './config';

const PORT = apiPort(process.env); // validate config before touching the filesystem

mkdirSync('data', { recursive: true });
// EXEC_DB_PATH may point outside data/; better-sqlite3 does not create parent directories.
mkdirSync(dirname(execDbPath(process.env)), { recursive: true });

const app = createApp();
const server = app.listen(PORT, API_HOST, () => {
  console.log(`TaskFlow API listening on http://${API_HOST}:${PORT}`);
});

const shutdown = () => {
  server.close(() => {
    app.locals.closeDatabases();
    process.exit(0);
  });
};
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
