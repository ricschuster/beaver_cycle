import { expect, test } from '@playwright/test';
import { buildLodge, hasTiles, leaveLodgeByHole, menuClick, shot, startGame, world } from './helpers';
// A second and a third life in the real game (docs/design/23_leaving_and_next_baby.md): the beaver grows up, leaves home, builds a
// lodge of its own, and a new baby starts again. Each life has its own list of achievements, so Home can be won again.
// About 8 minutes, most of it the lodge being built with the keys. Needs the valley tiles.

const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/** The test menu's way through a life: a new baby, then the teenager and adult stages, which makes the beaver leave home. */
async function growUpAndLeave(page: import('@playwright/test').Page, homes: number): Promise<void> {
  await menuClick(page, 'button[data-stage="teenager"]');
  await page.waitForTimeout(400);
  await menuClick(page, 'button[data-stage="adult"]');
  await page.waitForFunction((n) => (window as any).__game.world().formerHomes.length === n, homes, { polling: 100, timeout: 10_000 });
}

test('a second life: leave home, build a lodge, win Home again, and leave again for a third', async ({ page }) => {
  test.setTimeout(1_800_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 'stage=baby');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const first = await world(page);
  expect(first.generation).toBe(0);
  expect(first.partners).toEqual([]);

  // The second life begins: its own list of achievements, and the lodge it was born in does not count as its work.
  await menuClick(page, 'button[data-action="new-life"]');
  let w = await world(page);
  expect(w.generation).toBe(1);
  expect(w.achievements).toEqual([]);
  expect(w.inLodge).toBe(true);
  expect(w.journey.inherited).toEqual(expect.arrayContaining(['lodge', 'store']));
  const parentCoats = w.parentCoats;

  // It grows up and leaves the lodge it was born in, which stays as a former home with its old parents.
  await growUpAndLeave(page, 1);
  w = await world(page);
  expect(w.lodge).toBeNull();
  expect(w.partners).toHaveLength(3);
  expect(w.formerHomes[0].parents).toEqual(parentCoats);
  expect(w.generation).toBe(1);
  // Nothing built from here is an inheritance: the new lodge is this life's own.
  expect(w.journey.inherited).not.toContain('lodge');
  expect(w.journey.inherited).not.toContain('store');
  const home0 = w.formerHomes[0];
  for (const p of w.partners) expect(dist(p, home0)).toBeGreaterThanOrEqual(120);

  // It builds a lodge of its own, by the same lake, and wins Home again.
  await buildLodge(page);
  w = await world(page);
  expect(w.lodge.wood).toBeGreaterThanOrEqual(10);
  // Not on top of the old home. The nearest site with deep water at its door can lie right beside it (4.8 m since #521, two
  // domes of 2.5 m touching), as the game does not keep a site clear of a former home.
  expect(dist(w.lodge, home0)).toBeGreaterThan(4);
  expect(w.achievements).toContain('home');
  await shot(page, 'second-life-01-own-lodge');

  // A third life: born in that lodge, grows up, and leaves it. Two former homes now, the second with the parents it had.
  const secondLodge = w.lodge;
  await menuClick(page, 'button[data-action="new-life"]');
  w = await world(page);
  expect(w.generation).toBe(2);
  expect(w.achievements).toEqual([]);
  expect(w.inLodge).toBe(true);
  expect(dist(w.beaver, secondLodge)).toBeLessThan(6);
  await growUpAndLeave(page, 2);
  w = await world(page);
  expect(w.formerHomes).toHaveLength(2);
  expect(w.formerHomes[1]).toMatchObject({ x: secondLodge.x, z: secondLodge.z });
  expect(w.formerHomes[1].parents).toEqual(w.parentCoats);
  expect(w.partners).toHaveLength(3);
  for (const p of w.partners) expect(dist(p, w.formerHomes[1])).toBeGreaterThanOrEqual(120);
  expect(w.lodge).toBeNull();
  await expect(page.locator('#toast')).toContainText('time to start a family of your own', { timeout: 30_000 });
  await shot(page, 'second-life-02-third-life-starts');
  expect(errors).toEqual([]);
});

// Screenshots only (PLAYTEST_SHOTS), to look at the three sizes (0.45, 0.75, 1) by eye: no assertion on how big they look.
test('the three stages can be seen one after the other, each without errors', async ({ page }) => {
  test.setTimeout(240_000);
  await startGame(page, 'stage=baby');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await leaveLodgeByHole(page);
  await page.waitForTimeout(1500);
  await shot(page, 'sizes-1-baby');
  for (const stage of ['teenager', 'adult']) {
    await startGame(page, `stage=${stage}`);
    await page.waitForTimeout(1500);
    await shot(page, `sizes-${stage === 'teenager' ? 2 : 3}-${stage}`);
  }
});
