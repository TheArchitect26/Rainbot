import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLeaderboard } from '../server/leaderboard.mjs';
import { RULES_VERSION } from '../src/game/challenges';

test('shared leaderboard authenticates, ranks multiple players, handles ties, replay, rollover and restart', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'rainbot-ranks-'));
  const database = join(dir, 'scores.sqlite');
  let now = Date.parse('2026-10-20T12:00:00Z');
  let service = createLeaderboard({ database, now: () => now });
  let server = service.app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const url = () =>
    `http://127.0.0.1:${(server.address() as any).port}/api/leaderboard`;
  const req = async (
    path: string,
    player?: any,
    body?: unknown,
    headers = {},
  ) => {
    const response = await fetch(url() + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...headers,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(player ? { Authorization: `Bearer ${player.token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, data: await response.json() };
  };
  const stop = async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((e) => (e ? reject(e) : resolve())),
    );
    service.close();
  };
  try {
    assert.equal((await req('/runs', null, {})).status, 401);
    assert.equal(
      (await req('/players', null, { name: '<script>' })).status,
      400,
    );
    assert.equal(
      (
        await req('/rankings', null, undefined, {
          Origin: 'https://untrusted.invalid',
        })
      ).status,
      403,
    );
    const one = (await req('/players', null, { name: 'Runner One' })).data;
    const two = (await req('/players', null, { name: 'Runner Two' })).data;
    const r1 = (await req('/runs', one, {})).data;
    const r2 = (await req('/runs', two, {})).data;
    now += 30000;
    assert.equal(
      (
        await req(`/runs/${r1.id}/finish`, two, {
          distance: 200,
          durationSeconds: 20,
          rules: RULES_VERSION,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await req(`/runs/${r1.id}/finish`, one, {
          distance: 999999,
          durationSeconds: 20,
          rules: RULES_VERSION,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req(`/runs/${r1.id}/finish`, one, {
          distance: 200,
          durationSeconds: 200,
          rules: RULES_VERSION,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await req(`/runs/${r1.id}/finish`, one, {
          distance: 200,
          durationSeconds: 20,
          rules: 'old',
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await req(`/runs/${r1.id}/finish`, one, {
          distance: 200,
          durationSeconds: 20,
          rules: RULES_VERSION,
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await req(`/runs/${r2.id}/finish`, two, {
          distance: 300,
          durationSeconds: 20,
          rules: RULES_VERSION,
        })
      ).status,
      200,
    );
    // Replayed finish with inflated distance is idempotent and never changes the stored score.
    await req(`/runs/${r1.id}/finish`, one, {
      distance: 999,
      durationSeconds: 20,
      rules: RULES_VERSION,
    });
    let board = (await req('/rankings?period=daily', one)).data;
    assert.equal(board.me.rank, 2);
    assert.equal(board.me.distance, 200);
    assert.equal(board.entries[0].name, 'Runner Two');
    const r3 = (await req('/runs', one, {})).data;
    now += 30000;
    await req(`/runs/${r3.id}/finish`, one, {
      distance: 300,
      durationSeconds: 20,
      rules: RULES_VERSION,
    });
    board = (await req('/rankings?period=all', one)).data;
    assert.deepEqual(
      board.entries.map((e: any) => e.rank),
      [1, 1],
    );
    assert.equal(board.totalPlayers, 2);
    now += 86400000;
    assert.equal((await req('/rankings?period=daily')).data.entries.length, 0);
    assert.equal((await req('/rankings?period=all')).data.entries.length, 2);
    const expired = (await req('/runs', one, {})).data;
    now += 86401000;
    assert.equal(
      (
        await req(`/runs/${expired.id}/finish`, one, {
          distance: 30,
          durationSeconds: 2,
          rules: RULES_VERSION,
        })
      ).status,
      410,
    );
    await stop();
    service = createLeaderboard({ database, now: () => now });
    server = service.app.listen(0, '127.0.0.1');
    await new Promise<void>((r) => server.once('listening', r));
    assert.equal(
      (await req('/rankings?period=all', one)).data.me.distance,
      300,
    );
  } finally {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
