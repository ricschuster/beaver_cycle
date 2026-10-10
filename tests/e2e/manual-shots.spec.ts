/* eslint-disable @typescript-eslint/no-explicit-any */
import { test } from '@playwright/test';
import { dragLog, fellNearestTree, goToNearestSpot, hasTiles, startGame, tap, walkToPoint, world } from './helpers';
// Takes the pictures for the manual (public/manual/*.jpg) from the real valley, in a tablet sized window. It does nothing
// unless MANUAL_SHOTS names a folder, so CI and the other playtests skip it. Run it again when the look of the game changes:
//   MANUAL_SHOTS=public/manual npx playwright test tests/e2e/manual-shots.spec.ts

const DIR = process.env.MANUAL_SHOTS;

test.describe('pictures for the manual', () => {
  test.skip(!DIR, 'set MANUAL_SHOTS to a folder to take them');
  test.use({ viewport: { width: 1024, height: 600 } });

  // The test menu and the debug button are the author's, not for the manual.
  const take = async (page: import('@playwright/test').Page, name: string): Promise<void> => {
    const hide = await page.addStyleTag({ content: 'button[aria-label="Test menu"]{visibility:hidden !important}' });
    await page.screenshot({ path: `${DIR}/${name}.jpg`, type: 'jpeg', quality: 80 });
    await hide.evaluate((el) => (el as Element).remove());
  };

  // Place the camera for a picture: `side` radians round from straight behind the beaver, tilted down by `pitch`, `dist` metres out.
  // The default view looks past the beaver at whatever it stands in front of, so a tree or a log would hide it.
  // With `toward` the camera is turned from the line to that point (a tree or a log) instead of from the way the beaver faces,
  // which is only where it last walked. A quarter turn then puts the beaver and the thing side by side.
  const frame = async (page: import('@playwright/test').Page, side: number, pitch: number, dist: number, toward?: { x: number; z: number }): Promise<void> => {
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
    await page.waitForTimeout(600);
  };

  test('the screen, a tree, a log, a ring and a pond', async ({ page }) => {
    test.setTimeout(300_000);
    await startGame(page, 'touch=1&coach=0');
    test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
    await page.waitForTimeout(1500);
    await take(page, 'screen');

    const tree = await page.evaluate(() => {
      const g = (window as any).__game;
      const b = g.world().beaver;
      return g.nearestTree(b.x, b.z, 120);
    });
    if (tree) {
      // The trunk is about 2 m across at the foot, so a beaver at the tree's centre is hidden inside it: this picture is taken
      // from a little short of it. (There is no picture of the gnawing itself for the same reason: the beaver ends up at the trunk.)
      await walkToPoint(page, tree, 3.4, 40_000);
      await page.waitForTimeout(500);
      await frame(page, 0, 0.3, 8, tree);
      await take(page, 'tree');
    }
    const id = await fellNearestTree(page);
    if (id) {
      const logAt = (await world(page)).logs.find((l: any) => l.id === id);
      await page.waitForTimeout(800);
      await frame(page, 0.9, 0.3, 9, logAt);
      await take(page, 'log');
      await dragLog(page, id);
      await frame(page, Math.PI / 2, 0.45, 9);
      await take(page, 'drag');
    }

    const spot = await goToNearestSpot(page);
    await frame(page, Math.PI / 2, 0.5, 8);
    await take(page, 'ring');
    void spot;
    await page.getByRole('button', { name: 'Test menu' }).click();
    await page.locator('button[data-action="dam-fill"]').click();
    await page.getByRole('button', { name: 'Test menu' }).click();
    await page.waitForTimeout(4000);
    await frame(page, Math.PI / 2, 0.5, 8);
    await take(page, 'pond');
    console.log('dams', (await world(page)).dams.length);
  });
});
