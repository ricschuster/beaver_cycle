import { expect, test } from '@playwright/test';
import { enterLodgeAndRest, fellNearestTree, hasTiles, nearestPad, openStash, pickPad, shot, startGame, tap, walkToPoint, world } from './helpers';
// Food and the store in the real valley (docs/design/16_food_store.md): pick a lily pad, strip a branch off a log, put pieces
// in the store through the stash screen, take one out and eat it in the lodge, and the pads that grow back next year.
// The default start has a whole test lodge with a store beside its door. Needs the valley tiles.

test('a lily pad goes into the store, and comes out to be eaten in the lodge', async ({ page }) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  expect((await world(page)).store.every((f: unknown) => f === null)).toBe(true);

  // Pick a pad: it is in the mouth, noted as picked, and counted for the water gardener.
  const pad = await nearestPad(page);
  expect(pad, 'lily pads float near the lodge in spring').not.toBeNull();
  const pickedId = await pickPad(page, pad!);
  let w = await world(page);
  expect(w.carry).toBe('lily');
  expect(Object.keys(w.picked)).toContain(pickedId);
  expect(w.padsPicked).toBe(1);
  await expect(page.locator('#carry-hud')).toContainText(/lily/i);
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-action="achievements"]').click();
  await expect(page.locator('pre', { hasText: 'Water gardener 1/20' })).toBeAttached();
  await page.locator('button[data-action="achievements"]').click();
  await page.getByRole('button', { name: 'Test menu' }).click();
  // The picked pad is gone from the water.
  expect((await page.evaluate(() => (window as any).__game.lilyPadsNear(3) as { id: string }[])).map((p) => p.id)).not.toContain(pickedId);

  // Put it in the store through the stash screen.
  await openStash(page);
  await expect(page.locator('#stash')).toBeVisible();
  await shot(page, 'food-01-stash');
  await page.locator('#stash button[data-slot="0"]').click();
  await page.waitForFunction(() => (window as any).__game.world().store[0] === 'lily', null, { polling: 100, timeout: 5000 });
  w = await world(page);
  expect(w.carry).toBeNull();
  // A filled place with an empty mouth gives the piece back, which is how it is taken out to eat.
  await page.locator('#stash button[data-slot="0"]').click();
  await page.waitForFunction(() => (window as any).__game.world().carry === 'lily', null, { polling: 100, timeout: 5000 });
  expect((await world(page)).store[0]).toBeNull();
  await page.locator('#stash-close').click();
  await page.waitForFunction(() => (window as any).__game.world().stashOpen === false, null, { polling: 100, timeout: 5000 });

  // Eat it in the lodge: the gnaw button there eats the piece.
  await enterLodgeAndRest(page);
  expect((await world(page)).carry).toBe('lily');
  await tap(page, 'KeyE');
  await page.waitForFunction(() => (window as any).__game.world().eaten === 1, null, { polling: 100, timeout: 5000 });
  w = await world(page);
  expect(w.carry).toBeNull();
  expect(w.inLodge).toBe(true);
  expect(errors).toEqual([]);
});

test('a branch is stripped off a felled log and stored', async ({ page }) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const id = await fellNearestTree(page);
  expect(id).not.toBeNull();
  let w = await world(page);
  const log = w.logs.find((l: any) => l.id === id);
  expect(log).toBeTruthy();

  // Stand at the log and gnaw: one branch a press, into the mouth.
  const half = log.length / 2;
  await walkToPoint(page, { x: log.x - Math.sin(log.heading) * half * 0.5, z: log.z - Math.cos(log.heading) * half * 0.5 }, 1.2, 20_000);
  await page.waitForTimeout(300);
  await tap(page, 'KeyE');
  await page.waitForFunction(() => (window as any).__game.world().carry === 'branch', null, { polling: 100, timeout: 5000 });
  w = await world(page);
  expect(w.stripped[id!]).toBe(1);
  // The mouth is full: a second press strips nothing more.
  await tap(page, 'KeyE');
  await page.waitForTimeout(500);
  expect((await world(page)).stripped[id!]).toBe(1);

  // Into the store, as the second place, so the HUD counts a branch as two meals.
  await openStash(page);
  await page.locator('#stash button[data-slot="1"]').click();
  await page.waitForFunction(() => (window as any).__game.world().store[1] === 'branch', null, { polling: 100, timeout: 5000 });
  await page.locator('#stash-close').click();
  await page.waitForFunction(() => (window as any).__game.world().stashOpen === false, null, { polling: 100, timeout: 5000 });
  await page.waitForTimeout(300);
  await expect(page.locator('#carry-hud')).toContainText(/store 1 of 40, 2 meals/);
  await shot(page, 'food-02-branch-stored');
  expect(errors).toEqual([]);
});

test('lily pads are gone in winter and float again, picked ones too, the next year', async ({ page }) => {
  test.setTimeout(480_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const pad = await nearestPad(page);
  expect(pad).not.toBeNull();
  const pickedId = await pickPad(page, pad!);
  expect(Object.keys((await world(page)).picked)).toContain(pickedId);
  const padIds = (): Promise<string[]> => page.evaluate(() => ((window as any).__game.lilyPadsNear(200) as { id: string }[]).map((p) => p.id));
  expect(await padIds()).not.toContain(pickedId);

  // Rest in the lodge, then winter: no pads at all.
  await enterLodgeAndRest(page);
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-season="winter"]').click();
  await page.getByRole('button', { name: 'Test menu' }).click();
  expect(await padIds()).toEqual([]);
  // Sleep to the next season: spring of the next year. The pad picked last year floats again.
  await page.locator('button[data-action="sleep-season"]').click();
  await page.waitForFunction(() => (window as any).__game.world().clock >= 40 * 480, null, { polling: 200, timeout: 30_000 });
  await page.waitForTimeout(3000);
  await expect(page.locator('#clock-hud')).toContainText('Spring');
  expect(await padIds()).toContain(pickedId);
  // The old picking is still on record, and does not count again for the gardener.
  expect((await world(page)).padsPicked).toBe(1);
  expect(errors).toEqual([]);
});
