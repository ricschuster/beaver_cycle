import { expect, test } from '@playwright/test';
import { buildDamByHand, dragLog, fellNearestTree, goToNearestSpot, hasTiles, scoopLoad, shot, startGame, tap, toggleMenu, walkToPoint, world } from './helpers';
// Dams by real play (docs/design/20_dams_and_ponds.md, 15_build_and_repair.md): at the nearest dam spot the beaver puts a log
// and a load of mud on a dam, then the test menu finishes it. dam.spec.ts covers the menu-only path. Needs the valley tiles.

test('a log and a load of mud go on a dam by real play, then the dam is finished and holds a pond', async ({ page }) => {
  test.setTimeout(600_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const spot = await goToNearestSpot(page);
  expect((await world(page)).dams).toHaveLength(0);

  // A log: fell a tree by the spot, drag it onto the ring, and build.
  const id = await fellNearestTree(page, 60);
  expect(id, 'a tree to fell near the dam spot').not.toBeNull();
  await dragLog(page, id!);
  await walkToPoint(page, spot.bed, 3, 30_000);
  await tap(page, 'KeyE');
  await page.waitForFunction(() => (window as any).__game.world().dams.length === 1, null, { polling: 100, timeout: 5000 });
  let w = await world(page);
  expect(w.dams[0].spot).toBe(spot.id);
  expect(w.dams[0].wood).toBeGreaterThanOrEqual(1);
  expect(w.drag).toBeNull();
  expect(w.achievements).not.toContain('firstDam');
  await shot(page, 'dams-01-first-log');

  // A load of mud: scoop it from wet ground away from trees, and put it on the dam. That counts as one load hauled.
  const kind = await scoopLoad(page, spot);
  expect(kind, 'mud or a rock in the mouth').not.toBeNull();
  await walkToPoint(page, spot.bed, 3, 20_000);
  await tap(page, 'KeyE');
  await page.waitForFunction(() => (window as any).__game.world().haul === null, null, { polling: 100, timeout: 5000 });
  w = await world(page);
  expect(w.hauled).toBe(1);
  expect(w.dams[0][kind!]).toBe(1);
  expect(w.dams[0].wear, 'a dam that is not whole yet does not wear').toBeUndefined();

  // The test menu finishes it: the pond forms, and First dam is won.
  const spotsBefore = w.spots.length;
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-action="dam-fill"]').click();
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.waitForTimeout(1500);
  w = await world(page);
  expect(w.dams[0].wear).toBeTruthy();
  expect(w.ponds.length).toBeGreaterThan(0);
  expect(w.achievements).toContain('firstDam');
  // A new pond may open new dam spots on the streams round it, never fewer.
  expect(w.spots.length).toBeGreaterThanOrEqual(spotsBefore);
  console.log('dam', JSON.stringify({ level: w.dams[0].level ?? 1, scale: w.dams[0].scale ?? 1, spotsBefore, spotsAfter: w.spots.length, ponds: w.ponds.length, achievements: w.achievements }));
  await shot(page, 'dams-02-pond');
  expect(errors).toEqual([]);
});

test('filling a dam again raises it level by level, the pond crest rises with it, and the top level wins Higher dam', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const spot = await goToNearestSpot(page);
  // The levels a spot holds follow the crest its scan found: 1.0, 1.5, and 2.0 m.
  const top = [1.0, 1.5, 2.0].filter((c) => c <= spot.maxCrest + 1e-6).length || 1;
  await page.getByRole('button', { name: 'Test menu' }).click();
  const crests: number[] = [];
  for (let level = 1; level <= top; level++) {
    await page.locator('button[data-action="dam-fill"]').click();
    await page.waitForTimeout(1200);
    const w = await world(page);
    expect(w.dams).toHaveLength(1);
    expect(w.dams[0].level ?? 1, `level after fill ${level}`).toBe(level);
    expect(w.ponds.length).toBeGreaterThan(0);
    crests.push(w.ponds[0].crest);
  }
  console.log('levels', JSON.stringify({ maxCrest: spot.maxCrest, top, crests }));
  for (let i = 1; i < crests.length; i++) expect(crests[i]!, 'the pond rises with the level').toBeGreaterThan(crests[i - 1]!);
  const w = await world(page);
  expect(w.achievements).toContain('firstDam');
  if (top >= 2) expect(w.achievements, 'as high as this spot goes').toContain('highDam');
  else expect(w.achievements).not.toContain('highDam');
  expect(errors).toEqual([]);
});


test('a first dam is built whole by real play, every log, load of mud and rock, and holds a pond by itself', async ({ page }) => {
  test.setTimeout(1_800_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const spot = await goToNearestSpot(page);
  const trips = await buildDamByHand(page, spot);
  await page.waitForTimeout(1500);
  const w = await world(page);
  console.log('hand dam', JSON.stringify({ trips, dam: w.dams[0], hauled: w.hauled, ponds: w.ponds.length }));
  expect(w.dams).toHaveLength(1);
  // Level 1 costs 8 wood, 4 mud and 2 rocks at a scale that follows the width of the stream there.
  expect(w.dams[0].wood).toBeGreaterThanOrEqual(8);
  expect(w.dams[0].mud).toBeGreaterThanOrEqual(4);
  expect(w.dams[0].rock).toBeGreaterThanOrEqual(2);
  expect(w.hauled).toBeGreaterThanOrEqual(6);
  expect(w.ponds.length, 'a whole dam holds a pond without the test menu').toBeGreaterThan(0);
  expect(w.achievements).toContain('firstDam');
  await shot(page, 'dams-03-hand-built');
  expect(errors).toEqual([]);
});

// Pioneer: a pond opens a new spot, and a dam started there wins the achievement. Only some spots find one. In the south the first
// spot finds one about 60 m off (a probe of all six locations, session 97), so the test uses it.
test('a new pond opens a new dam spot, and a dam started there wins Pioneer', async ({ page }) => {
  test.setTimeout(400_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 'lodge=0');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await toggleMenu(page);
  const start = (await world(page)).beaver;
  await page.locator('button[data-location="south"]').click();
  await page.waitForFunction((b) => { const w = (window as any).__game.world().beaver; return Math.hypot(w.x - b.x, w.z - b.z) > 500; }, start, { polling: 200, timeout: 60_000 });
  await page.waitForTimeout(2500);
  await toggleMenu(page);
  const first = await goToNearestSpot(page);
  let w = await world(page);
  const before = w.spots.length;
  expect(w.spots.filter((s: any) => s.found)).toHaveLength(0);
  await toggleMenu(page);
  await page.locator('button[data-action="dam-fill"]').click();
  await page.waitForTimeout(1500);
  await toggleMenu(page);
  w = await world(page);
  const found = w.spots.filter((s: any) => s.found);
  expect(w.spots.length, 'the pond opened a new spot').toBeGreaterThan(before);
  expect(found.length).toBeGreaterThan(0);
  expect(found[0].id).not.toBe(first.id);
  expect(w.achievements).not.toContain('pioneer');

  // Walk to the new spot and put a log on it by real play.
  const next = found[0];
  await walkToPoint(page, next.bed, 6, 90_000);
  const id = await fellNearestTree(page, 60);
  expect(id, 'a tree to fell near the new spot').not.toBeNull();
  await dragLog(page, id!);
  await walkToPoint(page, next.bed, 3, 40_000);
  await tap(page, 'KeyE');
  await page.waitForFunction((sp) => (window as any).__game.world().dams.some((d: any) => d.spot === sp), next.id, { polling: 100, timeout: 5000 });
  w = await world(page);
  expect(w.achievements).toContain('pioneer');
  await shot(page, 'dams-04-pioneer');
  expect(errors).toEqual([]);
});
