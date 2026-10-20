import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import {
  RULES_VERSION,
  MAX_RUN_SPEED,
  challengeAtDistance,
} from '../src/game/challenges.ts';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const nickname = (value) =>
  typeof value === 'string' && /^[\p{L}\p{N} _-]{3,20}$/u.test(value.trim())
    ? value.trim()
    : null;
export function createLeaderboard({
  database = ':memory:',
  now = () => Date.now(),
  origins = [],
  trustProxy = false,
} = {}) {
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS players(id TEXT PRIMARY KEY, name TEXT NOT NULL, token_hash TEXT UNIQUE NOT NULL);
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, player_id TEXT NOT NULL REFERENCES players(id), day TEXT NOT NULL, started INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS scores(player_id TEXT NOT NULL REFERENCES players(id), day TEXT NOT NULL, distance INTEGER NOT NULL, duration REAL NOT NULL, achieved INTEGER NOT NULL, rules TEXT NOT NULL, PRIMARY KEY(player_id,day,rules));
    CREATE INDEX IF NOT EXISTS score_rules ON scores(rules,day,distance DESC);`);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(express.json({ limit: '4kb' }));
  const api = express.Router();
  const buckets = new Map();
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const origin = req.get('origin');
    if (origin && origins.includes(origin)) {
      res.set('Access-Control-Allow-Origin', origin).vary('Origin');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    } else if (origin && origin !== `${req.protocol}://${req.get('host')}`)
      return res.status(403).json({ error: 'Origin is not allowed.' });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    const key = req.ip;
    const time = now();
    let bucket = buckets.get(key);
    if (!bucket && buckets.size >= 10000) {
      for (const [ip, entry] of buckets)
        if (entry.expires <= time) buckets.delete(ip);
      if (buckets.size >= 10000)
        return res
          .status(503)
          .json({ error: 'Leaderboard is busy. Try again shortly.' });
    }
    if (!bucket || time >= bucket.expires) {
      bucket = { expires: time + 60000, count: 0, registrations: 0 };
      buckets.set(key, bucket);
      if (buckets.size > 10000)
        for (const [ip, entry] of buckets)
          if (entry.expires <= time) buckets.delete(ip);
    }
    if (
      ++bucket.count > 120 ||
      (req.path === '/players' && ++bucket.registrations > 5)
    )
      return res
        .status(429)
        .json({ error: 'Too many requests. Try again in a minute.' });
    next();
  });
  const authenticate = (req, res, next) => {
    const token = req
      .get('authorization')
      ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const player =
      token &&
      db
        .prepare('SELECT id,name FROM players WHERE token_hash=?')
        .get(digest(token));
    if (!player)
      return res
        .status(401)
        .json({ error: 'Reconnect your leaderboard profile.' });
    req.player = player;
    next();
  };
  const rankBoard = (day, playerId) => {
    const cte = `WITH best AS (
      SELECT s.player_id, MAX(s.distance) distance FROM scores s
      WHERE s.rules=? AND (? IS NULL OR s.day=?) GROUP BY s.player_id
    ), ranked AS (
      SELECT p.id,p.name,b.distance,RANK() OVER (ORDER BY b.distance DESC) rank
      FROM best b JOIN players p ON p.id=b.player_id
    )`;
    const entries = db
      .prepare(cte + ' SELECT * FROM ranked ORDER BY rank,id LIMIT 50')
      .all(RULES_VERSION, day, day);
    const totalPlayers = db
      .prepare(
        'SELECT COUNT(DISTINCT player_id) count FROM scores WHERE rules=? AND (? IS NULL OR day=?)',
      )
      .get(RULES_VERSION, day, day).count;
    const me = playerId
      ? db
          .prepare(cte + ' SELECT * FROM ranked WHERE id=?')
          .get(RULES_VERSION, day, day, playerId) || null
      : null;
    return {
      rules: RULES_VERSION,
      day,
      totalPlayers,
      entries: entries.map((row) => ({
        ...row,
        challengeLevel: challengeAtDistance(row.distance).level,
      })),
      me,
    };
  };

  api.get('/health', (_req, res) =>
    res.json({ ok: true, rules: RULES_VERSION }),
  );
  api.post('/players', (req, res) => {
    const name = nickname(req.body?.name);
    if (!name)
      return res
        .status(400)
        .json({
          error: 'Use 3–20 letters, numbers, spaces, underscores or hyphens.',
        });
    const id = randomUUID(),
      token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO players(id,name,token_hash) VALUES(?,?,?)').run(
      id,
      name,
      digest(token),
    );
    res.status(201).json({ id, name, token });
  });
  api.get('/rankings', (req, res) => {
    const day =
      req.query.period === 'daily'
        ? new Date(now()).toISOString().slice(0, 10)
        : null;
    const token = req
      .get('authorization')
      ?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
    const player =
      token &&
      db
        .prepare('SELECT id FROM players WHERE token_hash=?')
        .get(digest(token));
    res.json(rankBoard(day, player?.id));
  });
  api.post('/runs', authenticate, (req, res) => {
    const started = now(),
      day = new Date(started).toISOString().slice(0, 10),
      id = randomUUID();
    // One active ticket per player. Expired tickets do not accumulate indefinitely.
    db.prepare('DELETE FROM runs WHERE player_id=? OR started<?').run(
      req.player.id,
      started - 86400000,
    );
    db.prepare(
      'INSERT INTO runs(id,player_id,day,started) VALUES(?,?,?,?)',
    ).run(id, req.player.id, day, started);
    res.status(201).json({ id, day, rules: RULES_VERSION });
  });
  api.post('/runs/:id/finish', authenticate, (req, res) => {
    const run = db
      .prepare('SELECT * FROM runs WHERE id=? AND player_id=?')
      .get(req.params.id, req.player.id);
    if (!run)
      return res
        .status(404)
        .json({ error: 'This ranked run is unavailable. Start a new run.' });
    if (run.used) return res.json(rankBoard(run.day, req.player.id)); // Idempotent retries never change a score.
    const { distance, durationSeconds, rules } = req.body || {};
    const wallSeconds = (now() - run.started) / 1000;
    if (wallSeconds > 86400)
      return res
        .status(410)
        .json({ error: 'Ranked run expired after 24 hours.' });
    if (rules !== RULES_VERSION)
      return res
        .status(409)
        .json({ error: 'Game rules changed. Update the game before ranking.' });
    if (
      !Number.isSafeInteger(distance) ||
      distance < 0 ||
      distance > 5000000 ||
      !Number.isFinite(durationSeconds) ||
      durationSeconds < 0.25 ||
      durationSeconds > 86400 ||
      durationSeconds > wallSeconds + 2 ||
      distance > durationSeconds * MAX_RUN_SPEED + 3
    )
      return res
        .status(400)
        .json({ error: 'Run timing or distance is invalid.' });
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE runs SET used=1 WHERE id=?').run(run.id);
      db.prepare(
        `INSERT INTO scores(player_id,day,distance,duration,achieved,rules) VALUES(?,?,?,?,?,?)
        ON CONFLICT(player_id,day,rules) DO UPDATE SET distance=excluded.distance,duration=excluded.duration,achieved=excluded.achieved WHERE excluded.distance>scores.distance`,
      ).run(
        req.player.id,
        run.day,
        distance,
        durationSeconds,
        now(),
        RULES_VERSION,
      );
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
    res.json(rankBoard(run.day, req.player.id));
  });
  api.use((_req, res) =>
    res.status(404).json({ error: 'Leaderboard endpoint not found.' }),
  );
  app.use('/api/leaderboard', api);
  app.use((error, _req, res, _next) => {
    const status =
      error.status === 413
        ? 413
        : error.type === 'entity.parse.failed'
          ? 400
          : 500;
    res
      .status(status)
      .json({
        error:
          status === 500
            ? 'Leaderboard temporarily unavailable.'
            : 'Invalid request body.',
      });
  });
  return { app, close: () => db.close() };
}
