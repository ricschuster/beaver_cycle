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
    await hide.evaluate((el) => el.remove());
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
      await walkToPoint(page, tree, 2.2, 40_000);
      await page.waitForTimeout(500);
      await take(page, 'tree');
      await tap(page, 'KeyE');
      await page.waitForFunction(() => (window as any).__game.world().chop !== null, null, { polling: 100, timeout: 5000 }).catch(() => undefined);
      await page.waitForTimeout(1500);
      await take(page, 'gnaw');
    }
    const id = await fellNearestTree(page);
    if (id) {
      await page.waitForTimeout(800);
      await take(page, 'log');
      await dragLog(page, id);
      await page.waitForTimeout(500);
      await take(page, 'drag');
    }

    const spot = await goToNearestSpot(page);
    await page.waitForTimeout(1500);
    await take(page, 'ring');
    void spot;
    await page.getByRole('button', { name: 'Test menu' }).click();
    await page.locator('button[data-action="dam-fill"]').click();
    await page.getByRole('button', { name: 'Test menu' }).click();
    await page.waitForTimeout(4000);
    await take(page, 'pond');
    console.log('dams', (await world(page)).dams.length);
  });
});
