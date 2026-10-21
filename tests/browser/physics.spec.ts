import { test, expect } from '@playwright/test';

test('idle lanes lose, boost is not armour, shields work and lighting follows long runs', async ({ page }) => {
  const graphicsErrors: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' && /WebGLProgram|Shader Error|VALIDATE_STATUS/.test(message.text()))
      graphicsErrors.push(message.text());
  });
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const enginePath = '/src/game/GameEngine.ts', skinPath = '/src/data/skins.ts';
    const { GameEngine } = await import(enginePath);
    const { AVAILABLE_SKINS } = await import(skinPath);
    const mount = document.createElement('div');
    mount.style.cssText = 'width:390px;height:844px';
    document.body.append(mount);
    const engine = new GameEngine(mount, {
      onStatsUpdate() {}, onPowerUpsUpdate() {}, onChaosUpdate() {}, onGameOver() {},
    }, AVAILABLE_SKINS[0]);
    const reset = (day = '2026-10-22') => {
      engine.reset(AVAILABLE_SKINS[0], true, day);
      cancelAnimationFrame(engine.animFrameId);
    };
    try {
      const idle: { crashed: boolean; distance: number }[] = [];
      for (const day of ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']) {
        for (const lane of [-1, 0, 1]) {
          reset(day);
          engine.currentLane = engine.targetLane = lane;
          engine.playerX = lane * 2.4;
          for (let frame = 0; frame < 30 * 120 && !engine.isCrashing; frame++)
            engine.update(1 / 120);
          idle.push({ crashed: engine.isCrashing, distance: engine.distanceTraveled });
        }
      }
      reset();
      engine.obstacles.clear(); engine.collectibles.clear();
      engine.activePowerUps.set('SPEED_BOOST', 6);
      engine.obstacles.spawnObstacle('FULL_BLOCK', 0, -0.4);
      engine.update(1 / 120);
      const boostCrash = engine.isCrashing;

      reset();
      engine.obstacles.clear(); engine.collectibles.clear();
      engine.activePowerUps.set('SHIELD', 10);
      engine.activePowerUps.set('SPEED_BOOST', 6);
      engine.obstacles.spawnObstacle('FULL_BLOCK', 0, -0.4);
      engine.update(1 / 120);
      const shield = { crashed: engine.isCrashing, consumed: !engine.activePowerUps.has('SHIELD') };

      reset();
      engine.obstacles.clear(); engine.collectibles.clear();
      engine.playerZ = -5000;
      engine.spawnCursorZ = -5300;
      engine.nextBossTriggerDistance = 100000;
      engine.handleInput('JUMP');
      for (let frame = 0; frame < 24; frame++) engine.update(1 / 120);
      engine.scene.updateMatrixWorld(true);
      engine.render();
      const shadow = engine.character.shadowDisk;
      const worldY = shadow.matrixWorld.elements[13];
      const lightOffset = engine.environment.dirLight.position.z - engine.playerZ;
      const targetOffset = engine.environment.dirLight.target.position.z - engine.playerZ;
      const airborne = engine.playerY;

      // A buffered jump must not fire unexpectedly after a background pause.
      engine.handleInput('JUMP');
      engine.pause();
      const bufferCleared = engine.inputBuffer === null;
      engine.resume();
      return { idle, boostCrash, shield, worldY, lightOffset, targetOffset, airborne, bufferCleared };
    } finally {
      engine.dispose(); mount.remove();
    }
  });
  for (const run of result.idle) {
    expect(run.crashed).toBe(true);
    expect(run.distance).toBeLessThan(400);
  }
  expect(result.boostCrash).toBe(true);
  expect(result.shield).toEqual({ crashed: false, consumed: true });
  expect(result.airborne).toBeGreaterThan(0.8);
  expect(result.worldY).toBeCloseTo(0.025, 5);
  expect(result.lightOffset).toBeCloseTo(14, 5);
  expect(result.targetOffset).toBeCloseTo(-12, 5);
  expect(result.bufferCleared).toBe(true);
  expect(graphicsErrors).toEqual([]);
});
