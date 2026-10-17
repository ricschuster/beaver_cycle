import { expect, test } from '@playwright/test';

// The save (docs/design/26_saving.md): play, leave, come back and continue; or start over. ?save=1 turns the save on in an automated browser.
const URL = '/?save=1&shadows=0&welcome=0&coach=0';

test('a saved game is offered and continued, and New game starts over', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL);
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  // A first start has no saved game, so no card.
  await expect(page.locator('#slot-card')).toHaveCount(0);
  const start = await page.evaluate(() => (window as any).__game.world().beaver);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  // A tablet gives a page that is put away a pagehide, which saves.
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('beaver-cycle.save')!).world);
  expect(Math.hypot(saved.beaver.x - start.x, saved.beaver.z - start.z)).toBeGreaterThan(2);

  await page.reload();
  await expect(page.locator('#slot-card')).toBeVisible();
  await page.locator('[data-action="slot-continue"]').click();
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  const back = await page.evaluate(() => (window as any).__game.world());
  expect(Math.hypot(back.beaver.x - saved.beaver.x, back.beaver.z - saved.beaver.z)).toBeLessThan(3);
  expect(back.clock).toBeGreaterThanOrEqual(saved.clock);

  // Delete asks twice; slot 2 then takes a named new game while slot 1 stays.
  await page.reload();
  await page.locator('[data-slot="2"] [data-action="slot-new"]').click();
  await page.locator('[data-action="slot-name"]').fill('Maple');
  await page.locator('[data-action="slot-start"]').click();
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  const fresh = await page.evaluate(() => (window as any).__game.world().beaver);
  expect(Math.hypot(fresh.x - start.x, fresh.z - start.z)).toBeLessThan(3);
  expect(errors).toEqual([]);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('beaver-cycle.save')).sort());
  expect(keys).toEqual(['beaver-cycle.save', 'beaver-cycle.save.2']);

  // The start screen lists both, and deleting slot 2 takes two presses.
  await page.reload();
  await expect(page.locator('[data-slot="2"]')).toContainText('Maple');
  await page.locator('[data-slot="2"] [data-action="slot-delete"]').click();
  await page.locator('[data-action="slot-delete-yes"]').click();
  await expect(page.locator('[data-slot="2"]')).toContainText('Empty');
  expect(await page.evaluate(() => localStorage.getItem('beaver-cycle.save.2'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('beaver-cycle.save'))).not.toBeNull();
});

test('an automated run without ?save=1 neither reads nor writes the save', async ({ page }) => {
  await page.goto('/?shadows=0');
  await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  expect(await page.evaluate(() => localStorage.getItem('beaver-cycle.save'))).toBeNull();
});
