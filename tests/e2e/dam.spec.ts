import { expect, test } from '@playwright/test';
import { hasTiles, shot, startGame, world } from './helpers';
// Dams in the real valley: the test menu goes to the nearest dam spot and finishes a dam there, and the dam holds a pond.

test('a finished dam holds a pond and wins the First dam achievement', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  expect((await world(page)).dams).toHaveLength(0);
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-action="dam-go"]').click();
  await page.waitForFunction(() => {
    const w = (window as any).__game.world();
    return w.spots.some((s: any) => Math.hypot(s.bed.x - w.beaver.x, s.bed.z - w.beaver.z) < 15);
  }, null, { polling: 200, timeout: 60_000 });
  await page.locator('button[data-action="dam-fill"]').click();
  await page.waitForTimeout(1500);
  const w = await world(page);
  expect(w.dams).toHaveLength(1);
  expect(w.ponds.length).toBeGreaterThan(0);
  expect(w.achievements).toContain('firstDam');
  await page.getByRole('button', { name: 'Test menu' }).click();
  await shot(page, 'dam-01-pond');
  expect(errors).toEqual([]);
});
