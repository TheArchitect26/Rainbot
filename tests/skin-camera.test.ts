import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3 } from 'three';
import {
  normalizeCustomSkin,
  parseCustomSkins,
  MAX_CUSTOM_SKINS,
  finishMaterial,
} from '../src/utils/skinStudio';
import { RunnerCamera } from '../src/game/RunnerCamera';

const draft = {
  id: 'custom_one',
  name: '  My Runner ',
  primaryColor: '#123abc',
  secondaryColor: '#456DEF',
  glowColor: '#ffffff',
  finish: 'CHROME',
};
test('custom saves validate colors, reserve IDs and normalize cosmetic-only fields', () => {
  assert.equal(normalizeCustomSkin({ ...draft, id: 'cyber_glitch' }), null);
  assert.equal(normalizeCustomSkin({ ...draft, primaryColor: 'red' }), null);
  assert.equal(normalizeCustomSkin({ ...draft, name: ' '.repeat(3) }), null);
  assert.equal(normalizeCustomSkin({ ...draft, name: 'a'.repeat(25) }), null);
  const skin = normalizeCustomSkin({
    ...draft,
    price: 999,
    unlocked: false,
    requiredLevel: 100,
  });
  assert.equal(skin?.name, 'My Runner');
  assert.equal(skin?.price, 0);
  assert.equal(skin?.unlocked, true);
  assert.equal(skin?.requiredLevel, undefined);
  assert.equal(
    normalizeCustomSkin({ ...draft, finish: 'broken' })?.finish,
    'SATIN',
  );
  assert.deepEqual(parseCustomSkins(JSON.stringify([skin])), [skin]);
});
test('custom save recovery rejects corrupt data, duplicate IDs and excess slots', () => {
  for (const raw of [null, '{', '{}', 'null', '1'])
    assert.deepEqual(parseCustomSkins(raw), []);
  const records = Array.from({ length: 20 }, (_, i) => ({
    ...draft,
    id: `custom_${i}`,
  }));
  assert.equal(
    parseCustomSkins(JSON.stringify([null, draft, draft])).length,
    1,
  );
  assert.equal(
    parseCustomSkins(JSON.stringify(records)).length,
    MAX_CUSTOM_SKINS,
  );
  assert.notDeepEqual(finishMaterial('MATTE'), finishMaterial('CHROME'));
});
test('camera maintains a readable view of all three upcoming lanes in portrait and landscape', () => {
  const rig = new RunnerCamera();
  for (const aspect of [320 / 568, 390 / 844, 568 / 320, 16 / 9]) {
    const fov =
      aspect < 1
        ? Math.min(
            88,
            Math.max(
              65,
              (2 * Math.atan(Math.tan((65 * Math.PI) / 360) / aspect) * 180) /
                Math.PI,
            ),
          )
        : 60;
    const camera = new PerspectiveCamera(fov, aspect, 0.1, 220);
    for (const playerX of [-2.4, 0, 2.4]) {
      rig.reset();
      for (let i = 0; i < 240; i++)
        rig.update(1 / 120, playerX, true, i / 120, true, 10);
      camera.position.set(rig.x, rig.y, -1000 + rig.offsetZ);
      camera.lookAt(rig.lookX, rig.lookY, -1000 - rig.lookAhead);
      camera.updateMatrixWorld();
      for (const lane of [-2.4, 0, 2.4]) {
        for (const y of [0, 2.5]) {
          const point = new Vector3(lane, y, -1012).project(camera);
          assert.ok(Math.abs(point.x) < 0.85, `lane clipped: ${point.x}`);
          assert.ok(
            point.y > -0.6 && point.y < 0.65,
            `road outside readable area: ${point.y}`,
          );
        }
      }
    }
  }
});
test('camera motion is bounded, frame-rate independent and reduced-motion holds the horizon', () => {
  const a = new RunnerCamera(),
    b = new RunnerCamera();
  for (let i = 0; i < 120; i++)
    a.update(1 / 120, 2.4, true, i / 120, false, 10);
  for (let i = 0; i < 30; i++) b.update(1 / 30, 2.4, true, i / 30, false, 10);
  assert.ok(Math.abs(a.x - b.x) < 1e-9);
  assert.ok(Math.abs(a.offsetZ - b.offsetZ) < 1e-9);
  assert.equal(a.y, 3.9);
  for (let i = 0; i < 1200; i++) {
    a.update(1 / 120, 0, false, i / 120, true, 100);
    assert.ok(Math.abs(a.y - 3.9) < 0.085);
  }
  a.reset();
  assert.equal(a.offsetZ, 6.6);
  assert.equal(a.x, 0);
});
