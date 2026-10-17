/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from '@playwright/test';
import { goToNearestSpot, hasTiles, menuClick, startGame, world } from './helpers';
// Takes candidate pictures for the Play Store listing from the real valley: the seasons, a dam and its pond, a family, a dream,
// another place. It does nothing unless STORE_SHOTS names a folder; pick the best by eye and copy them to
// tools/standalone-apk/store/. Needs the local tiles, about 1 to 2 minutes:
//   STORE_SHOTS=some/dir npx playwright test tests/e2e/store-shots.spec.ts

const DIR = process.env.STORE_SHOTS;

test.describe('pictures for the store listing', () => {
  test.skip(!DIR, 'set STORE_SHOTS to a folder to take them');
  test.use({ viewport: { width: 1024, height: 600 }, deviceScaleFactor: 2 });

  type P = import('@playwright/test').Page;
  const take = async (page: P, name: string): Promise<void> => {
    const hide = await page.addStyleTag({ content: 'button[aria-label="Test menu"]{visibility:hidden !important}' });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/${name}.png`, type: 'png' });
    await hide.evaluate((el) => (el as Element).remove());
  };
  // Camera `side` radians round from behind the beaver (or from the line to `toward`), tilted by `pitch`, `dist` metres out.
  const frame = async (page: P, side: number, pitch: number, dist: number, toward?: { x: number; z: number }): Promise<void> => {
    await page.evaluate(
      ([s, p, d, t]) => {
        const g = (window as any).__game;
        const v = g.view();
        const b = g.world().beaver;
        const bearing = t ? Math.atan2((t as any).x - b.x, (t as any).z - b.z) : b.heading;
        v.yaw = bearing + Math.PI + (s as number);
        v.pitch = p as number;
        v.dist = d as number;
      },
      [side, pitch, dist, toward ?? null] as const,
    );
    await page.waitForTimeout(900);
  };
  const season = (page: P, s: string): Promise<void> => menuClick(page, `button[data-season="${s}"]`);
  const time = (page: P, t: string): Promise<void> => menuClick(page, `button[data-time="${t}"]`);

  test('candidates', async ({ page }) => {
    test.setTimeout(600_000);
    await startGame(page, 'touch=1&coach=0');
    test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
    await page.waitForTimeout(1500);

    // The seasons round the lodge, the beaver beside it.
    const w0 = await world(page);
    const lodge = w0.lodge;
    for (const [s, t] of [['spring', 'morning'], ['summer', 'noon'], ['autumn', 'evening'], ['winter', 'noon']] as const) {
      await season(page, s);
      await time(page, t);
      await page.waitForTimeout(1500);
      await frame(page, 0.7, 0.35, 10, lodge);
      await take(page, `a-${s}-lodge`);
      await frame(page, 2.4, 0.5, 18, lodge);
      await take(page, `a-${s}-wide`);
    }

    // Night in summer.
    await season(page, 'summer');
    await time(page, 'night');
    await page.waitForTimeout(1500);
    await frame(page, 0.7, 0.35, 10, lodge);
    await take(page, 'b-night');
    await time(page, 'evening');
    await frame(page, 0.7, 0.3, 10, lodge);
    await take(page, 'b-evening');

    // Family: a kit with its parents.
    await season(page, 'summer');
    await time(page, 'morning');
    await menuClick(page, 'button[data-stage="baby"]');
    await page.waitForTimeout(1500);
    await take(page, 'c-baby-lodge');
    await menuClick(page, 'button[data-stage="teenager"]');
    await page.waitForTimeout(1500);
    await take(page, 'c-teenager');
    const parents = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__game.parents())));
    if (parents[0]) {
      await frame(page, 0.8, 0.3, 7, parents[0]);
      await take(page, 'c-parent');
    }
    await menuClick(page, 'button[data-stage="adult"]');
    await page.waitForTimeout(1500);

    // A dam and its pond, summer and winter.
    await goToNearestSpot(page);
    await menuClick(page, 'button[data-action="dam-fill"]');
    await menuClick(page, 'button[data-action="dam-fill"]');
    await menuClick(page, 'button[data-action="dam-fill"]');
    await page.waitForTimeout(4000);
    await frame(page, Math.PI / 2, 0.5, 14);
    await take(page, 'd-dam');
    await frame(page, 0.4, 0.25, 7);
    await take(page, 'd-dam-low');
    await frame(page, Math.PI, 0.6, 30);
    await take(page, 'd-dam-high');
    await season(page, 'autumn');
    await time(page, 'evening');
    await page.waitForTimeout(1500);
    await frame(page, Math.PI / 2, 0.4, 12);
    await take(page, 'd-dam-autumn');
    await season(page, 'winter');
    await time(page, 'noon');
    await page.waitForTimeout(1500);
    await take(page, 'd-dam-winter');

    await season(page, 'summer');
    await menuClick(page, 'button[data-action="store-fill"]');
    await page.waitForTimeout(800);
    await menuClick(page, 'button[data-fly="map"]');
    await page.waitForTimeout(2500);
    await take(page, 'e-map');
  });

  test('the dream and other places', async ({ page }) => {
    test.setTimeout(600_000);
    await startGame(page, 'touch=1&coach=0');
    test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
    await page.waitForTimeout(1500);
    await season(page, 'summer');
    await time(page, 'morning');
    await menuClick(page, 'button[data-action="store-fill"]');
    await page.waitForTimeout(800);
    await take(page, 'e-store');
    await menuClick(page, 'button[data-action="dream"]');
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(4000);
      await take(page, `f-dream-${i}`);
    }

    // Other places in the valley.
    for (const id of ['north', 'south', 'east-oedseen', 'vorderer-springbach', 'hinterer-springbach']) {
      const before = (await world(page)).beaver;
      await menuClick(page, `button[data-location="${id}"]`);
      await page.waitForFunction((b) => { const q = (window as any).__game.world().beaver; return Math.hypot(q.x - b.x, q.z - b.z) > 300; }, before, { polling: 200, timeout: 60_000 }).catch(() => undefined);
      await page.waitForTimeout(3500);
      await frame(page, 0.5, 0.35, 12);
      await take(page, `g-${id}`);
    }
    console.log('neighbours', JSON.stringify((await world(page)).neighbours?.length));
  });
});
