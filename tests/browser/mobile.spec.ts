import { test, expect } from '@playwright/test';

test('first play: action gates, safe retry, completion reward, saved replay, skip and diagnostics', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-10-19T12:00:00Z') });
  // Freeze before navigation so page startup cannot overtake the clock deadline.
  await page.clock.pauseAt(new Date('2026-10-19T12:00:01Z'));
  await page.goto('/');
  // Deliberately render at 10Hz while retaining the actual 120Hz simulation.
  // This exercises frame-drop safety and keeps software-WebGL CI practical.
  const advance = async (ms: number) => {
    for (let remaining = ms; remaining > 0; remaining -= 100)
      await page.clock.fastForward(Math.min(100, remaining));
  };
  await page.getByRole('button', { name: 'PLAY RUN' }).click();
  await expect(page.getByText('TUTORIAL · STEP 1/5')).toBeVisible();
  await advance(2000);
  await expect(page.getByText('TUTORIAL · STEP 1/5')).toBeVisible();
  await page.getByRole('button', { name: 'Steer Left' }).click();
  await advance(100);
  await page.getByRole('button', { name: 'Steer Right' }).click();
  await advance(100);
  await expect(page.getByText('TUTORIAL · STEP 2/5')).toBeVisible();
  // Deliberately miss the first barrier: tutorial must retry, never kill or auto-complete.
  await advance(1800);
  await expect(page.getByText('TUTORIAL · STEP 2/5')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Game over' })).toHaveCount(0);
  await advance(900);
  await page.getByRole('button', { name: 'Jump Up' }).click();
  await advance(900);
  await expect(page.getByText('TUTORIAL · STEP 3/5')).toBeVisible();
  await advance(900);
  await page.getByRole('button', { name: 'Slide Duck' }).click();
  await advance(900);
  await expect(page.getByText('TUTORIAL · STEP 4/5')).toBeVisible();
  await advance(1000);
  await expect(page.getByText('TUTORIAL · STEP 5/5')).toBeVisible();
  await page.getByRole('button', { name: 'Steer Left' }).click();
  await advance(1800);
  await expect(page.getByRole('button', { name: 'ENTER THE ALGORITHM' })).toBeVisible();
  const coins = await page.evaluate(() => Number(localStorage.getItem('brainrot_total_coins')));
  expect(coins).toBe(200); // 100 training bonus + existing level-2 milestone of 100.
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('brainrot_progression_v3')!).totalXP),
  ).toBe(150);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('brainrot_diagnostics_v1')!).totalRunsStarted,
    ),
  ).toBe(0);
  await page.reload();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'REPLAY TUTORIAL' }).click();
  await expect(page.getByText('TUTORIAL · STEP 1/5')).toBeVisible();
  await page.getByRole('button', { name: 'SKIP TUTORIAL' }).click();
  await expect(page.getByText('TUTORIAL · STEP 1/5')).toHaveCount(0);
  expect(await page.evaluate(() => Number(localStorage.getItem('brainrot_total_coins')))).toBe(
    coins,
  );
  await page.getByRole('button', { name: 'Pause Game' }).click();
  await expect(page.getByRole('dialog', { name: 'Paused' })).toBeVisible();
  const before = await page.evaluate(async () => {
    const modulePath = '/src/utils/analytics.ts';
    return (await import(modulePath)).localAnalytics.getDiagnostics().fpsMetrics.samples;
  });
  await advance(5000);
  expect(
    await page.evaluate(async () => {
      const modulePath = '/src/utils/analytics.ts';
      return (await import(modulePath)).localAnalytics.getDiagnostics().fpsMetrics.samples;
    }),
  ).toBe(before);
  await page.getByRole('button', { name: /MAIN MENU|QUIT TO MENU|MENU/i }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'DIAGNOSTICS' }).click();
  await expect(page.getByRole('dialog', { name: 'Diagnostics' })).toBeVisible();
  const data = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('brainrot_diagnostics_v1')!),
  );
  expect(data.tutorialCompleted).toBe(true);
  expect(data.tutorialReplays).toBe(1);
  expect(data.tutorialSkips).toBe(1);
  expect(data.totalRunsStarted).toBe(1);
  expect(data.totalRunsCompleted).toBe(0);
  expect(errors).toEqual([]);
});

test('corrupt legacy saves and denied storage still reach a usable menu', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('brainrot_progression_v3', '{"level":-2,"xpToNextLevel":0}');
    localStorage.setItem('brainrot_unlocked_skins', '{}');
    localStorage.setItem('brainrot_high_score', 'NaN');
  });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'PLAY RUN' })).toBeVisible();
  await expect(page.locator('body')).not.toContainText('NaN');
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
  });
  await page.reload();
  await expect(page.getByRole('button', { name: 'PLAY RUN' })).toBeVisible();
  await page.getByRole('button', { name: 'PLAY RUN' }).click();
  await expect(page.getByText('TUTORIAL · STEP 1/5')).toBeVisible();
});

test('engine daily reset, boss schedule, pause and disposal preserve deterministic mechanics', async ({
  page,
}) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const enginePath = '/src/game/GameEngine.ts',
      skinPath = '/src/data/skins.ts';
    const { GameEngine } = await import(enginePath);
    const { AVAILABLE_SKINS } = await import(skinPath);
    const mount = document.createElement('div');
    mount.style.cssText = 'width:390px;height:600px';
    document.body.append(mount);
    let paused = 0;
    const engine = new GameEngine(
      mount,
      {
        onStatsUpdate() {},
        onPowerUpsUpdate() {},
        onChaosUpdate() {},
        onGameOver() {},
        onPause() {
          paused++;
        },
      },
      AVAILABLE_SKINS[0],
    );
    function simulate() {
      engine.reset(AVAILABLE_SKINS[0], true);
      cancelAnimationFrame(engine.animFrameId);
      engine.isInvulnerable = true;
      engine.invulnerableTimer = 1000;
      const attacks: unknown[] = [];
      const spawn = engine.obstacles.spawnObstacle.bind(engine.obstacles);
      engine.obstacles.spawnObstacle = (...args: unknown[]) => {
        const obs = spawn(...args);
        attacks.push({
          type: obs.type,
          lane: obs.lane,
          z: obs.z,
          direction: obs.moveDirection,
          speed: obs.moveSpeed,
          boss: engine.boss.state.active,
          lead: (engine.playerZ - obs.z) / engine.currentSpeed,
        });
        return obs;
      };
      for (let i = 0; i < 60 * 120; i++) engine.update(1 / 120);
      engine.obstacles.spawnObstacle = spawn;
      return {
        attacks,
        distance: engine.distanceTraveled,
        boss: engine.bossDefeatedCount,
        chaos: engine.chaosSurvivedCount,
      };
    }
    const first = simulate(),
      second = simulate();
    engine.pauseForBackground();
    const activeDuration = engine.elapsedSeconds;
    const isPaused = engine.isPaused;
    engine.resume();
    const resumed = !engine.isPaused;
    engine.dispose();
    const detached = !mount.querySelector('canvas');
    mount.remove();
    return { first, second, paused, isPaused, resumed, detached, activeDuration };
  });
  expect(result.first).toEqual(result.second);
  expect(result.first.attacks.length).toBeGreaterThan(10);
  expect(result.first.boss).toBeGreaterThanOrEqual(1);
  const bossAttacks = result.first.attacks.filter((a: any) => a.boss) as any[];
  expect(bossAttacks.length).toBeGreaterThan(0);
  for (const attack of bossAttacks) expect(attack.lead).toBeGreaterThanOrEqual(1.99);
  const rows = new Map<number, Set<number>>();
  for (const attack of bossAttacks) {
    const lanes = rows.get(attack.z) || new Set<number>();
    lanes.add(attack.lane);
    rows.set(attack.z, lanes);
  }
  for (const lanes of rows.values()) expect(lanes.size).toBeLessThan(3);
  expect(result.paused).toBe(1);
  expect(result.isPaused).toBe(true);
  expect(result.resumed).toBe(true);
  expect(result.detached).toBe(true);
  expect(result.activeDuration).toBeCloseTo(60, 5);
});

test('small menus support focus and swipes without forwarding modal gestures to play', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'On-screen buttons' })).toBeVisible();
  await page.getByRole('switch', { name: 'On-screen buttons' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Settings' })).toHaveCount(0);
  await page.getByRole('button', { name: 'PLAY RUN' }).click();
  const canvas = page.locator('canvas');
  // Use the actual DOM touch handlers rather than dispatching direct engine input.
  for (const [startX, endX] of [
    [200, 100],
    [100, 200],
  ]) {
    await canvas.dispatchEvent('touchstart', {
      touches: [{ identifier: 0, clientX: startX, clientY: 400 }],
    });
    await canvas.dispatchEvent('touchend', {
      changedTouches: [{ identifier: 0, clientX: endX, clientY: 400 }],
    });
    await page.waitForTimeout(150);
  }
  await expect(page.getByText('TUTORIAL · STEP 2/5')).toBeVisible();
  await page.getByRole('button', { name: 'Pause Game' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Paused' })).toHaveCount(0);
  await page.getByRole('button', { name: 'SKIP TUTORIAL' }).click();
  await page.getByRole('button', { name: 'Pause Game' }).click();
  await page.getByRole('button', { name: 'MAIN MENU' }).click();
  await page.setViewportSize({ width: 568, height: 320 });
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'REPLAY TUTORIAL' }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button', { name: 'REPLAY TUTORIAL' })).toBeInViewport();
});

test('lane debounce accepts separated inputs during a stalled frame', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const enginePath = '/src/game/GameEngine.ts',
      skinPath = '/src/data/skins.ts';
    const { GameEngine } = await import(enginePath);
    const { AVAILABLE_SKINS } = await import(skinPath);
    const mount = document.createElement('div');
    mount.style.cssText = 'width:320px;height:568px';
    document.body.append(mount);
    const engine = new GameEngine(
      mount,
      {
        onStatsUpdate() {},
        onPowerUpsUpdate() {},
        onChaosUpdate() {},
        onGameOver() {},
      },
      AVAILABLE_SKINS[0],
    );
    const originalClock = Object.getOwnPropertyDescriptor(performance, 'now');
    let time = 1000;
    try {
      engine.startTutorial(AVAILABLE_SKINS[0]);
      cancelAnimationFrame(engine.animFrameId);
      Object.defineProperty(performance, 'now', { configurable: true, value: () => time });
      engine.handleInput('LEFT');
      const firstLane = engine.currentLane;
      time += 50;
      engine.handleInput('RIGHT'); // Accidental duplicate inside 75ms must be ignored.
      const duplicateLane = engine.currentLane;
      time += 100;
      engine.handleInput('RIGHT'); // 150ms elapsed; no simulation or rendering occurred.
      const separatedLane = engine.currentLane;
      const simulationTime = engine.simulationTime;
      engine.update(1 / 120);
      const tutorialStep = engine.tutorialStep;
      engine.pause();
      time += 100;
      engine.handleInput('RIGHT');
      const pausedLane = engine.currentLane;
      engine.resume();
      engine.handleInput('RIGHT');
      const resumedLane = engine.currentLane;
      engine.startTutorial(AVAILABLE_SKINS[0]);
      cancelAnimationFrame(engine.animFrameId);
      engine.handleInput('LEFT'); // Restart resets the debounce gate immediately.
      return {
        firstLane,
        duplicateLane,
        separatedLane,
        simulationTime,
        tutorialStep,
        pausedLane,
        resumedLane,
        resetLane: engine.currentLane,
      };
    } finally {
      if (originalClock) Object.defineProperty(performance, 'now', originalClock);
      else Reflect.deleteProperty(performance, 'now');
      engine.dispose();
      mount.remove();
    }
  });
  expect(result).toEqual({
    firstLane: -1,
    duplicateLane: -1,
    separatedLane: 0,
    simulationTime: 0,
    tutorialStep: 2,
    pausedLane: 0,
    resumedLane: 1,
    resetLane: -1,
  });
});
