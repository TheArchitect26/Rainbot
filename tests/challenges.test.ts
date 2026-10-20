import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHALLENGES,
  MAX_RUN_SPEED,
  COMPOUND_GATE_SECONDS,
  SLALOM_REACTION_SECONDS,
  challengeAtDistance,
  makeChallengePattern,
} from '../src/game/challenges';
import { SeededPRNG } from '../src/utils/prng';
import {
  normalizeCustomSkin,
  parseCustomSkins,
  unlockRankSkins,
  accessoryForRank,
} from '../src/utils/skinStudio';
import { AVAILABLE_SKINS } from '../src/data/skins';

test('challenge levels advance at explicit distances and cap at the hardest level', () => {
  assert.equal(challengeAtDistance(-1).level, 1);
  assert.equal(challengeAtDistance(NaN).level, 1);
  assert.equal(challengeAtDistance(249).level, 1);
  assert.equal(challengeAtDistance(250).level, 2);
  assert.equal(challengeAtDistance(2750).level, 12);
  assert.equal(challengeAtDistance(1e9).level, 12);
  CHALLENGES.forEach((c, i) => {
    if (i) assert.ok(c.speed > CHALLENGES[i - 1].speed);
    assert.ok(c.speed * 1.45 * 1.35 <= MAX_RUN_SPEED);
  });
});
test('seeded challenge patterns repeat and retain a route or an achievable timed action', () => {
  const a = new SeededPRNG(123),
    b = new SeededPRNG(123);
  for (const c of CHALLENGES)
    for (const pattern of c.patterns) {
      const rows = makeChallengePattern(pattern, c.speed, () => a.next());
      assert.deepEqual(
        rows,
        makeChallengePattern(pattern, c.speed, () => b.next()),
      );
      rows.forEach((row, i) => {
        const blocked = row.hazards.map((h) => h.lane);
        assert.equal(new Set(blocked).size, blocked.length);
        if (row.safeLane !== undefined)
          assert.ok(!blocked.includes(row.safeLane));
        if (row.hazards.length === 3) {
          assert.ok(
            row.hazards.some(
              (h) => h.type === 'LOW_BARRIER' || h.type === 'HIGH_BARRIER',
            ),
          );
          assert.ok(
            row.hazards.filter((h) => h.type === 'FULL_BLOCK').length < 3,
          );
        }
        if (i) {
          assert.ok(
            (row.offset - rows[i - 1].offset) / (c.speed * 1.45 * 1.35) >=
              (pattern === 'SLALOM'
                ? SLALOM_REACTION_SECONDS
                : COMPOUND_GATE_SECONDS) -
                1e-10,
          );
          if (row.safeLane !== undefined)
            assert.ok(Math.abs(row.safeLane - rows[i - 1].safeLane!) <= 1);
        }
      });
    }
});
test('street appearance and clothing save safely; legacy robot palettes still load', () => {
  const street = AVAILABLE_SKINS.find((s) => s.id === 'street_spark')!;
  const saved = normalizeCustomSkin({
    ...street,
    id: 'custom_outfit',
    outfit: 'HOODIE',
    bottom: 'JOGGERS',
    hair: 'CAP',
    skinTone: '#805139',
    shoeColor: '#22bbcc',
  })!;
  assert.equal(saved.avatar, 'STREET');
  assert.equal(saved.outfit, 'HOODIE');
  assert.equal(saved.shoeColor, '#22bbcc');
  assert.deepEqual(parseCustomSkins(JSON.stringify([saved])), [saved]);
  const repaired = normalizeCustomSkin({
    ...saved,
    hair: 'invalid',
    skinTone: 'red',
    rankOnly: true,
  })!;
  assert.equal(repaired.hair, 'QUIFF');
  assert.equal(repaired.skinTone, '#e8ac82');
  assert.equal(repaired.rankOnly, undefined);
  assert.equal(
    normalizeCustomSkin({ ...saved, avatar: undefined })?.avatar,
    'CYBER',
  );
});
test('rank rewards hydrate older saves without charging coins or relocking owned skins', () => {
  const old = AVAILABLE_SKINS.map((s) => ({
    ...s,
    unlocked: s.id === 'quantum_hologram' || s.unlocked,
  }));
  const atEight = unlockRankSkins(old, 8);
  assert.ok(atEight.find((s) => s.id === 'night_shift')?.unlocked);
  assert.ok(atEight.find((s) => s.id === 'varsity_ace')?.unlocked);
  assert.ok(atEight.find((s) => s.id === 'quantum_hologram')?.unlocked);
  assert.equal(atEight.find((s) => s.id === 'apex_runner')?.unlocked, false);
  assert.ok(
    unlockRankSkins(atEight, 30).find((s) => s.id === 'apex_runner')?.unlocked,
  );
});

test('compound gates retain low-gravity landing time when crossing a speed tier', () => {
  for (let distance = 0; distance < 3500; distance += 10) {
    const forecastSpeed = challengeAtDistance(
      distance + MAX_RUN_SPEED * COMPOUND_GATE_SECONDS * 2,
    ).speed;
    const rows = makeChallengePattern('RHYTHM', forecastSpeed, () => 0.5);
    const nextSpeed = challengeAtDistance(distance + rows[1].offset).speed;
    assert.ok(
      rows[1].offset / (nextSpeed * 1.45 * 1.35) >=
        COMPOUND_GATE_SECONDS - 1e-10,
    );
    assert.ok(COMPOUND_GATE_SECONDS > (2 * 16.5) / 18 + 0.2);
  }
});

test('rank accessories remain earned while basic clothing stays free', () => {
  assert.equal(accessoryForRank('HEADPHONES', 1), 'NONE');
  assert.equal(accessoryForRank('HEADPHONES', 4), 'HEADPHONES');
  assert.equal(accessoryForRank('STAR_BADGE', 7), 'NONE');
  assert.equal(accessoryForRank('STAR_BADGE', 8), 'STAR_BADGE');
  assert.equal(accessoryForRank('LAUREL', 30), 'LAUREL');
  assert.equal(accessoryForRank('__proto__', 999), 'NONE');
});
