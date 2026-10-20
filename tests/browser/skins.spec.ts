import { test, expect } from '@playwright/test';

test('custom runner create, equip, reload, edit, cancel and delete preserve legacy saves', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (localStorage.getItem('skin_test_initialized')) return;
    localStorage.setItem('skin_test_initialized', 'true');
    localStorage.setItem('brainrot_total_coins', '700');
    localStorage.setItem(
      'brainrot_unlocked_skins',
      JSON.stringify(['cyber_glitch', 'golden_sigma']),
    );
  });
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
  await page.goto('/');
  const open = async () =>
    page.getByRole('button', { name: /^Skin:/i }).click();
  await open();
  await page.getByRole('button', { name: /Create a runner/ }).click();
  await page.getByLabel('Runner name').fill('Neon Explorer');
  await page.getByLabel('Suit color').fill('#ff8800');
  await page.getByLabel('Trim color').fill('#123456');
  await page.getByLabel('Glow color').fill('#aaff00');
  await page.getByLabel('Finish', { exact: true }).selectOption('MATTE');
  await expect(
    page
      .getByRole('img', { name: '3D preview of Neon Explorer' })
      .locator('canvas'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Save & equip' }).click();
  await expect(page.getByRole('status')).toHaveText(
    'Runner saved and equipped.',
  );
  const saved = await page.evaluate(() => ({
    selected: localStorage.getItem('brainrot_selected_skin'),
    customs: JSON.parse(localStorage.getItem('brainrot_custom_skins_v1')!),
  }));
  expect(saved.customs[0]).toMatchObject({
    id: saved.selected,
    primaryColor: '#ff8800',
    secondaryColor: '#123456',
    glowColor: '#aaff00',
    finish: 'MATTE',
  });
  await page.reload();
  await open();
  await expect(
    page.getByRole('heading', { name: 'Neon Explorer' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Runner name').fill('Cancelled name');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Neon Explorer' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Runner name').fill('Neon Scout');
  await page.getByRole('button', { name: 'Save & equip' }).click();
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Keep runner' }).click();
  await expect(page.getByRole('heading', { name: 'Neon Scout' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete' }).click();
  expect(
    await page.evaluate(() => localStorage.getItem('brainrot_selected_skin')),
  ).toBe('cyber_glitch');
  expect(
    await page.evaluate(() => localStorage.getItem('brainrot_total_coins')),
  ).toBe('700');
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem('brainrot_unlocked_skins')!),
    ),
  ).toContain('golden_sigma');
  await page.reload();
  await open();
  await expect(page.getByRole('button', { name: /Neon Scout/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('skin updates reuse model resources and change real materials', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const path = '/src/game/CharacterModel.ts';
    const { CharacterModel } = await import(path);
    const model = new CharacterModel({
      primary: 1,
      secondary: 2,
      glow: 3,
      accent: 0xffffff,
    });
    const meshes: any[] = [];
    model.group.traverse((node: any) => {
      if (node.isMesh) meshes.push(node);
    });
    const before = meshes.map((m) => [m.geometry.uuid, m.material.uuid]);
    for (let i = 0; i < 50; i++)
      model.updateSkin({
        primary: 0xff8800,
        secondary: 0x123456,
        glow: 0xaaff00,
        accent: 0xffffff,
        finish: 'MATTE',
      });
    const suit = meshes.find((m) => m.material.color?.getHex() === 0xff8800);
    return {
      stable:
        JSON.stringify(before) ===
        JSON.stringify(meshes.map((m) => [m.geometry.uuid, m.material.uuid])),
      roughness: suit?.material.roughness,
      glow: meshes.some((m) => m.material.color?.getHex() === 0xaaff00),
    };
  });
  expect(result).toEqual({ stable: true, roughness: 0.8, glow: true });
});

test('creator works with denied storage and clearly reports session-only saving', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-20T12:00:00Z') });
  await page.clock.pauseAt(new Date('2026-10-20T12:00:01Z'));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new DOMException('denied', 'SecurityError');
      },
    });
    // Older / insecure browser contexts may not expose randomUUID.
    Object.defineProperty(crypto, 'randomUUID', { value: undefined });
  });
  await page.goto('/');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: /^Skin:/ }).click();
  await page.getByRole('button', { name: /Create a runner/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Skins' });
  await dialog.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(
    dialog.getByRole('button', { name: 'Cancel', exact: true }),
  ).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(
    dialog.getByRole('button', { name: 'Close', exact: true }),
  ).toBeFocused();
  await page.getByLabel('Runner name').fill('Session Runner');
  await page.getByRole('button', { name: 'Save & equip' }).click();
  await expect(dialog.getByRole('status')).toHaveText(
    'Runner equipped for this session. Device storage is unavailable.',
  );
  await expect(
    page.getByRole('heading', { name: 'Session Runner' }),
  ).toBeVisible();
});
