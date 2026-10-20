import { test, expect } from '@playwright/test';

test('production PWA installs its cache and starts offline without changing progress', async ({
  page,
  context,
}) => {
  await page.goto('http://127.0.0.1:3200/');
  await expect(page.getByRole('button', { name: 'PLAY RUN' })).toBeVisible();
  await page.evaluate(async () => {
    localStorage.setItem('brainrot_total_coins', '321');
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const manifest = await page.request.get('http://127.0.0.1:3200/manifest.webmanifest');
  expect((await manifest.json()).short_name).toBe('BRAINROT RUN');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'PLAY RUN' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('brainrot_total_coins'))).toBe('321');
  await page.getByRole('button', { name: 'PLAY RUN' }).click();
  await expect(page.getByText('TUTORIAL · STEP 1/5')).toBeVisible();
});
