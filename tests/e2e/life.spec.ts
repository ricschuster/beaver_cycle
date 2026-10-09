import { expect, test } from '@playwright/test';
import { hasTiles, startGame, world } from './helpers';
// The life stages in the real game (docs/design/22_life_stages.md): a baby starts in the lodge and keeps to its pond,
// and the test menu moves the beaver from one stage to the next.

test('a baby starts on its nest in the lodge, and the test menu steps through the stages', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 'stage=baby');
  test.skip(!(await hasTiles(page)), 'the test lodge needs the tiles built locally');
  let w = await world(page);
  expect(w.inLodge).toBe(true);
  await expect(page.locator('#life-hud')).toContainText(/baby/i);
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-stage="teenager"]').click();
  await expect(page.locator('#life-hud')).toContainText(/teenager/i);
  w = await world(page);
  expect(w.lodge).not.toBeNull();
  expect(errors).toEqual([]);
});

test('a new baby is born in the lodge with its own list of achievements', async ({ page }) => {
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'the test lodge needs the tiles built locally');
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-action="new-life"]').click();
  const w = await world(page);
  expect(w.generation).toBe(1);
  expect(w.achievements).toEqual([]);
  expect(w.inLodge).toBe(true);
  await expect(page.locator('#life-hud')).toContainText(/baby/i);
});
