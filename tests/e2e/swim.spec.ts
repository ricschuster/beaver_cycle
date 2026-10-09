import { expect, test } from '@playwright/test';
import { DOOR_DISTANCE, doorPoint } from '../../src/sim/lodge';
import { hasTiles, shot, startGame, tap, walkToPoint, world } from './helpers';
// Swimming, diving, breath, and the tail slap in the real game, at the lake by the start lodge. Needs the valley tiles.

test('the beaver swims in deep water, dives while Space is held, loses breath, and recovers it at the surface', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  let w = await world(page);
  expect(w.beaver.mode).toBe('walk');
  // Out on the lake in front of the lodge door, where the water is deep.
  await walkToPoint(page, doorPoint(w.lodge, DOOR_DISTANCE + 8), 2, 60_000);
  await page.waitForFunction(() => (window as any).__game.world().beaver.mode === 'swim', null, { polling: 100, timeout: 10_000 });
  w = await world(page);
  expect(w.beaver.breath).toBe(1);
  await expect(page.locator('#breath-meter')).toBeHidden();
  const surfaceY = w.beaver.y;

  // Hold Space: it dives, goes down, and the breath meter shows and drains.
  await page.keyboard.down('Space');
  await page.waitForFunction(() => (window as any).__game.world().beaver.mode === 'dive', null, { polling: 100, timeout: 10_000 });
  await page.waitForTimeout(2500);
  w = await world(page);
  expect(w.beaver.y).toBeLessThan(surfaceY - 0.5);
  expect(w.beaver.breath).toBeLessThan(1);
  expect(w.beaver.breath).toBeGreaterThan(0);
  await expect(page.locator('#breath-meter')).toBeVisible();
  await shot(page, 'swim-01-dive');
  const low = w.beaver.breath;
  await page.waitForTimeout(1500);
  expect((await world(page)).beaver.breath).toBeLessThan(low);

  // Let go: it rises to the surface, swims, and the breath comes back until the meter hides again.
  await page.keyboard.up('Space');
  await page.waitForFunction(() => (window as any).__game.world().beaver.mode === 'swim', null, { polling: 100, timeout: 15_000 });
  await page.waitForFunction(() => (window as any).__game.world().beaver.breath === 1, null, { polling: 200, timeout: 30_000 });
  await expect(page.locator('#breath-meter')).toBeHidden();
  expect(errors).toEqual([]);
});

test('the tail slap sounds on land and at the surface, with a cooldown, and not under water', async ({ page }) => {
  test.setTimeout(180_000);
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  expect((await world(page)).lastSlap).toBeNull();
  await tap(page, 'KeyT');
  await page.waitForFunction(() => (window as any).__game.world().lastSlap !== null, null, { polling: 50, timeout: 5000 });
  const first = (await world(page)).lastSlap;
  // A second press at once is inside the cooldown (1 simulated second): the slap stays the first.
  await tap(page, 'KeyT');
  expect((await world(page)).lastSlap.time).toBe(first.time);
  // After the cooldown a new slap comes.
  await page.waitForFunction((t) => (window as any).__game.world().time - t > 1.3, first.time, { polling: 100, timeout: 20_000 });
  await tap(page, 'KeyT');
  await page.waitForFunction((t) => (window as any).__game.world().lastSlap.time > t, first.time, { polling: 50, timeout: 5000 });

  // Under water it makes no sound.
  const w = await world(page);
  await walkToPoint(page, doorPoint(w.lodge, DOOR_DISTANCE + 8), 2, 60_000);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => (window as any).__game.world().beaver.mode === 'dive', null, { polling: 100, timeout: 10_000 });
  const before = (await world(page)).lastSlap.time;
  await page.waitForTimeout(1500);
  await tap(page, 'KeyT');
  await page.waitForTimeout(400);
  expect((await world(page)).lastSlap.time).toBe(before);
  await page.keyboard.up('Space');
});
