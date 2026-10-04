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

test('the test menu sets the speed and jumps to a location', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  const hasTiles = await page.evaluate(() => (window as any).__game.stats() !== null);
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-speed="100"]').click();
  expect(await page.evaluate(() => (window as any).__game.world().speedMultiplier)).toBe(100);
  // Locations exist only with tiles (absent in CI).
  if (hasTiles) {
    await expect(page.locator('button[data-location="east-oedseen"]')).toBeDisabled();
    await page.locator('button[data-location="north"]').click();
    await page.waitForFunction(() => (window as any).__game.world().beaver.z < -1900, null, { polling: 100 });
    expect(await page.evaluate(() => (window as any).__game.world().beaver.y)).toBeGreaterThan(500);
  }
  expect(errors).toEqual([]);
});
