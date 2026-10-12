import { expect, test } from '@playwright/test';
import { buildLodge, goToNearestSpot, hasTiles, shot, startGame, toggleMenu, walkToPoint, world } from './helpers';
// Each play location on the real valley (#42): the test menu jumps there, finishes a dam at the nearest spot, and the pond has a
// place a lodge can start. With PLAYTEST_BUILD=1 the beaver also fells trees and builds the lodge by hand, which is slow (a few
// minutes a location). The unit test src/terrain/locations.test.ts checks the same ground without the browser; this one checks
// that the beaver can really do it there. All six pass without PLAYTEST_BUILD (about 7 minutes, #315); the hand built lodge is not run yet.

const LOCATIONS = ['core', 'north', 'south', 'east-oedseen', 'vorderer-springbach', 'hinterer-springbach'];
const BUILD = process.env.PLAYTEST_BUILD === '1';

for (const id of LOCATIONS) {
  test(`${id}: a dam holds a pond with room for a lodge${BUILD ? ', and the lodge gets built' : ''}`, async ({ page }) => {
    test.setTimeout(BUILD ? 900_000 : 240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await startGame(page, 'lodge=0');
    test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
    await toggleMenu(page);
    await expect(page.locator(`button[data-location="${id}"]`), `the test menu can jump to ${id}`).toBeEnabled();
    const before = await world(page);
    await page.locator(`button[data-location="${id}"]`).click();
    if (id !== 'core') {
      await page.waitForFunction((b) => { const w = (window as any).__game.world().beaver; return Math.hypot(w.x - b.x, w.z - b.z) > 500; }, before.beaver, { polling: 200, timeout: 60_000 });
    }
    await page.waitForTimeout(2500);
    await toggleMenu(page);
    let spot = await goToNearestSpot(page);
    expect(spot, 'a dam spot at the location').toBeTruthy();
    // A lodge needs a level 2 pond (crest 1.5 m), and the nearest spot may hold only level 1 (north since the rescan in #385): walk
    // toward the nearest spot that holds level 2, until it is the nearest, and go to it.
    if (spot.maxCrest < 1.5) {
      const b = (await world(page)).beaver;
      const deep = (await world(page)).spots.filter((s: any) => s.maxCrest >= 1.5).sort((p: any, q: any) => Math.hypot(p.bed.x - b.x, p.bed.z - b.z) - Math.hypot(q.bed.x - b.x, q.bed.z - b.z))[0];
      expect(deep, 'a spot at the location that holds a level 2 dam').toBeTruthy();
      await walkToPoint(page, deep.bed, 40, 180_000);
      spot = await goToNearestSpot(page);
      expect(spot.id, 'went to the spot that holds level 2').toBe(deep.id);
    }
    // A lodge sees only the pond of a level 2 dam or higher (design note 20, `lodgeGround`): a level 1 pond is too shallow for the
    // door. "Finish dam here" fills level 1 and each press after raises it a level, so press it up to the top level the spot holds.
    const top = [1.0, 1.5, 2.0].filter((c) => c <= spot.maxCrest + 1e-6).length || 1;
    await page.getByRole('button', { name: 'Test menu' }).click();
    for (let level = 1; level <= top; level++) {
      await page.locator('button[data-action="dam-fill"]').click();
      await page.waitForTimeout(1500);
    }
    await page.getByRole('button', { name: 'Test menu' }).click();
    const w = await world(page);
    console.log(id, JSON.stringify({ spot: spot.id, maxCrest: spot.maxCrest, level: w.dams[0]?.level ?? 1, ponds: w.ponds.map((p: any) => ({ crest: p.crest, area: p.area })) }));
    expect(w.dams).toHaveLength(1);
    expect(w.ponds.length).toBeGreaterThan(0);
    expect(w.dams[0].level ?? 1, 'the nearest spot holds a dam high enough for a lodge pond').toBeGreaterThanOrEqual(2);
    const site = await page.evaluate(() => (window as any).__game.lodgeSite(120));
    expect(site, 'a place a lodge can start on the new pond').toBeTruthy();
    await shot(page, `locations-${id}-pond`);
    if (BUILD) {
      await buildLodge(page);
      expect((await world(page)).lodge.wood).toBeGreaterThanOrEqual(10);
      await shot(page, `locations-${id}-lodge`);
    }
    expect(errors).toEqual([]);
  });
}
