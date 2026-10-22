import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { ObstacleManager } from '../src/game/Obstacles';
import { hitsObstacle } from '../src/utils/mechanics';
import { bossLeadDistance, challengeAtDistance, CHALLENGES, makeChallengePattern } from '../src/game/challenges';
import { swipeAction } from '../src/utils/gestures';
import { SeededPRNG } from '../src/utils/prng';
import type { Lane } from '../src/types/game';

test('drifting solid walls preserve every authored safe lane during and after chaos', () => {
  const scene = new Scene(), obstacles = new ObstacleManager(scene);
  for (const safeLane of [-1, 0, 1] as Lane[]) {
    for (let seed = 0; seed < 12; seed++) {
      obstacles.clear();
      const random = new SeededPRNG(seed);
      obstacles.setRandom(() => random.next());
      for (const lane of [-1, 0, 1] as Lane[])
        if (lane !== safeLane) obstacles.spawnObstacle('FULL_BLOCK', lane, -10);
      for (let frame = 0; frame < 480; frame++) {
        obstacles.update(1 / 120, -10, frame < 360, frame / 120);
        for (const obstacle of obstacles.getActiveObstacles()) {
          const x = obstacles.getMesh(obstacle.id)!.position.x;
          assert.equal(hitsObstacle('FULL_BLOCK', Math.abs(x - safeLane * 2.4), -10, -9.9, -10, 0, false), false);
        }
      }
    }
  }
});

test('boss warning retains two real seconds before collision across speed tiers and stacked modifiers', () => {
  for (let start = 140; start < 1800; start += 17) {
    for (const multiplier of [1, 1.45, 1.45 * 1.35]) {
      const lead = bossLeadDistance(start, multiplier);
      let distance = start, time = 0;
      while (distance - start < lead - 0.52 && time < 4) {
        distance += challengeAtDistance(distance).speed * multiplier / 120;
        time += 1 / 120;
      }
      assert.ok(time >= 2 - 1e-10, `${start}m, multiplier ${multiplier}: ${time}s`);
    }
  }
});

test('swipe threshold accepts the direction before release and ignores small motion', () => {
  assert.equal(swipeAction(100, 100, 0, 81, 100, 100), null);
  assert.equal(swipeAction(100, 100, 0, 75, 103, 100), 'LEFT');
  assert.equal(swipeAction(100, 100, 0, 125, 100, 100), 'RIGHT');
  assert.equal(swipeAction(100, 100, 0, 101, 70, 100), 'JUMP');
  assert.equal(swipeAction(100, 100, 0, 100, 130, 100), 'SLIDE');
  assert.equal(swipeAction(100, 100, 0, 125, 100, 400), null);
});

test('new authored sequences use bounded adjacent routes and demand mixed skills', () => {
  assert.ok(CHALLENGES.some(level => level.patterns.includes('GAUNTLET' as never)));
  for (const roll of [0, 0.4, 0.99]) {
    const weave = makeChallengePattern('WEAVE', 36, () => roll);
    assert.equal(weave.length, 3);
    assert.equal(weave[0].safeLane, weave[2].safeLane);
    assert.notEqual(weave[0].safeLane, weave[1].safeLane);
    const gauntlet = makeChallengePattern('GAUNTLET', 36, () => roll);
    assert.equal(gauntlet[0].hazards[0].type, 'LOW_BARRIER');
    assert.equal(gauntlet[2].hazards[0].type, 'HIGH_BARRIER');
    assert.equal(gauntlet[1].hazards.length, 2);
  }
});
