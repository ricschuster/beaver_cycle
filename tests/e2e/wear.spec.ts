import { expect, test, type Page } from '@playwright/test';
import { SOLID_RADIUS, lodgeCondition } from '../../src/sim/lodge';
import { storeCondition } from '../../src/sim/food';
import { damCondition } from '../../src/sim/dam';
import { dragLog, enterLodgeAndRest, fellNearestTree, hasTiles, hudText, shot, startGame, tap, walkTo, walkToPoint, walkToStore, world } from './helpers';
// Wear, repair, and the homes the family has left, in the real valley (docs/design/15_build_and_repair.md). `?age=N` starts the
// test lodge and store N game days old: the lodge is worn at 40 days and broken at 68, the store at 20 and 34, a dam the test
// menu finishes at 10 and 17. Every test needs the tiles built locally, so CI skips them.

async function start(page: Page, query: string): Promise<void> {
  // The test lodge is sometimes missing at the start, more often while the machine is busy (see `startGame`): try again.
  for (let attempt = 0; ; attempt++) {
    try {
      await startGame(page, query);
      break;
    } catch (e) {
      if (attempt >= 2) throw e;
    }
  }
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
}

const openMenu = (page: Page) => page.getByRole('button', { name: 'Test menu' }).click();

test.describe('a worn lodge and store', () => {
  test('a worn store says so at its door, and holds fewer pieces', async ({ page }) => {
    test.setTimeout(120_000);
    // 30 days old: the lodge is still good (62%), the store worn (25%).
    await start(page, 'age=30');
    const w0 = await world(page);
    expect(lodgeCondition(w0.lodge, w0.clock)).toBeCloseTo(0.625, 2);
    expect(storeCondition(w0.storeWear, w0.clock)).toBeCloseTo(0.25, 2);
    await walkToStore(page);
    const text = await hudText(page);
    expect(text).toContain('store worn 25%');
    expect(text).toContain('needs 8 wood');
    expect(text).toContain('store 0 of 24');
    // The good lodge asks for nothing.
    expect(text).not.toContain('lodge worn');
    await shot(page, 'wear-01-worn-store');
  });

  test('a store that is broken holds nothing and has to be rebuilt, and so does the lodge, which cannot be entered', async ({ page }) => {
    test.setTimeout(180_000);
    // 70 days old: the lodge is broken (12%), and the store is long broken.
    await start(page, 'age=70');
    const w0 = await world(page);
    expect(lodgeCondition(w0.lodge, w0.clock)).toBeLessThan(0.15);
    await walkToStore(page);
    const text = await hudText(page);
    // Both are in reach at the store: the worse one (the store) is the one named, and the lodge is said to need wood too.
    expect(text).toContain('store broken, needs 4 wood');
    expect(text).toContain('the lodge needs wood too');
    expect(text).toContain('store 0 of 0');
    // A diver at the entrance of a broken lodge does not go in.
    await walkToPoint(page, { x: w0.lodge.x + Math.sin(w0.lodge.door) * 7, z: w0.lodge.z + Math.cos(w0.lodge.door) * 7 }, 1.5, 40_000);
    await walkTo(page, async () => w0.lodge, 1, 6000, ['Space']);
    const w = await world(page);
    expect(w.inLodge).toBe(false);
    expect(Math.hypot(w.beaver.x - w0.lodge.x, w.beaver.z - w0.lodge.z)).toBeGreaterThanOrEqual(SOLID_RADIUS - 0.05);
    await shot(page, 'wear-02-broken-lodge');
  });

  test('a good lodge, by contrast, takes the diver in', async ({ page }) => {
    test.setTimeout(120_000);
    await start(page, 'age=30');
    await enterLodgeAndRest(page);
    expect((await world(page)).inLodge).toBe(true);
  });

  test('the store lets go of the pieces its wear takes away', async ({ page }) => {
    test.setTimeout(420_000);
    // A new store holds 40 places. Put a branch in the last place, then let thirty-three days go by: the store is worn and holds 24.
    await start(page, 'age=0');
    const id = await fellNearestTree(page);
    expect(id).not.toBeNull();
    // Gnaw a branch off the log lying where the tree fell: stand at it first, the strip reach is 2 m and the tree falls any way.
    const log = (await world(page)).logs.find((l: any) => l.id === id);
    expect(log).toBeTruthy();
    await walkToPoint(page, { x: log.x - Math.sin(log.heading) * log.length * 0.25, z: log.z - Math.cos(log.heading) * log.length * 0.25 }, 1.2, 20_000);
    await page.waitForTimeout(300);
    await tap(page, 'KeyE');
    await page.waitForFunction(() => (window as any).__game.world().carry === 'branch', null, { polling: 100, timeout: 8000 });
    await walkToStore(page);
    expect(await hudText(page)).toContain('store 0 of 40');
    await tap(page, 'KeyE');
    await page.waitForFunction(() => (window as any).__game.world().stashOpen, null, { polling: 100, timeout: 5000 });
    await page.locator('button[data-slot="39"]').click();
    await page.waitForFunction(() => (window as any).__game.world().store[39] === 'branch', null, { polling: 100, timeout: 5000 });
    await page.locator('#stash-close').click();
    await page.waitForFunction(() => !(window as any).__game.world().stashOpen, null, { polling: 100, timeout: 5000 });
    await shot(page, 'wear-03-stash-full');
    // The menu jumps to the first day with winter's full look, thirty-three days in (SEASON_FULL_DAY).
    await openMenu(page);
    await page.locator('button[data-season="winter"]').click();
    await openMenu(page);
    await page.waitForFunction(() => (window as any).__game.world().store[39] === null, null, { polling: 100, timeout: 5000 });
    const w = await world(page);
    expect(w.store.filter((f: unknown) => f !== null)).toHaveLength(0);
    expect(storeCondition(w.storeWear, w.clock)).toBeLessThan(0.5);
    expect(await hudText(page)).toContain('store 0 of 24');
  });
});

test.describe('mending', () => {
  test('logs go to the store first, which is worse off, until it is new, and that wins Handy beaver', async ({ page }) => {
    test.setTimeout(900_000);
    // 41 days old: the lodge is just worn (49%) and the store broken (0%, four wood to rebuild). Both are in reach at the store.
    await start(page, 'age=41');
    const w0 = await world(page);
    expect(lodgeCondition(w0.lodge, w0.clock)).toBeCloseTo(0.4875, 2);
    expect(w0.achievements).not.toContain('handy');
    await walkToStore(page);
    expect(await hudText(page)).toContain('store broken, needs 4 wood (a long log is 2), the lodge needs wood too');
    for (let trip = 0; trip < 6; trip++) {
      let w = await world(page);
      if (storeCondition(w.storeWear, w.clock) > 0.99) break;
      const id = await fellNearestTree(page);
      expect(id).not.toBeNull();
      await dragLog(page, id!);
      await walkToStore(page);
      expect(await hudText(page)).toContain('press Mend to add it');
      await tap(page, 'KeyE');
      await page.waitForFunction((i) => (window as any).__game.world().drag === null && !(window as any).__game.world().logs.some((l: any) => l.id === i), id, { polling: 100, timeout: 5000 });
    }
    const w = await world(page);
    expect(storeCondition(w.storeWear, w.clock)).toBeGreaterThan(0.99);
    // The lodge was the better off of the two, so it has not been touched.
    expect(lodgeCondition(w.lodge, w.clock)).toBeLessThan(0.5);
    expect(w.mended).toBeGreaterThanOrEqual(1);
    expect(w.achievements).toContain('handy');
    await shot(page, 'wear-04-mended');
  });
});

test.describe('dams', () => {
  /** Go to the nearest dam spot with the test menu, finish a dam there, and read the dam, its pond, and the line at the top. */
  async function damAt(page: Page): Promise<{ dam: any; clock: number; crest: number; text: string }> {
    await openMenu(page);
    await page.locator('button[data-action="dam-go"]').click();
    await page.waitForFunction(
      () => {
        const w = (window as any).__game.world();
        return w.spots.some((s: any) => Math.hypot(s.bed.x - w.beaver.x, s.bed.z - w.beaver.z) < 15);
      },
      null,
      { polling: 200, timeout: 60_000 },
    );
    await page.locator('button[data-action="dam-fill"]').click();
    await openMenu(page);
    await page.waitForTimeout(1500);
    const w = await world(page);
    return { dam: w.dams[0], clock: w.clock, crest: Math.max(0, ...Object.values<number>(w.pondCrests)), text: await hudText(page) };
  }

  test('a dam sags as it wears: the pond falls with it, and a broken dam says it has to be built again', async ({ context }) => {
    test.setTimeout(300_000);
    const crests: Record<string, number> = {};
    const levels: Record<string, number> = {};
    for (const age of [0, 12, 20]) {
      // A page of its own for each age: a second start in one page often comes up without the test lodge.
      const page = await context.newPage();
      await start(page, `age=${age}`);
      const d = await damAt(page);
      crests[age] = d.crest;
      levels[age] = damCondition(d.dam, d.clock);
      if (age === 12) expect(d.text).toMatch(/dam worn 40%, needs \d+ units/);
      if (age === 20) {
        expect(d.text).toContain('dam broken, build it again');
        await shot(page, 'wear-05-broken-dam');
      }
      await page.close();
    }
    expect(levels[0]).toBeCloseTo(1, 1);
    expect(levels[12]).toBeCloseTo(0.4, 1);
    expect(levels[20]).toBeLessThan(0.15);
    expect(crests[0]).toBeGreaterThan(0);
    expect(crests[12]).toBeLessThan(crests[0]!);
    expect(crests[20]).toBeLessThan(crests[12]!);
  });

  test('a log put on a worn dam mends it', async ({ page }) => {
    test.setTimeout(420_000);
    await start(page, 'age=12');
    const before = await damAt(page);
    const level0 = damCondition(before.dam, before.clock);
    const id = await fellNearestTree(page, 150);
    expect(id).not.toBeNull();
    await dragLog(page, id!);
    // Back to the spot the dam stands at.
    const spot = (await world(page)).spots.find((s: any) => s.id === before.dam.spot);
    await walkToPoint(page, spot.bed, 2, 60_000);
    expect(await hudText(page)).toContain('press Mend to add it');
    await tap(page, 'KeyE');
    await page.waitForFunction((i) => !(window as any).__game.world().logs.some((l: any) => l.id === i), id, { polling: 100, timeout: 5000 });
    const w = await world(page);
    expect(damCondition(w.dams.find((d: any) => d.spot === spot.id), w.clock)).toBeGreaterThan(level0 + 0.05);
  });
});

test.describe('the home the family has left', () => {
  test('stays solid, is without a store, does not wear, and its parents stay in the pond', async ({ page }) => {
    test.setTimeout(240_000);
    await start(page, 'stage=teenager');
    const w0 = await world(page);
    const lodge0 = w0.lodge;
    await openMenu(page);
    await page.locator('button[data-stage="adult"]').click();
    await page.waitForTimeout(800);
    let w = await world(page);
    expect(w.lodge).toBeNull();
    expect(w.formerHomes).toHaveLength(1);
    // Nothing of the store goes with it, and there is no repair line at its door.
    expect(w.storeWear).toBeUndefined();
    expect(w.store.every((f: unknown) => f === null)).toBe(true);
    const home = w.formerHomes[0];
    expect(home.x).toBeCloseTo(lodge0.x, 3);
    await openMenu(page);
    await walkToPoint(page, { x: home.x + Math.sin(home.door) * 4.4, z: home.z + Math.cos(home.door) * 4.4 }, 0.8, 40_000);
    await page.waitForTimeout(300);
    const text = await hudText(page);
    expect(text).not.toMatch(/store \d+ of/);
    expect(text).not.toMatch(/worn|broken|Build to add/);
    // It is solid: pushing at the middle of it from the land side stops at the wall.
    await walkToPoint(page, { x: home.x - Math.sin(home.door) * 7, z: home.z - Math.cos(home.door) * 7 }, 1.5, 40_000);
    let nearest = Infinity;
    await walkTo(page, async () => home, 0.2, 5000).catch(() => false);
    for (let i = 0; i < 5; i++) {
      w = await world(page);
      nearest = Math.min(nearest, Math.hypot(w.beaver.x - home.x, w.beaver.z - home.z));
      await page.waitForTimeout(100);
    }
    expect(nearest).toBeGreaterThanOrEqual(SOLID_RADIUS - 0.05);
    // Mama and Papa stay: two beavers swimming in the pond near the old lodge, in the coats the family had.
    const parents = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__game.formerParents())));
    expect(parents).toHaveLength(2);
    for (const p of parents) {
      expect(Math.hypot(p.x - home.x, p.z - home.z)).toBeLessThan(40);
      expect(p.inside).toBeFalsy();
    }
    expect(parents.map((p: any) => p.coat)).toEqual(home.parents);
    // The parents keep it up (Q63), so it does not wear with the game clock, and a season going by changes nothing.
    const level = (x: any): number => lodgeCondition(x.formerHomes[0], x.clock);
    expect(level(await world(page))).toBe(1);
    await openMenu(page);
    await page.locator('button[data-season="winter"]').click();
    await openMenu(page);
    expect(level(await world(page))).toBe(1);
    await shot(page, 'wear-06-former-home');
  });

  test('leaving home while asleep puts the beaver out at the door', async ({ page }) => {
    test.setTimeout(240_000);
    await start(page, 'stage=teenager');
    await enterLodgeAndRest(page);
    let w = await world(page);
    expect(w.inLodge).toBe(true);
    const lodge = w.lodge;
    // Sleep until growing up, the long sleep a teenager is offered.
    await page.locator('button[data-action="sleep-grow"]').click();
    await page.waitForFunction(() => (window as any).__game.world().formerHomes.length === 1, null, { polling: 200, timeout: 30_000 });
    await page.waitForTimeout(3000);
    w = await world(page);
    expect(w.lodge).toBeNull();
    expect(w.inLodge).toBe(false);
    expect(w.partners.length).toBeGreaterThan(0);
    const d = Math.hypot(w.beaver.x - lodge.x, w.beaver.z - lodge.z);
    expect(d).toBeGreaterThanOrEqual(SOLID_RADIUS - 0.05);
    expect(d).toBeLessThan(6);
    expect(w.beaver.mode).not.toBe('dive');
    await shot(page, 'wear-07-woke-outside');
  });
});
