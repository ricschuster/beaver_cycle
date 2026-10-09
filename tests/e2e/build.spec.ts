import { expect, test } from '@playwright/test';
import { buildLodge, hasTiles, shot, startGame, world } from './helpers';
// The beaver builds a lodge for real: fells trees, drags the logs to the shore, and places them. Needs the valley tiles.

test('the beaver fells trees and builds a whole lodge, and wins Home', async ({ page }) => {
  test.setTimeout(1_500_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page, 'lodge=0');
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  expect((await world(page)).lodge).toBeNull();
  await buildLodge(page);
  const w = await world(page);
  expect(w.lodge.wood).toBeGreaterThanOrEqual(10);
  expect(w.felled.length).toBeGreaterThanOrEqual(5);
  expect(w.achievements).toContain('home');
  await shot(page, 'build-01-lodge');
  expect(errors).toEqual([]);
});
