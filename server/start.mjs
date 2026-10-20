import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import express from 'express';
import { createLeaderboard } from './leaderboard.mjs';
const database = process.env.LEADERBOARD_DB || './data/leaderboard.sqlite';
mkdirSync(dirname(database), { recursive: true });
const { app, close } = createLeaderboard({
  database,
  origins: (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY_HOPS
    ? Number(process.env.TRUST_PROXY_HOPS)
    : false,
});
if (process.env.SERVE_WEB === 'true') {
  app.use(express.static('dist'));
  app.get('*', (_req, res) => res.sendFile('index.html', { root: 'dist' }));
}
const server = app.listen(
  Number(process.env.PORT || 8787),
  process.env.HOST || '127.0.0.1',
  () => console.log('Leaderboard service started.'),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () =>
    server.close(() => {
      close();
      process.exit(0);
    }),
  );
