import { test, expect } from '@playwright/test';

test('slide poses clear overhead gates, warnings are grounded and low quality reduces scene cost', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const enginePath = '/src/game/GameEngine.ts', skinsPath = '/src/data/skins.ts', threePath = '/node_modules/.vite/deps/three.js';
    const { GameEngine } = await import(enginePath);
    const { AVAILABLE_SKINS } = await import(skinsPath);
    const { Box3 } = await import(threePath);
    const mount = document.createElement('div');
    mount.style.cssText = 'width:390px;height:844px'; document.body.append(mount);
    const engine = new GameEngine(mount, { onStatsUpdate() {}, onPowerUpsUpdate() {}, onChaosUpdate() {}, onGameOver() {} }, AVAILABLE_SKINS[0]);
    const reset = (skin = AVAILABLE_SKINS[0]) => {
      engine.reset(skin, true, '2026-10-22'); cancelAnimationFrame(engine.animFrameId);
      engine.isInvulnerable = true; engine.invulnerableTimer = 99999;
      engine.obstacles.clear(); engine.collectibles.clear();
      engine.spawnCursorZ = -99999; engine.nextBossTriggerDistance = 99999;
    };
    try {
      const poses: { id: string; top: number; facing: number }[] = [];
      for (const skin of AVAILABLE_SKINS) {
        reset(skin); engine.handleInput('SLIDE');
        for (let i = 0; i < 24; i++) engine.update(1 / 120);
        engine.character.group.updateMatrixWorld(true);
        const bounds = new Box3();
        engine.character.group.traverse((node: any) => {
          if (!node.isMesh || !node.visible || [engine.character.shadowDisk, engine.character.shieldMesh, engine.character.boostAura, engine.character.magnetRing].includes(node)) return;
          let parent = node.parent;
          while (parent && parent !== engine.character.group) { if (!parent.visible) return; parent = parent.parent; }
          bounds.expandByObject(node);
        });
        poses.push({ id: skin.id, top: bounds.max.y, facing: engine.character.group.rotation.y });
      }
      reset(); engine.setQuality('high'); engine.render();
      const high = { ...engine.renderer.info.render };
      engine.setQuality('low'); engine.render();
      const low = { ...engine.renderer.info.render };
      const antialias = engine.renderer.getContext().getContextAttributes().antialias;
      reset(); engine.distanceTraveled = 1499.7; engine.playerZ = -1499.7;
      engine.boss.triggerBoss(); engine.boss.attackTimer = 0; engine.update(1 / 120);
      const warnings = engine.boss.warningGroup.children.filter((node: any) => node.visible).map((node: any) => node.position.y);
      const obstacleZ = engine.obstacles.getActiveObstacles()[0].z;
      let arrival = 0;
      while (engine.playerZ > obstacleZ + 0.52 && arrival < 5) { engine.update(1 / 120); arrival += 1 / 120; }
      engine.boss.reset();
      const cleared = engine.boss.warningGroup.children.every((node: any) => !node.visible);
      return { poses, high, low, antialias, warnings, arrival, cleared };
    } finally { engine.dispose(); mount.remove(); }
  });
  for (const pose of result.poses) {
    expect(pose.top, pose.id).toBeLessThan(1.25);
    expect(pose.facing, pose.id).toBeCloseTo(Math.PI);
  }
  expect(result.low.calls).toBeLessThan(result.high.calls - 15);
  expect(result.low.triangles).toBeLessThan(result.high.triangles);
  expect(result.antialias).toBe(false);
  expect(result.warnings).toHaveLength(2);
  result.warnings.forEach((y: number) => expect(y).toBeCloseTo(0.035));
  expect(result.arrival).toBeGreaterThanOrEqual(2);
  expect(result.cleared).toBe(true);
});

test('swipe commits before release once, and landscape warnings leave the road visible', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('brainrot_tutorial_seen_v1', 'true'); localStorage.setItem('brainrot_touch_controls', 'true'); });
  await page.goto('/');
  await page.evaluate(async () => {
    const path = '/src/game/GameEngine.ts';
    const { GameEngine } = await import(path);
    const reset = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function (...args: any[]) { (window as any).auditEngine = this; reset.apply(this, args); cancelAnimationFrame(this.animFrameId); };
  });
  await page.getByRole('button', { name: 'PLAY RUN' }).click();
  const canvas = page.locator('canvas').first();
  await canvas.dispatchEvent('touchstart', { touches: [{ identifier: 0, clientX: 200, clientY: 600 }] });
  await canvas.dispatchEvent('touchmove', { touches: [{ identifier: 0, clientX: 150, clientY: 600 }] });
  expect(await page.evaluate(() => (window as any).auditEngine.currentLane)).toBe(-1);
  await canvas.dispatchEvent('touchend', { changedTouches: [{ identifier: 0, clientX: 150, clientY: 600 }] });
  expect(await page.evaluate(() => (window as any).auditEngine.currentLane)).toBe(-1);
  await page.setViewportSize({ width: 568, height: 320 });
  await page.evaluate(() => {
    const engine = (window as any).auditEngine;
    engine.isInvulnerable = true; engine.invulnerableTimer = 99999;
    engine.distanceTraveled = 1562; engine.playerZ = -1562; engine.spawnCursorZ = -2000;
    engine.nextBossTriggerDistance = 99999; engine.boss.triggerBoss(); engine.boss.attackTimer = 0;
    engine.activePowerUps.set('SHIELD', 8); engine.activePowerUps.set('MAGNET', 8);
    for (let i = 0; i < 16; i++) engine.update(1 / 120);
    engine.render();
  });
  await expect(page.locator('.hud-announcement')).toBeVisible();
  expect(await page.locator('.hud-announcement').count()).toBe(1);
  const bounds = await page.locator('.hud-announcement').boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThan(110);
  for (const name of ['Steer Left', 'Steer Right', 'Slide Duck', 'Jump Up'])
    await expect(page.getByRole('button', { name })).toBeInViewport({ ratio: 1 });
  await page.getByRole('button', { name: 'Pause Game' }).click();
  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Build information')).toContainText('v0.2.0');
});
