import { expect, test } from '@playwright/test';
import { buildLodge, goToNearestSpot, hasTiles, shot, startGame, toggleMenu, world } from './helpers';
// Each play location on the real valley (#42): the test menu jumps there, finishes a dam at the nearest spot, and the pond has a
// place a lodge can start. With PLAYTEST_BUILD=1 the beaver also fells trees and builds the lodge by hand, which is slow (a few
// minutes a location). The unit test src/terrain/locations.test.ts checks the same ground without the browser; this one checks
// that the beaver can really do it there. Written in session 64 and not run yet; run it before relying on it.

const LOCATIONS = ['core', 'north', 'south', 'east-oedseen', 'vorderer-springbach', 'hinterer-springbach'];
const BUILD = process.env.PLAYTEST_BUILD === '1';

for (const id of LOCATIONS) {
  test(`${id}: a dam holds a pond with room for a lodge${BUILD ? ', and the lodge gets built' : ''}`, async ({ page }) => {
    test.setTimeout(BUILD ? 600_000 : 240_000);
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
    const spot = await goToNearestSpot(page);
    expect(spot, 'a dam spot at the location').toBeTruthy();
    await page.getByRole('button', { name: 'Test menu' }).click();
    await page.locator('button[data-action="dam-fill"]').click();
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: 'Test menu' }).click();
    const w = await world(page);
    expect(w.dams).toHaveLength(1);
    expect(w.ponds.length).toBeGreaterThan(0);
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
