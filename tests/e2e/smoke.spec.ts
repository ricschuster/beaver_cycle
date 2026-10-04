import { expect, test } from '@playwright/test';

test('the game page renders a canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('canvas')).toBeVisible();
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});

test('tiles stream in when they have been built', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  const stats = await page.evaluate(() => (window as any).__game.stats());
  // Tiles are built locally and absent in CI, where the flat fallback is used.
  if (stats) {
    expect(stats.meshes).toBeGreaterThan(0);
    const y = await page.evaluate(() => (window as any).__game.world().beaver.y);
    expect(y).toBeGreaterThan(500); // standing on the real ground, not at 0
  }
  expect(errors).toEqual([]);
});
