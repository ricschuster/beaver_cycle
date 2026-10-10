import { expect, test } from '@playwright/test';
import { buildLodge, collectToasts, enterLodgeAndRest, setSpeed, shot, startGame, toasts, walkTo, world } from './helpers';
// A playtest of the family cycle (docs/design/23_leaving_and_next_baby.md) in the real game, driven by the keys and the test menu.
// Run it with PLAYTEST_SHOTS=dir to keep screenshots of the key moments.

test('the family cycle: leave home, hear and find a partner', async ({ page }) => {
  test.setTimeout(1_800_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 'stage=teenager');
  // The real valley is needed (the lone beavers sit at its dam spots); the CI build has only the flat fallback.
  test.skip(await page.evaluate(() => (window as any).__game.stats() === null), 'needs the tiles built locally');
  await page.waitForTimeout(1500);
  let w = await world(page);
  console.log('start', JSON.stringify({ lodge: w.lodge, beaver: w.beaver, spots: w.spots.length }));
  await shot(page, '01-teenager-at-home');

  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-stage="adult"]').click();
  await page.waitForTimeout(800);
  w = await world(page);
  console.log('left', JSON.stringify({ lodge: w.lodge, formerHomes: w.formerHomes.length, partners: w.partners.map((p: any) => [p.id, Math.round(p.x), Math.round(p.z)]) }));
  await shot(page, '02-left-home');
  expect(w.partners).toHaveLength(3);
  expect(w.lodge).toBeNull();
  expect(w.formerHomes).toHaveLength(1);
  const home = w.formerHomes[0];
  const dist = w.partners.map((p: any) => Math.round(Math.hypot(p.x - home.x, p.z - home.z)));
  console.log('partner distances from home (m)', dist);

  // Walk to the nearest lone beaver at x20, the way a player would, and see it follow.
  await page.locator('button[data-speed="20"]').click();
  await page.getByRole('button', { name: 'Test menu' }).click();
  const nearest = w.partners.reduce((a: any, b: any) => (Math.hypot(a.x - home.x, a.z - home.z) < Math.hypot(b.x - home.x, b.z - home.z) ? a : b));
  // The walk ends when it is met, which makes the beaver follow (it then trails the player, so it never gets close again).
  const met = async (): Promise<boolean> => (await world(page)).partners.some((p: any) => p.state === 'following');
  const target = async () => (await world(page)).partners.find((p: any) => p.id === nearest.id);
  // Toasts show one at a time, so record them all.
  await collectToasts(page);
  let reached = false;
  for (let i = 0; i < 60 && !reached; i++) reached = (await walkTo(page, target, 6, 3000)) || (await met());
  w = await world(page);
  console.log('reached', reached, JSON.stringify({ beaver: w.beaver, partners: w.partners.map((p: any) => [p.id, p.state, Math.round(p.x), Math.round(p.z)]) }));
  await page.waitForTimeout(300);
  await shot(page, '03-met-partner');
  expect(w.partners.find((p: any) => p.id === nearest.id).state).toBe('following');
  // Toasts queue and each shows for about 4 s of real time, so earlier ones (a fox, tail slaps) can come first.
  await expect.poll(async () => (await toasts(page)).some((t) => t.includes('slaps its tail and follows')), { timeout: 90_000 }).toBe(true);

  // The meeting place has no water for a lodge within 300 m, so lead it back to the lake by the old home (fast, then at normal
  // speed so the beaver does not overshoot its work).
  await walkTo(page, async () => home, 40, 120_000);
  await setSpeed(page, 1);
  await buildLodge(page);
  w = await world(page);
  expect(w.lodge.wood).toBeGreaterThanOrEqual(10);
  // The new lodge does not stand on the old one.
  expect(Math.hypot(w.lodge.x - home.x, w.lodge.z - home.z)).toBeGreaterThan(6);
  const mate = w.partners.find((p: any) => p.state === 'home');
  expect(mate, 'the partner moves into the whole lodge').toBeTruthy();
  await shot(page, '04-new-lodge');

  // Rest in the lodge, and sleep through winter to the first day of spring: a kit is born.
  await enterLodgeAndRest(page);
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-season="winter"]').click();
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-action="sleep-season"]').click();
  await page.waitForFunction(() => (window as any).__game.world().generation === 1, null, { polling: 200, timeout: 30_000 });
  w = await world(page);
  expect(w.inLodge).toBe(true);
  expect(w.partners).toEqual([]);
  expect(w.achievements).toEqual([]);
  await expect(page.locator('#life-hud')).toContainText(/baby/i);
  await page.waitForTimeout(3000); // the screen fades back from sleep
  await shot(page, '05-kit-born');
  expect(errors).toEqual([]);
});
