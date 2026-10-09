import { expect, test, type Page } from '@playwright/test';
import { doorPoint } from '../../src/sim/lodge';
import { hasTiles, menuClick, parentsNow, shot, startGame, walkToPoint, world } from './helpers';
// Growing up in the real game (docs/design/22_life_stages.md, 23_leaving_and_next_baby.md): the teenager's speed, the sleep to the
// next stage, leaving home in sleep, the old parents, and the coats of a new baby. Needs the valley tiles.

const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Hold the walk to a point and measure the speed in simulated metres per second, the best of a few samples in a row. */
async function measureSpeed(page: Page, to: { x: number; z: number }): Promise<number> {
  const samples: { t: number; x: number; z: number }[] = [];
  let done = false;
  const walking = walkToPoint(page, to, 2, 12_000).then(() => {
    done = true;
  });
  while (!done) {
    const w = await world(page);
    samples.push({ t: w.time, x: w.beaver.x, z: w.beaver.z });
    await page.waitForTimeout(150);
  }
  await walking;
  let best = 0;
  for (let i = 0; i + 4 < samples.length; i++) {
    const a = samples[i]!;
    const b = samples[i + 4]!;
    if (b.t > a.t) best = Math.max(best, dist(a, b) / (b.t - a.t));
  }
  return best;
}

test('a teenager walks at 0.85 of the adult speed', async ({ page }) => {
  test.setTimeout(240_000);
  await startGame(page, 'stage=teenager');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const lodge = (await world(page)).lodge;
  // Inland, away from the door and the water.
  const to = doorPoint(lodge, -60);
  const teen = await measureSpeed(page, to);
  await startGame(page, 'stage=adult');
  const adult = await measureSpeed(page, to);
  console.log('speeds', JSON.stringify({ teen, adult, ratio: teen / adult }));
  expect(adult).toBeGreaterThan(8);
  expect(teen / adult).toBeGreaterThan(0.75);
  expect(teen / adult).toBeLessThan(0.95);
});

test('sleeping to the next stage wakes at dawn: baby to teenager, then out of the lodge as an adult', async ({ page }) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 'stage=baby');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  expect((await world(page)).inLodge).toBe(true);
  // A baby on its nest is offered the sleep to the next stage.
  await expect(page.locator('button[data-action="sleep-grow"]')).toContainText('teenager');
  await page.locator('button[data-action="sleep-grow"]').click();
  await page.waitForFunction(() => (window as any).__game.world().bornAt + 30 * 480 <= (window as any).__game.world().clock, null, { polling: 200, timeout: 20_000 });
  let w = await world(page);
  // Woken at dawn: the clock is only a moment past a day's start (it has run on since the jump).
  expect(w.clock % 480).toBeLessThan(5);
  await expect(page.locator('#life-hud')).toContainText(/teenager/i);
  expect(w.inLodge).toBe(true);
  expect(w.generation).toBe(0);

  // The last sleep of the teenager year ends in the grown beaver leaving home, put out at the door.
  await page.waitForTimeout(2500);
  await expect(page.locator('button[data-action="sleep-grow"]')).toContainText('adult');
  const home = w.lodge;
  await page.locator('button[data-action="sleep-grow"]').click();
  await page.waitForFunction(() => (window as any).__game.world().formerHomes.length === 1, null, { polling: 200, timeout: 20_000 });
  await page.waitForTimeout(2500);
  w = await world(page);
  expect(w.lodge).toBeNull();
  expect(w.inLodge).toBe(false);
  expect(w.formerHomes[0]).toMatchObject({ x: home.x, z: home.z });
  expect(dist(w.beaver, home)).toBeGreaterThan(2.3);
  expect(dist(w.beaver, home)).toBeLessThan(6);
  expect(w.beaver.mode).not.toBe('dive');
  expect(w.partners).toHaveLength(3);
  await expect(page.locator('#life-hud')).toContainText(/adult/i);
  await shot(page, 'family-04-put-out-at-the-door');
  expect(errors).toEqual([]);
});

// Known bug: sleeping through the whole teenager year also wins "A full year" in the same frame, and that toast replaces the
// family's message, so the player never reads that it is time to start a family. Found by the test above, which saw only
// ["A full year achievement: all four seasons"] on the toast. main.ts shows both in one frame, and `toast.show` keeps one text.
test.fixme('the message that it is time to start a family is not lost under the full year toast', async ({ page }) => {
  await startGame(page, 'stage=baby');
  await page.evaluate(() => {
    (window as any).__toasts = [];
    new MutationObserver(() => (window as any).__toasts.push(document.getElementById('toast')?.textContent ?? '')).observe(document.getElementById('toast')!, { childList: true, characterData: true, subtree: true });
  });
  for (let i = 0; i < 2; i++) {
    await page.waitForTimeout(2500);
    await page.locator('button[data-action="sleep-grow"]').click();
  }
  await page.waitForFunction(() => (window as any).__game.world().formerHomes.length === 1, null, { polling: 200, timeout: 20_000 });
  await page.waitForTimeout(1000);
  const toasts: string[] = await page.evaluate(() => (window as any).__toasts);
  expect(toasts.some((t) => t.includes('time to start a family of your own'))).toBe(true);
});

test('the old parents stay at the former home, in the coats they had', async ({ page }) => {
  test.setTimeout(120_000);
  await startGame(page, 'stage=teenager');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const before = await world(page);
  const coats = before.parentCoats;
  await menuClick(page, 'button[data-stage="adult"]');
  await page.waitForFunction(() => (window as any).__game.world().formerHomes.length === 1, null, { polling: 100, timeout: 10_000 });
  const w = await world(page);
  expect(w.formerHomes[0].parents).toEqual(coats);
  // Not at a lodge, so none of the player's own parents; the old ones swim about the pond of the former home.
  const parents = await parentsNow(page);
  expect(parents).toHaveLength(2);
  const home = w.formerHomes[0];
  expect(parents.map((p) => p.id).sort()).toEqual([`mama@${Math.round(home.x)},${Math.round(home.z)}`, `papa@${Math.round(home.x)},${Math.round(home.z)}`]);
  expect(parents.map((p) => p.coat)).toEqual(coats);
  for (const p of parents) {
    expect(p.mode).toBe('swim');
    expect(dist(p, home)).toBeLessThan(28);
  }
  // They stay put as the day goes by: later they are still in that pond.
  await menuClick(page, 'button[data-time="evening"]');
  for (const p of await parentsNow(page)) expect(dist(p, home)).toBeLessThan(28);
  await shot(page, 'family-05-old-parents');
});

test('a new baby takes the coat of one of its parents, in a slightly different shade', async ({ page }) => {
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const parents = (await world(page)).parentCoats as { coat: number; shade: number }[];
  for (let i = 0; i < 3; i++) {
    await menuClick(page, 'button[data-action="new-life"]');
    const w = await world(page);
    const from = parents.find((p) => p.coat === w.coat.coat);
    expect(from, `the coat ${w.coat.coat} is one of the parents'`).toBeTruthy();
    expect(Math.abs(w.coat.shade - from!.shade)).toBeLessThanOrEqual(0.5);
    expect(w.generation).toBe(i + 1);
    // The coat follows the time of birth, so let the clock move on before the next one.
    await menuClick(page, 'button[data-time="evening"]');
    await menuClick(page, 'button[data-season="summer"]');
  }
});
