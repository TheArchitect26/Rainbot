import { test, expect } from '@playwright/test';

test('free street runner clothing, skin tone and shoes persist; old rank grants outfits', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
  await page.addInitScript(() => {
    if (localStorage.getItem('outfit_test_init')) return;
    localStorage.setItem('outfit_test_init', 'true');
    localStorage.setItem(
      'brainrot_progression_v3',
      JSON.stringify({ level: 8, currentXP: 0, totalXP: 3000 }),
    );
  });
  await page.goto('/');
  await page.getByRole('button', { name: /^Skin:/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Street Spark' }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Night Shift Owned/ }).click();
  await expect(
    page.getByRole('button', { name: 'Equip', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: /Street Spark Owned/ }).click();
  await page.getByRole('button', { name: /Create a runner/ }).click();
  await page.getByLabel('Runner name').fill('My Street Original');
  await page.getByLabel('Top', { exact: true }).selectOption('HOODIE');
  await page.getByLabel('Bottom', { exact: true }).selectOption('JOGGERS');
  await page.getByLabel('Hair style', { exact: true }).selectOption('CURLS');
  await page.getByLabel('Skin tone').fill('#805139');
  await page.getByLabel('Hair color').fill('#332211');
  await page.getByLabel('Shoe color').fill('#ff7733');
  await page.getByLabel('Rank accessory').selectOption('STAR_BADGE');
  await expect(
    page.getByLabel('Rank accessory').getByRole('option', { name: /LAUREL/ }),
  ).toHaveAttribute('disabled', '');
  await page.getByRole('button', { name: 'Save & equip' }).click();
  await page.reload();
  await page.getByRole('button', { name: /^Skin:/ }).click();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByLabel('Top', { exact: true })).toHaveValue('HOODIE');
  await expect(page.getByLabel('Bottom', { exact: true })).toHaveValue(
    'JOGGERS',
  );
  await expect(page.getByLabel('Shoe color')).toHaveValue('#ff7733');
  await expect(page.getByLabel('Rank accessory')).toHaveValue('STAR_BADGE');
  await page.setViewportSize({ width: 568, height: 320 });
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'My Street Original' }),
  ).toBeVisible();
});

test('real shared leaderboard creates a player and starts a server-seeded ranked run', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page
    .getByRole('button', { name: 'World rankings', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'WORLD RANKINGS' }),
  ).toBeVisible();
  await page.getByLabel('Public nickname').fill('Browser Runner');
  await page
    .getByRole('button', { name: 'Join rankings', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'Start ranked daily' }),
  ).toBeEnabled();
  // A known collision fixture makes submission independent of the day's obstacle lanes.
  // The actual engine, App callbacks and HTTP service still handle the entire run.
  await page.evaluate(async () => {
    const path = '/src/game/GameEngine.ts';
    const { GameEngine } = await import(path);
    const reset = GameEngine.prototype.reset;
    GameEngine.prototype.reset = function (...args: any[]) {
      reset.apply(this, args);
      (window as any).__rankedSeedDay = args[2];
      this.obstacles.clear();
      this.obstacles.spawnObstacle('FULL_BLOCK', 0, -12);
      this.coinsCollected = 7; // Known nonzero payout, so retry must not award it twice.
    };
  });
  let dropped = false;
  await page.route('**/api/leaderboard/runs/*/finish', async (route) => {
    const response = await route.fetch();
    if (!dropped) {
      dropped = true;
      await route.abort();
    } else await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Start ranked daily' }).click();
  await expect(page.getByRole('dialog', { name: 'Leaderboard' })).toHaveCount(
    0,
  );
  await expect(
    page.getByText('RANKED · CHALLENGE 1/12 · First Steps'),
  ).toBeVisible();
  await expect(page.getByText('TUTORIAL · STEP 1/5')).toHaveCount(0);
  // Advance the actual engine until its first hazard, without input, ends this run.
  for (
    let i = 0;
    i < 40 && !(await page.getByRole('dialog', { name: 'Game over' }).count());
    i++
  )
    await page.clock.fastForward(100);
  const over = page.getByRole('dialog', { name: 'Game over' });
  await expect(over).toBeVisible();
  await expect(over.getByRole('status')).toContainText('Not submitted');
  const wallet = await page.evaluate(() =>
    localStorage.getItem('brainrot_total_coins'),
  );
  expect(wallet).toBe('7');
  await over.getByRole('button', { name: 'Retry ranked submission' }).click();
  await expect(over.getByRole('status')).toContainText('Rank #');
  expect(
    await page.evaluate(() => localStorage.getItem('brainrot_total_coins')),
  ).toBe(wallet);
  const profile = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('brainrot_online_player_v1')!),
  );
  const response = await page.request.get(
    'http://127.0.0.1:8787/api/leaderboard/rankings?period=all',
    { headers: { Authorization: `Bearer ${profile.token}` } },
  );
  const board = await response.json();
  expect(board.me.name).toBe('Browser Runner');
  expect(await page.evaluate(() => (window as any).__rankedSeedDay)).toMatch(
    /^\d{4}-\d{2}-\d{2}$/,
  );
  expect(board.me.distance).toBeGreaterThan(0);
  expect(board.totalPlayers).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('unreachable rankings reports the problem and leaves practice available', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
  await page.route('**/api/leaderboard/**', (route) => route.abort());
  await page.goto('/');
  await page
    .getByRole('button', { name: 'World rankings', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('unreachable');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'PLAY RUN' }).click();
  await expect(page.getByText('TUTORIAL · STEP 1/5')).toBeVisible();
});

test('maximum-tier boss victory preserves a normal-play recovery section', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const enginePath = '/src/game/GameEngine.ts',
      skinPath = '/src/data/skins.ts';
    const { GameEngine } = await import(enginePath);
    const { AVAILABLE_SKINS } = await import(skinPath);
    const mount = document.createElement('div');
    mount.style.cssText = 'width:390px;height:600px';
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
    try {
      engine.reset(AVAILABLE_SKINS[0], true, '2026-10-20');
      cancelAnimationFrame(engine.animFrameId);
      engine.isInvulnerable = true;
      engine.invulnerableTimer = 100000;
      engine.distanceTraveled = 2750;
      engine.playerZ = -2750;
      engine.nextBossTriggerDistance = 2750;
      let grantedRecovery = 0;
      for (let i = 0; i < 3000; i++) {
        const before = engine.bossDefeatedCount;
        engine.update(1 / 120);
        if (engine.bossDefeatedCount > before)
          grantedRecovery =
            engine.nextBossTriggerDistance - engine.distanceTraveled;
      }
      return {
        grantedRecovery,
        defeated: engine.bossDefeatedCount,
        active: engine.boss.state.active,
        recovery: engine.nextBossTriggerDistance - engine.distanceTraveled,
      };
    } finally {
      engine.dispose();
      mount.remove();
    }
  });
  expect(result.defeated).toBe(1);
  expect(result.active).toBe(false);
  expect(result.grantedRecovery).toBeGreaterThanOrEqual(320);
  expect(result.recovery).toBeGreaterThan(0);
});
