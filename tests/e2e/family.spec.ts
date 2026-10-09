import { expect, test, type Page } from '@playwright/test';
import { doorPoint } from '../../src/sim/lodge';
import { hasTiles, leaveLodgeByHole, menuClick, parentsNow, shot, startGame, tap, walkToPoint, world } from './helpers';
// The family and the life stages in the real game (docs/design/22_life_stages.md and 23_leaving_and_next_baby.md):
// Mama and Papa, what a baby and a teenager may do, leaving home, and a second life. Needs the valley tiles.

const dist = (a: { x: number; z: number }, b: { x: number; z: number }): number => Math.hypot(a.x - b.x, a.z - b.z);

test.describe('a baby at home', () => {
  test('lies on its nest with Mama and Papa on theirs, then swims out and finds them in the pond', async ({ page }) => {
    test.setTimeout(180_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await startGame(page, 'stage=baby');
    test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
    let w = await world(page);
    expect(w.inLodge).toBe(true);
    let parents = await parentsNow(page);
    expect(parents.map((p) => p.id).sort()).toEqual(['mama', 'papa']);
    for (const p of parents) {
      expect(p.inside).toBe(true);
      expect(dist(p, w.lodge)).toBeLessThan(6);
    }
    expect(parents.map((p) => p.coat)).toEqual(w.parentCoats);
    await shot(page, 'family-01-baby-inside');

    await leaveLodgeByHole(page);
    await page.waitForTimeout(2500);
    w = await world(page);
    expect(['swim', 'dive']).toContain(w.beaver.mode);
    parents = await parentsNow(page);
    expect(parents).toHaveLength(2);
    for (const p of parents) {
      expect(p.inside).toBe(false);
      expect(p.mode).toBe('swim');
      // In the pond, outside the dome and inside the farthest part.
      expect(dist(p, w.lodge)).toBeGreaterThan(2);
      expect(dist(p, w.lodge)).toBeLessThan(28);
    }
    await shot(page, 'family-02-baby-in-pond');
    expect(errors).toEqual([]);
  });

  test('keeps to the water and to its range: Mama calls it back', async ({ page }) => {
    test.setTimeout(240_000);
    await startGame(page, 'stage=baby');
    test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
    await leaveLodgeByHole(page);
    const lodge = (await world(page)).lodge;
    // Out over the water in the direction of the door (the deepest water), further than the range of 60 m.
    await walkToPoint(page, doorPoint(lodge, 120), 1, 60_000);
    const w = await world(page);
    console.log('baby range', Math.round(dist(w.beaver, lodge)), w.beaver.mode);
    expect(dist(w.beaver, lodge)).toBeLessThanOrEqual(60.01);
    expect(['swim', 'dive']).toContain(w.beaver.mode);
    await expect(page.locator('#toast')).toContainText('Mama calls you back');
    await shot(page, 'family-03-called-back');
  });

  test('cannot go ashore: a walk inland stops at the shore, still swimming', async ({ page }) => {
    test.setTimeout(240_000);
    await startGame(page, 'stage=baby');
    test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
    await leaveLodgeByHole(page);
    const lodge = (await world(page)).lodge;
    // The land is behind the lodge, away from the door.
    await walkToPoint(page, doorPoint(lodge, -45), 1, 30_000);
    const w = await world(page);
    expect(['swim', 'dive']).toContain(w.beaver.mode);
    expect(dist(w.beaver, lodge)).toBeLessThan(45);
  });

  test('cannot gnaw, grab or build', async ({ page }) => {
    await startGame(page, 'stage=baby');
    test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
    await leaveLodgeByHole(page);
    for (const key of ['KeyE', 'KeyG', 'KeyB']) await tap(page, key);
    await page.waitForTimeout(500);
    const w = await world(page);
    expect(w.chop).toBeNull();
    expect(w.drag).toBeNull();
    expect(w.carry).toBeNull();
    expect(w.felled).toEqual([]);
  });
});
