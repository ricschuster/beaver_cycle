import { expect, test, type Page } from '@playwright/test';
import { DAY_SECONDS } from '../../src/sim/clock';
import { enterLodgeAndRest, hasTiles, leaveLodgeByHole, menuClick, startGame, tap, walkToPoint, world } from './helpers';
// Scent mounds by real play (docs/design/35_scent_mounds_and_visitors.md): with mud in the mouth, on the bank by the whole lodge,
// Mark pats a scent mound. The next morning a visitor comes to it, and standing near it wins Welcome. Needs the valley tiles.

/**
 * Walk toward the lodge from places round it and try to scoop mud, which works on the bank with the water just ahead. Mark it
 * at once when the beaver stands on the bank (walking, not swimming).
 * A rock close by takes the press first, so it is put down. Returns once a mound stands.
 */
async function markByLodge(page: Page): Promise<void> {
  const lodge = (await world(page)).lodge;
  for (const r of [7, 9, 6, 11]) {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      // Walk toward the lodge from outside, so the beaver faces the water when it stops.
      await walkToPoint(page, { x: lodge.x + Math.cos(a) * (r + 6), z: lodge.z + Math.sin(a) * (r + 6) }, 2, 12_000);
      await walkToPoint(page, lodge, r, 8000);
      let w = await world(page);
      if (process.env.PLAYTEST_DEBUG) console.log('try', r, k, w.beaver.mode, JSON.stringify(w.haul), Math.round(Math.hypot(w.beaver.x - lodge.x, w.beaver.z - lodge.z)));
      if (w.beaver.mode !== 'walk') continue;
      if (!w.haul) {
        await tap(page, 'KeyG');
        await page.waitForTimeout(300);
        w = await world(page);
      }
      // A rock close by takes the press first: put it down and try somewhere else.
      if (w.haul?.kind === 'rock') {
        await tap(page, 'KeyG');
        await page.waitForTimeout(300);
        continue;
      }
      if (w.haul?.kind !== 'mud') continue;
      await tap(page, 'KeyE');
      await page.waitForTimeout(300);
      if ((await world(page)).scents.length > 0) return;
    }
  }
}

test('a scent mound is made with mud by the lodge, its visitor comes the next morning, and welcoming it wins Welcome', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  expect((await world(page)).scents).toEqual([]);

  await markByLodge(page);
  let w = await world(page);
  expect(w.scents, 'a mound by the lodge').toHaveLength(1);
  expect(w.haul, 'the mud is used up').toBeNull();
  const mound = w.scents[0];
  expect(Math.hypot(mound.x - w.lodge.x, mound.z - w.lodge.z)).toBeLessThanOrEqual(30);
  expect(w.welcomed).toEqual([]);

  // The visitor comes the morning after: sleep through the night in the lodge, then it is day on the next day.
  await enterLodgeAndRest(page);
  await menuClick(page, 'button[data-time="night"]');
  await menuClick(page, 'button[data-action="sleep"]');
  await menuClick(page, 'button[data-time="noon"]');
  await leaveLodgeByHole(page);
  w = await world(page);
  expect(w.clock, 'it is a later day').toBeGreaterThan(mound.madeAt + 0.5 * DAY_SECONDS);

  // Walk up to the mound and stand by the visitor: Welcome is won.
  await walkToPoint(page, mound, 3, 60_000);
  await page.waitForFunction(() => (window as any).__game.world().welcomed.length === 1, null, { polling: 200, timeout: 30_000 });
  w = await world(page);
  expect(w.welcomed).toEqual([mound.id]);
  expect(w.achievements).toContain('welcome');
  expect(errors).toEqual([]);
});
