import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integrateJump, integrateLane, JUMP_SPEED, JUMP_GRAVITY,
  LOW_GRAVITY_JUMP_SPEED, LOW_GRAVITY, SLIDE_SECONDS } from '../src/game/physics';
import { chooseChallengePattern, COMPOUND_GATE_SECONDS } from '../src/game/challenges';

test('jump arc clears a barrier, has a decisive descent and lands before the next gate', () => {
  for (const [speed, gravity, maxTime] of [[JUMP_SPEED, JUMP_GRAVITY, 0.6],
    [LOW_GRAVITY_JUMP_SPEED, LOW_GRAVITY, 1.1]]) {
    let y = 0, velocity = speed, peak = 0, time = 0;
    do {
      ({ y, velocity } = integrateJump(y, velocity, gravity, 1 / 120));
      peak = Math.max(peak, y);
      time += 1 / 120;
    } while (y > 0 && time < 3);
    assert.ok(peak > 0.95 && peak < 3);
    assert.ok(time < maxTime);
    assert.ok(time + 0.15 < COMPOUND_GATE_SECONDS);
    assert.equal(velocity, 0);
  }
  assert.ok(SLIDE_SECONDS < 0.6 && SLIDE_SECONDS > 0.4);
});

test('jump integration agrees across render cadences, including crossing the apex', () => {
  function sample(dt: number) {
    let y = 0, velocity = JUMP_SPEED;
    for (let i = 0; i < Math.round(0.4 / dt); i++)
      ({ y, velocity } = integrateJump(y, velocity, JUMP_GRAVITY, dt));
    return { y, velocity };
  }
  const a = sample(1 / 120), b = sample(1 / 30);
  assert.ok(Math.abs(a.y - b.y) < 1e-10);
  assert.ok(Math.abs(a.velocity - b.velocity) < 1e-10);
});

test('lane spring settles promptly without overshooting and handles a reversal', () => {
  let x = 0, velocity = 0;
  for (let i = 0; i < 24; i++) {
    ({ x, velocity } = integrateLane(x, velocity, 2.4, 1 / 120));
    assert.ok(x >= 0 && x <= 2.4);
  }
  assert.ok(x > 2.3);
  for (let i = 0; i < 60; i++) {
    ({ x, velocity } = integrateLane(x, velocity, -2.4, 1 / 120));
    assert.ok(x >= -2.4 && x <= 2.4);
  }
  assert.ok(x < -2.39);
});

test('camping cannot avoid mandatory seeded gates at any challenge tier or RNG extreme', () => {
  for (const distance of [0, 149, 150, 600, 1650, 100000])
    for (const random of [() => 0, () => 0.99999]) {
      const sequence = Array.from({ length: 60 }, (_, i) => chooseChallengePattern(distance, i, random));
      for (let i = 0; i < sequence.length; i += 6) {
        assert.ok(['JUMP_GATE', 'SLIDE_GATE'].includes(sequence[i + 2]));
        assert.ok(['JUMP_GATE', 'SLIDE_GATE'].includes(sequence[i + 5]));
      }
    }
});
