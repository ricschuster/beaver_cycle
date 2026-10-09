// Shared helpers for the playtests in tests/e2e: drive the real game the way a player does, with the keys and the test menu,
// and read its state through the read only `window.__game` hook (src/main.ts).
import { expect, type Page } from '@playwright/test';
import { DOOR_DISTANCE, NEST, doorPoint } from '../../src/sim/lodge';

export type Point = { x: number; z: number };
/* eslint-disable @typescript-eslint/no-explicit-any */
export const world = (page: Page): Promise<any> => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__game.world())));

/**
 * Start the game with these query parameters and wait until the hook is there. `shadows=0` always: the browser draws in software.
 * On the real valley the start normally has a whole lodge, but about every other start comes up without it (the site is looked
 * for before the ground has loaded, it seems), so a start without one is reloaded, unless the test asked for none (`lodge=0`).
 */
export async function startGame(page: Page, query = ''): Promise<void> {
  const wantsLodge = !query.split('&').includes('lodge=0');
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto(`/?shadows=0${query ? `&${query}` : ''}`);
    await page.waitForFunction(() => '__game' in window, null, { polling: 100 });
    const tiles = await page.evaluate(() => (window as any).__game.stats() !== null);
    if (!wantsLodge || !tiles || (await world(page)).lodge) return;
  }
  throw new Error('the game never started with a lodge');
}

/** True where the real valley tiles are built (they are not in CI). */
export const hasTiles = (page: Page): Promise<boolean> => page.evaluate(() => (window as any).__game.stats() !== null);

const SHOTS = process.env.PLAYTEST_SHOTS;
/** Keep a screenshot when PLAYTEST_SHOTS names a folder. */
export async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

export async function setSpeed(page: Page, speed: number): Promise<void> {
  const menu = page.locator('button[data-speed="1"]');
  const open = await menu.isVisible();
  if (!open) await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator(`button[data-speed="${speed}"]`).click();
  await page.getByRole('button', { name: 'Test menu' }).click();
}

/** Press and release a key once, which the game sees as one press of that button. */
export async function tap(page: Page, code: string): Promise<void> {
  await page.keyboard.down(code);
  await page.waitForTimeout(80);
  await page.keyboard.up(code);
}

const KEYS = [
  { codes: ['KeyW'], m: { x: 0, z: 1 } }, { codes: ['KeyW', 'KeyA'], m: { x: 1, z: 1 } }, { codes: ['KeyA'], m: { x: 1, z: 0 } },
  { codes: ['KeyS', 'KeyA'], m: { x: 1, z: -1 } }, { codes: ['KeyS'], m: { x: 0, z: -1 } }, { codes: ['KeyS', 'KeyD'], m: { x: -1, z: -1 } },
  { codes: ['KeyD'], m: { x: -1, z: 0 } }, { codes: ['KeyW', 'KeyD'], m: { x: -1, z: 1 } },
];

/** Hold the keys that head best toward a point until the beaver is within `near` metres of it, or the time is up. */
export async function walkTo(page: Page, target: () => Promise<Point>, near: number, maxMs: number, hold: string[] = []): Promise<boolean> {
  let held: string[] = [];
  for (const c of hold) await page.keyboard.down(c);
  const deadline = Date.now() + maxMs;
  try {
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => {
        const g = (window as any).__game;
        return { b: g.world().beaver as { x: number; z: number }, yaw: g.view().yaw as number };
      });
      const t = await target();
      const dx = t.x - s.b.x;
      const dz = t.z - s.b.z;
      if (Math.hypot(dx, dz) <= near) return true;
      // relativeToView in src/actions/actions.ts, written out.
      const a = s.yaw - Math.PI;
      const best = KEYS.map((k) => ({ k, w: { x: k.m.x * Math.cos(a) + k.m.z * Math.sin(a), z: -k.m.x * Math.sin(a) + k.m.z * Math.cos(a) } })).sort(
        (p, q) => q.w.x * dx + q.w.z * dz - (p.w.x * dx + p.w.z * dz),
      )[0]!.k;
      for (const c of held) if (!best.codes.includes(c)) await page.keyboard.up(c);
      for (const c of best.codes) if (!held.includes(c)) await page.keyboard.down(c);
      held = best.codes;
      await page.waitForTimeout(60);
    }
    return false;
  } finally {
    for (const c of [...held, ...hold]) await page.keyboard.up(c);
  }
}

export const walkToPoint = (page: Page, p: Point, near = 1.5, maxMs = 60_000): Promise<boolean> => walkTo(page, async () => p, near, maxMs);

/** Walk to the nearest standing tree within `reach` metres and gnaw it down. Returns the id felled, or null if there was none. */
export async function fellNearestTree(page: Page, reach = 120): Promise<string | null> {
  const tree = await page.evaluate((r) => {
    const g = (window as any).__game;
    const b = g.world().beaver;
    return g.nearestTree(b.x, b.z, r);
  }, reach);
  if (!tree) return null;
  // Stand still within reach and gnaw. A press while the beaver is still moving does nothing, so a miss tries again.
  for (let attempt = 0; attempt < 4; attempt++) {
    await walkToPoint(page, tree, 2.2 + attempt * 0.2, 40_000);
    await page.waitForTimeout(300);
    await tap(page, 'KeyE');
    const done = await page.waitForFunction((id) => (window as any).__game.world().felled.includes(id), tree.id, { polling: 100, timeout: 15_000 }).then(() => true, () => false);
    if (done) return tree.id;
    if (process.env.PLAYTEST_DEBUG) {
      const w = await world(page);
      console.log('fell miss', JSON.stringify({ tree, beaver: w.beaver, chop: w.chop, d: Math.hypot(tree.x - w.beaver.x, tree.z - w.beaver.z) }));
    }
  }
  throw new Error(`could not fell tree ${tree.id}`);
}

/** Grab the log of a felled tree, which the beaver drags by its end. It tries from where it stands, then closer to the log. */
export async function dragLog(page: Page, id: string): Promise<void> {
  const log = (await world(page)).logs.find((l: any) => l.id === id);
  expect(log, `log of ${id} lies where it fell`).toBeTruthy();
  const half = log.length / 2;
  // Points along the log, from its near end to the middle: the beaver reaches 2.5 m from the nearest point of the log.
  const along = [0, 0.25, 0.5].map((f) => ({ x: log.x - Math.sin(log.heading) * half * (1 - f), z: log.z - Math.cos(log.heading) * half * (1 - f) }));
  for (let attempt = 0; attempt < 4; attempt++) {
    await tap(page, 'KeyG');
    const got = await page.waitForFunction((i) => (window as any).__game.world().drag === i, id, { polling: 100, timeout: 1500 }).then(() => true, () => false);
    if (got) return;
    if (process.env.PLAYTEST_DEBUG) console.log('grab miss', JSON.stringify({ log, beaver: (await world(page)).beaver }));
    await walkToPoint(page, along[Math.min(attempt, along.length - 1)]!, 1.5, 10_000);
    await page.waitForTimeout(200);
  }
  throw new Error(`could not grab the log of ${id}`);
}

/**
 * Fell trees, drag the logs to the nearest lodge site, and build until the lodge is whole. The first log starts the lodge, where
 * the beaver stands facing the water, so each trip ends by walking toward the site from the land side.
 */
export async function buildLodge(page: Page, opts: { maxTrips?: number } = {}): Promise<void> {
  for (let trip = 0; trip < (opts.maxTrips ?? 12); trip++) {
    const w = await world(page);
    if (w.lodge && w.lodge.wood >= 10) return;
    const id = await fellNearestTree(page);
    expect(id, 'a tree to fell near the lodge site').not.toBeNull();
    await dragLog(page, id!);
    const site = await page.evaluate(() => (window as any).__game.lodgeSite(300));
    expect(site, 'a place a lodge can start').toBeTruthy();
    const lodge = w.lodge ?? site;
    // Approach from the land side: the door faces the deep water, so the land is behind it. The build button starts the lodge
    // 3 m ahead of the beaver, so it must stand facing the site; a miss backs off further and tries again.
    let placed = false;
    for (let attempt = 0; attempt < 4 && !placed; attempt++) {
      const run = 7 + attempt * 3;
      const back = { x: lodge.x - Math.sin(lodge.door) * run, z: lodge.z - Math.cos(lodge.door) * run };
      await walkToPoint(page, back, 1.5, 60_000);
      await walkTo(page, async () => lodge, 3.4, 10_000);
      const before = (await world(page)).lodge?.wood ?? 0;
      await tap(page, 'KeyB');
      placed = await page.waitForFunction((b) => ((window as any).__game.world().lodge?.wood ?? 0) > b, before, { polling: 100, timeout: 2000 }).then(() => true, () => false);
    }
    expect(placed, 'the log went on the lodge').toBe(true);
  }
}

/** Swim to the entrance of the whole lodge, dive in, and walk to the nest, as a player does to rest. */
export async function enterLodgeAndRest(page: Page): Promise<void> {
  const lodge = (await world(page)).lodge;
  expect(lodge, 'a lodge to go into').toBeTruthy();
  await walkToPoint(page, doorPoint(lodge, DOOR_DISTANCE + 4), 1.5, 40_000);
  // Dive toward the lodge: in at the entrance, which is under water.
  await walkTo(page, async () => lodge, 1, 15_000, ['Space']).catch(() => false);
  await page.waitForFunction(() => (window as any).__game.world().inLodge, null, { polling: 100, timeout: 5000 });
  await walkToPoint(page, { x: lodge.x + NEST.x, z: lodge.z + NEST.z }, 0.6, 15_000);
}
