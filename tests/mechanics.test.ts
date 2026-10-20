import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { hitsObstacle, awardXP, normalizeProgression } from '../src/utils/mechanics';
import { getDailySeed, SeededPRNG } from '../src/utils/prng';
import { generateDailyMissionsForDate, getOrRefreshDailyMissions } from '../src/types/missions';
import { LocalAnalyticsService } from '../src/utils/analytics';
import { storage, readNumber } from '../src/utils/storage';
import { ObstacleManager } from '../src/game/Obstacles';
import { CollectibleManager } from '../src/game/Collectibles';

// Storage substitute exercises the same persistence path without a browser.
const saved = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  },
});

test('swept collision catches a wall crossed entirely in one slow frame', () => {
  assert.equal(hitsObstacle('FULL_BLOCK', 0, -1, 0, -2, 0, false), true);
  assert.equal(hitsObstacle('FULL_BLOCK', 2.4, -1, 0, -2, 0, false), false);
  assert.equal(hitsObstacle('FULL_BLOCK', 1.34, -1, 0, -2, 0, false), true);
  assert.equal(hitsObstacle('FULL_BLOCK', 0, -5, 0, -2, 0, false), false);
});
test('jump, slide and drone vertical clearance', () => {
  assert.equal(hitsObstacle('LOW_BARRIER', 0, -1, 0, -1, 0.7, false), false);
  assert.equal(hitsObstacle('LOW_BARRIER', 0, -1, 0, -1, 0.5, false), true);
  assert.equal(hitsObstacle('HIGH_BARRIER', 0, -1, 0, -1, 0, true), false);
  assert.equal(hitsObstacle('HIGH_BARRIER', 0, -1, 0, -1, 1, true), true);
  assert.equal(hitsObstacle('MOVING_DRONE', 0, -1, 0, -1, 0, true, 1.6), false);
  assert.equal(hitsObstacle('FULL_BLOCK', 0, -1, 0, -1, 5, false), true);
});
test('progression repairs unsafe saves and awards every crossed milestone level', () => {
  assert.deepEqual(normalizeProgression({ level: -1, currentXP: NaN, xpToNextLevel: 0 }), {
    level: 1,
    currentXP: 0,
    totalXP: 0,
    xpToNextLevel: 120,
  });
  const result = awardXP(normalizeProgression(null), 500);
  assert.deepEqual(result.levels, [2, 3]);
  assert.equal(result.next.totalXP, 500);
  assert.equal(result.next.currentXP, 500 - 120 - Math.floor(120 * 2 ** 1.25));
  const followup = awardXP(result.next, 25);
  assert.equal(followup.next.totalXP, 525);
  assert.equal(awardXP(result.next, -10).next.totalXP, 500);
});
test('daily seeds and missions are repeatable and distinct', () => {
  const seed = getDailySeed('2026-10-19');
  const a = new SeededPRNG(seed),
    b = new SeededPRNG(seed);
  for (let i = 0; i < 10000; i++) {
    const value = a.next();
    assert.equal(value, b.next());
    assert.ok(value >= 0 && value < 1);
  }
  assert.notEqual(seed, getDailySeed('2026-10-20'));
  const missions = generateDailyMissionsForDate('2026-10-19');
  assert.deepEqual(missions, generateDailyMissionsForDate('2026-10-19'));
  assert.equal(new Set(missions.map((m) => m.id)).size, 3);
});
test('daily mission migration validates counters and rewards against current templates', () => {
  const date = new Date().toISOString().slice(0, 10);
  const missions = generateDailyMissionsForDate(date);
  saved.set(
    'brainrot_daily_missions_v3',
    JSON.stringify({
      date,
      missions: missions.map((m) => ({ ...m, rewardCoins: 999999, current: -10, claimed: true })),
    }),
  );
  const loaded = getOrRefreshDailyMissions();
  assert.deepEqual(loaded.missions, missions);
});
test('seeded obstacle motion repeats across pooled resets', () => {
  const manager = new ObstacleManager(new THREE.Scene());
  function spawn() {
    const rng = new SeededPRNG(123);
    manager.clear();
    manager.setRandom(() => rng.next());
    return Array.from({ length: 10 }, (_, i) => ({
      ...manager.spawnObstacle('MOVING_DRONE', 0, -i * 30),
    }));
  }
  const first = spawn();
  const meshCount = manager.group.children.length;
  assert.deepEqual(first, spawn());
  assert.equal(manager.group.children.length, meshCount); // Meshes reused, not recreated.
});
test('coin and power-up pools reuse geometry, material and meshes', () => {
  const manager = new CollectibleManager(new THREE.Scene());
  const first = manager.spawnCoin(0, -10);
  const mesh = manager.getCoinMesh(first.id)!;
  manager.removeCoin(first.id);
  const second = manager.spawnCoin(1, -20);
  assert.equal(manager.getCoinMesh(second.id), mesh);
  const power = manager.spawnPowerUp('SHIELD', 0, -30);
  const powerMesh = manager.getPowerUpMesh(power.id);
  manager.clear();
  assert.equal(manager.getPowerUpMesh(manager.spawnPowerUp('SHIELD', 1, -40).id), powerMesh);
});
test('diagnostics average stays bounded beyond 1000 samples and includes severe drops', () => {
  saved.delete('brainrot_diagnostics_v1');
  const analytics = new LocalAnalyticsService();
  for (let i = 0; i < 3000; i++) analytics.recordFPS(60, 1000 / 60);
  analytics.recordFPS(5, 200);
  const fps = analytics.getDiagnostics().fpsMetrics;
  assert.equal(fps.samples, 3001);
  assert.ok(fps.avgFps < 60 && fps.avgFps > 59);
  assert.equal(fps.minFps, 5);
  assert.equal(fps.spikes30, 1);
  assert.equal(fps.spikes50, 1);
});
test('diagnostics count start/death exactly once, retain precise averages and isolate reset', () => {
  saved.delete('brainrot_diagnostics_v1');
  const analytics = new LocalAnalyticsService();
  analytics.recordRunStart(false);
  analytics.recordRunEnd(1, 1, 0, 'LOW_BARRIER', false, 'ZONE 1', 1.25);
  analytics.recordRunEnd(1, 1, 0); // Duplicate callback is ignored.
  analytics.recordRunStart(true);
  analytics.recordRunEnd(2, 2, 0, 'FULL_BLOCK', true, 'ZONE 1', 2.75);
  analytics.recordRunStart(false);
  analytics.abandonRun();
  const data = analytics.getDiagnostics();
  assert.equal(data.totalRunsStarted, 3);
  assert.equal(data.totalRunsCompleted, 2);
  assert.equal(data.averageDistance, 1.5);
  assert.equal(data.averageRunDurationSeconds, 2);
  assert.equal(data.dailyChallengeRuns, 1);
  assert.equal(data.rapidRestarts, 2);
  assert.deepEqual(data.eliminationCauses, { LOW_BARRIER: 1, FULL_BLOCK: 1 });
  data.eliminationCauses.LOW_BARRIER = 999;
  assert.equal(analytics.getDiagnostics().eliminationCauses.LOW_BARRIER, 1);
  analytics.recordTutorialStart(false);
  analytics.recordTutorialSkipped();
  analytics.recordTutorialStart(true);
  analytics.recordTutorialCompleted();
  assert.equal(analytics.getDiagnostics().tutorialReplays, 1);
  analytics.resetDiagnostics();
  assert.deepEqual(analytics.getDiagnostics().eliminationCauses, {});
  assert.equal(analytics.getDiagnostics().tutorialSkips, 0);
});
test('storage handles malformed numeric saves and denied browser persistence', () => {
  saved.set('number-test', 'broken');
  assert.equal(readNumber('number-test'), 0);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('SecurityError');
    },
  });
  storage.setItem('denied-test', '42');
  assert.equal(readNumber('denied-test'), 42);
});
