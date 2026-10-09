import { expect, test, type Page } from '@playwright/test';
import { collectToasts, hasTiles, setSpeed, shot, startGame, toasts, toggleMenu, walkTo, world } from './helpers';
// Time in the real game: the seasons, sleeping in the lodge, the half speed clock in the lodge, night, the full year achievement, and
// the nudges toward a partner. All need the valley tiles (the test lodge), so they skip in CI.

/** The menu's lodge button follows the world (it says "In lodge" on a ?stage=baby start), so one click goes outside. */
async function leaveLodgeByMenu(page: Page): Promise<void> {
  const button = page.locator('button[data-action="lodge"]');
  if ((await world(page)).inLodge) {
    await expect(button).toContainText('In lodge', { timeout: 3000 });
    await button.click();
  }
}

test('the test menu reaches each season and each time of day, and the clock HUD says so', async ({ page }) => {
  test.setTimeout(90_000);
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await toggleMenu(page);
  for (const [season, text] of [['spring', 'Spring, day 1'], ['summer', 'Summer, day 1'], ['autumn', 'Autumn, day 1'], ['winter', 'Winter, day 1']]) {
    await page.locator(`button[data-season="${season}"]`).click();
    await expect(page.locator('#clock-hud')).toContainText(text!);
  }
  for (const [time, text] of [['dawn', 'morning'], ['noon', 'midday'], ['evening', 'evening'], ['night', 'night']]) {
    await page.locator(`button[data-time="${time}"]`).click();
    await expect(page.locator('#clock-hud')).toContainText(text!);
  }
});

test('the clock runs at half speed in the lodge and at full speed outside', async ({ page }) => {
  await startGame(page, 'stage=baby');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const rate = async (): Promise<number> => {
    const a = await world(page);
    await page.waitForTimeout(2500);
    const b = await world(page);
    return (b.clock - a.clock) / (b.time - a.time);
  };
  expect(await rate()).toBeCloseTo(0.5, 1);
  await toggleMenu(page);
  await leaveLodgeByMenu(page);
  expect((await world(page)).inLodge).toBe(false);
  expect(await rate()).toBeCloseTo(1, 1);
});

test('at night the lodge offers sleep and the dream, and outside it offers nothing', async ({ page }) => {
  await startGame(page, 'stage=baby');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await toggleMenu(page);
  await page.locator('button[data-time="night"]').click();
  await expect(page.locator('#clock-hud')).toContainText('night');
  await expect(page.locator('button[data-action="sleep-skip"]')).toBeVisible();
  await expect(page.locator('button[data-action="sleep-dream"]')).toBeVisible();
  await leaveLodgeByMenu(page);
  await expect(page.locator('button[data-action="sleep-skip"]')).toBeHidden();
  await shot(page, 'seasons-night-outside');
});

test('a baby sleeps ahead to a teenager and then to an adult, and leaving home follows', async ({ page }) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 'stage=baby');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await collectToasts(page);
  await expect(page.locator('button[data-action="sleep-grow"]')).toHaveText('Sleep until teenager');
  await page.locator('button[data-action="sleep-grow"]').click();
  await expect(page.locator('#life-hud')).toContainText(/teenager/i, { timeout: 10_000 });
  await expect(page.locator('button[data-action="sleep-grow"]')).toHaveText('Sleep until adult', { timeout: 10_000 });
  await page.locator('button[data-action="sleep-grow"]').click();
  await expect(page.locator('#life-hud')).toContainText(/adult/i, { timeout: 10_000 });
  // Asleep in the lodge when the year ends: the beaver wakes outside, the lodge is a former home, and lone beavers wait.
  await page.waitForFunction(() => (window as any).__game.world().formerHomes.length === 1, null, { polling: 200, timeout: 10_000 });
  const w = await world(page);
  expect(w.lodge).toBeNull();
  expect(w.inLodge).toBe(false);
  expect(w.partners).toHaveLength(3);
  expect(errors).toEqual([]);
});

test('five sleeps to the next season pass a full year, which wins the achievement', async ({ page }) => {
  test.setTimeout(180_000);
  await startGame(page, 'stage=baby');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await collectToasts(page);
  const seasons: string[] = [];
  for (let i = 0; i < 5; i++) {
    const before = (await world(page)).clock;
    await page.locator('button[data-action="sleep-season"]').click();
    await page.waitForFunction((c) => (window as any).__game.world().clock > c + 100, before, { polling: 200, timeout: 10_000 });
    await page.waitForFunction(() => document.getElementById('sleep-dark')!.style.opacity === '0', null, { polling: 200, timeout: 10_000 });
    seasons.push(await page.locator('#clock-hud').innerText());
  }
  // Each sleep ends on the first day of a season, in order.
  expect(seasons.map((s) => s.split(',')[0])).toEqual(['Summer', 'Autumn', 'Winter', 'Spring', 'Summer']);
  const w = await world(page);
  expect(w.achievements).toContain('year');
  expect(await toasts(page)).toContain('A full year achievement: all four seasons');
});

test('a tail in the distance is heard within 150 m, the beaver follows when met, and winter says kits come in spring', async ({ page }) => {
  test.setTimeout(420_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 'stage=teenager');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await collectToasts(page);
  await toggleMenu(page);
  await page.locator('button[data-stage="adult"]').click();
  await page.locator('button[data-speed="20"]').click();
  await toggleMenu(page);
  await page.waitForFunction(() => (window as any).__game.world().partners.length > 0, null, { polling: 100 });
  const w0 = await world(page);
  const home = w0.formerHomes[0];
  const nearest = w0.partners.reduce((a: any, b: any) => (Math.hypot(a.x - home.x, a.z - home.z) < Math.hypot(b.x - home.x, b.z - home.z) ? a : b));
  // Far from every lone beaver nothing is heard.
  expect(await toasts(page)).not.toContain('A tail slaps in the distance. A lone beaver?');
  // Walk until about 130 m short of it.
  await walkTo(page, async () => nearest, 130, 120_000);
  await page.waitForTimeout(500);
  expect(await toasts(page)).toContain('A tail slaps in the distance. A lone beaver?');
  expect((await world(page)).partners.every((p: any) => p.state === 'alone')).toBe(true);
  // On to it: it slaps its tail and follows.
  for (let i = 0; i < 40 && !(await world(page)).partners.some((p: any) => p.state === 'following'); i++) {
    await walkTo(page, async () => (await world(page)).partners.find((p: any) => p.id === nearest.id), 6, 3000);
  }
  expect((await world(page)).partners.some((p: any) => p.state === 'following')).toBe(true);
  expect(await toasts(page)).toContain('A beaver slaps its tail and follows you');
  // Winter arrives with no partner at home: the hint about spring.
  await toggleMenu(page);
  await page.locator('button[data-season="winter"]').click();
  await toggleMenu(page);
  await page.waitForTimeout(500);
  expect(await toasts(page)).toContain('Kits are born on the first day of spring. Find a partner and a lodge');
  await setSpeed(page, 1);
  expect(errors).toEqual([]);
});

test('the message about leaving home is not lost when an achievement comes in the same frame', async ({ page }) => {
  await startGame(page, 'stage=baby');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await collectToasts(page);
  await page.locator('button[data-action="sleep-grow"]').click();
  await expect(page.locator('#life-hud')).toContainText(/teenager/i, { timeout: 10_000 });
  await page.locator('button[data-action="sleep-grow"]').click();
  await page.waitForFunction(() => (window as any).__game.world().formerHomes.length === 1, null, { polling: 200, timeout: 10_000 });
  // The messages show in turn, the achievement first, so wait for the second.
  await expect.poll(() => toasts(page), { timeout: 10_000 }).toContain('Mama and Papa say it is time to start a family of your own');
});
