/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from '@playwright/test';
import { dragLog, fellNearestTree, goToNearestSpot, hasTiles, leaveLodgeByHole, menuClick, parentsNow, startGame, tap, walkToPoint, world } from './helpers';
// Takes candidate pictures for the Play Store listing from the real valley: the seasons, a dam and its pond, a family, a dream,
// another place, and the `set` test below, which retakes the eight pictures of tools/standalone-apk/store/ (desktop keys, 1920x1080)
// in whatever language the run uses (`-g "the set"`). It does nothing unless STORE_SHOTS names a folder; pick the best by eye and copy them to
// tools/standalone-apk/store/. Needs the local tiles, about 1 to 2 minutes:
//   STORE_SHOTS=some/dir npx playwright test tests/e2e/store-shots.spec.ts
// With STORE_LANG=de the game runs in German and the pictures go to a de/ folder inside (the language must be in `LANGS` of
// src/i18n/index.ts, so until German ships, add it there for the run).

const LANG = process.env.STORE_LANG ?? 'en';
const DIR = process.env.STORE_SHOTS && (LANG === 'en' ? process.env.STORE_SHOTS : `${process.env.STORE_SHOTS}/${LANG}`);

test.describe('pictures for the store listing', () => {
  test.skip(!DIR, 'set STORE_SHOTS to a folder to take them');
  test.use({ viewport: { width: 1024, height: 600 }, deviceScaleFactor: 2 });
  test.beforeEach(async ({ page }) => {
    if (LANG !== 'en') await page.addInitScript((lang) => localStorage.setItem('beaver-cycle.prefs', JSON.stringify({ lang })), LANG);
  });

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
    // The dream covers the test menu's button, so open the menu and click Dream without closing it again.
    await page.getByRole('button', { name: 'Test menu' }).click();
    await page.locator('button[data-action="dream"]').click();
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(4000);
      await take(page, `f-dream-${i}`);
    }
    await page.locator('button[data-action="dream-wake"]').click();
    await page.waitForTimeout(2500);

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

  // The eight pictures of the listing, in its order, as screenshot-N-name.png in 1920x1080 (the dam one with the tablet buttons,
  // from a 960x540 window at twice the scale). The scenes are those of the English set: the lake and lodge, a branch, a log,
  // the winter lake, the family in the lodge, the evening, the dream and a dam.
  test.describe('the set', () => {
    test.use({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

    const leave = async (page: P): Promise<void> => {
      if ((await world(page)).inLodge) await leaveLodgeByHole(page);
    };
    // The lodge stands in the lake, so the water lies between it and the shore the beaver starts on: a point `d` metres from the
    // lodge on that line (`side` metres off it, sideways) is wet when `d` is short of the shore.
    let dir0 = { x: 0, z: 1 };
    const waterNear = async (page: P, d: number, side = 0): Promise<{ x: number; z: number }> => {
      const w = await world(page);
      return { x: w.lodge.x + dir0.x * d - dir0.z * side, z: w.lodge.z + dir0.z * d + dir0.x * side };
    };

    test('set', async ({ page }) => {
      test.setTimeout(900_000);
      await startGame(page, 'coach=0');
      test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
      await page.waitForTimeout(1500);
      await tap(page, 'KeyH');
      const w0 = await world(page);
      const lodge = w0.lodge;
      const k0 = Math.hypot(w0.beaver.x - lodge.x, w0.beaver.z - lodge.z) || 1;
      dir0 = { x: (w0.beaver.x - lodge.x) / k0, z: (w0.beaver.z - lodge.z) / k0 };
      const out = Math.min(14, k0 * 0.5);

      // 1: the lake and the lodge, an adult out on the water in the autumn morning.
      await season(page, 'autumn');
      await time(page, 'morning');
      await walkToPoint(page, await waterNear(page, out, 30), 3, 90_000);
      await page.waitForTimeout(1500);
      await frame(page, 0, 0.12, 10, lodge);
      await take(page, 'screenshot-1-lake-lodge');

      // 2 and 3: a teenager in spring, a branch and a log on the water.
      await menuClick(page, 'button[data-stage="teenager"]');
      await season(page, 'spring');
      await time(page, 'morning');
      await page.waitForTimeout(1500);
      await leave(page);
      const id = await fellNearestTree(page);
      if (id) {
        // Gnaw a branch off the log (Do beside the log), trying again while the tree is still falling.
        for (let i = 0; i < 6 && !(await world(page)).carry; i++) {
          await page.waitForTimeout(1200);
          await tap(page, 'KeyE');
        }
        await walkToPoint(page, await waterNear(page, out - 2, -5), 2, 90_000);
        await page.waitForTimeout(1200);
        await frame(page, 0.7, 0.12, 8, lodge);
        await take(page, 'screenshot-2-branch');
        await tap(page, 'KeyG');
        await page.waitForTimeout(500);
        const at = (await world(page)).logs.find((l: any) => l.id === id);
        if (at) {
          await walkToPoint(page, at, 3, 60_000);
          await dragLog(page, id);
          await walkToPoint(page, await waterNear(page, out - 2, -5), 3, 90_000);
          await page.waitForTimeout(1200);
          await frame(page, Math.PI * 0.75, 0.3, 9);
          await take(page, 'screenshot-3-log');
          await tap(page, 'KeyG');
        }
      }

      // 6: the evening, the lodge beside the beaver.
      await walkToPoint(page, await waterNear(page, out - 2, -5), 2, 60_000);
      await time(page, 'evening');
      await page.waitForTimeout(1500);
      await frame(page, 0.7, 0.2, 7, lodge);
      await take(page, 'screenshot-6-evening');

      // 4: the winter lake.
      await season(page, 'winter');
      await time(page, 'morning');
      await walkToPoint(page, await waterNear(page, out - 2, -5), 3, 90_000);
      await page.waitForTimeout(1500);
      await frame(page, 0, 0.15, 10, lodge);
      await take(page, 'screenshot-4-winter');

      // 5: the family in the lodge, Papa or Mama talking.
      await menuClick(page, 'button[data-stage="baby"]');
      await menuClick(page, 'button[data-stage="teenager"]');
      await page.waitForTimeout(2000);
      const parents = await parentsNow(page);
      if (parents[0]) {
        await walkToPoint(page, parents[0], 2.2, 30_000);
        await tap(page, 'KeyE');
        await page.waitForTimeout(1200);
        await frame(page, 0.8, 0.3, 7, parents[0]);
      }
      await take(page, 'screenshot-5-family');

      // 7: the dream (it covers the test menu's button, so the menu is opened by hand).
      await page.getByRole('button', { name: 'Test menu' }).click();
      await page.locator('button[data-action="dream"]').click();
      await page.waitForTimeout(9000);
      await take(page, 'screenshot-7-dream');
      await page.locator('button[data-action="dream-wake"]').click();
    });

    test.describe('the dam', () => {
      test.use({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
      test('dam', async ({ page }) => {
        test.setTimeout(300_000);
        await startGame(page, 'touch=1&coach=0');
        test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
        await page.waitForTimeout(1500);
        await season(page, 'summer');
        await time(page, 'morning');
        await goToNearestSpot(page);
        for (let i = 0; i < 3; i++) await menuClick(page, 'button[data-action="dam-fill"]');
        await page.waitForTimeout(6000);
        await frame(page, Math.PI / 2, 0.5, 14);
        await take(page, 'screenshot-8-dam');
      });
    });
  });
});
