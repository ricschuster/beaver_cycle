// Shared helpers for the playtests in tests/e2e: drive the real game the way a player does, with the keys and the test menu,
// and read its state through the read only `window.__game` hook (src/main.ts).
import { expect, type Page } from '@playwright/test';
import { DOOR_DISTANCE, HOLE, NEST, doorPoint } from '../../src/sim/lodge';

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

/** The nearest floating lily pad within `radius` metres of the beaver, or null. Needs the `lilyPadsNear` hook. */
export async function nearestPad(page: Page, radius = 80): Promise<{ id: string; x: number; z: number } | null> {
  return page.evaluate((r) => {
    const g = (window as any).__game;
    const b = g.world().beaver;
    const pads = g.lilyPadsNear(r) as { id: string; x: number; z: number }[];
    return pads.sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z))[0] ?? null;
  }, radius);
}

/** Swim up to the pad and gnaw it into the mouth. Returns the id of the pad picked, which is the nearest one in reach, not always this one. */
export async function pickPad(page: Page, pad: { id: string; x: number; z: number }): Promise<string> {
  const before = Object.keys((await world(page)).picked);
  for (let attempt = 0; attempt < 4; attempt++) {
    await walkToPoint(page, pad, 0.8 + attempt * 0.2, 40_000);
    await page.waitForTimeout(300);
    await tap(page, 'KeyE');
    const got = await page.waitForFunction(() => (window as any).__game.world().carry === 'lily', null, { polling: 100, timeout: 3000 }).then(() => true, () => false);
    if (got) return Object.keys((await world(page)).picked).find((id) => !before.includes(id))!;
  }
  throw new Error(`could not pick lily pad ${pad.id}`);
}

/** Swim to the food store beside the lodge door and press build: the stash screen opens. */
export async function openStash(page: Page): Promise<void> {
  const lodge = (await world(page)).lodge;
  // The store lies at STORE_DISTANCE (src/sim/food.ts) from the lodge centre along the door; the beaver reaches 3.5 m.
  const spot = doorPoint(lodge, DOOR_DISTANCE + 1.5 + 0.2);
  for (let attempt = 0; attempt < 3; attempt++) {
    await walkToPoint(page, spot, 1.2, 40_000);
    await page.waitForTimeout(300);
    await tap(page, 'KeyB');
    const open = await page.waitForFunction(() => (window as any).__game.world().stashOpen === true, null, { polling: 100, timeout: 2000 }).then(() => true, () => false);
    if (open) return;
  }
  throw new Error('the stash screen did not open at the store');
}

/** Record every message the toast shows (it holds one at a time, so a later one hides an earlier). Call before the game acts. */
export async function collectToasts(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    w.__toasts = [];
    const el = document.getElementById('toast')!;
    new MutationObserver(() => {
      if (el.textContent) w.__toasts.push(el.textContent);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  });
}

/** Every message recorded by `collectToasts` so far. */
export const toasts = (page: Page): Promise<string[]> => page.evaluate(() => (window as any).__toasts as string[]);

/** Open or close the test menu panel (it is a toggle). */
export const toggleMenu = (page: Page): Promise<void> => page.getByRole('button', { name: 'Test menu' }).click();

/** Go to the nearest dam spot with the test menu, and wait until the beaver stands in its ring. Returns the spot. */
export async function goToNearestSpot(page: Page): Promise<any> {
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-action="dam-go"]').click();
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.waitForFunction(
    () => {
      const w = (window as any).__game.world();
      return w.spots.some((s: any) => Math.hypot(s.bed.x - w.beaver.x, s.bed.z - w.beaver.z) < 15);
    },
    null,
    { polling: 200, timeout: 60_000 },
  );
  await page.waitForTimeout(1000);
  return nearestSpot(page);
}

/** The dam spot nearest the beaver, with its distance `d`. */
export async function nearestSpot(page: Page): Promise<any> {
  const w = await world(page);
  return w.spots.map((s: any) => ({ ...s, d: Math.hypot(s.bed.x - w.beaver.x, s.bed.z - w.beaver.z) })).sort((a: any, b: any) => a.d - b.d)[0];
}

/**
 * Pick up a load of mud or a rock near a dam spot, away from trees (a tree within reach would be gnawed instead). It tries a ring
 * of places round the spot, each facing the spot where the stream is. Returns the kind in the mouth, or null.
 */
export async function scoopLoad(page: Page, spot: { bed: Point }): Promise<'mud' | 'rock' | null> {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    for (const r of [3.5, 6]) {
      const at = { x: spot.bed.x + Math.cos(a) * r, z: spot.bed.z + Math.sin(a) * r };
      await walkToPoint(page, at, 0.8, 8000);
      // Face the spot: step toward it a little.
      await walkTo(page, async () => spot.bed, r - 1.2, 3000);
      await page.waitForTimeout(250);
      const clear = await page.evaluate(() => {
        const g = (window as any).__game;
        const b = g.world().beaver;
        return g.nearestTree(b.x, b.z, 3.2) === null;
      });
      if (!clear) continue;
      await tap(page, 'KeyE');
      await page.waitForTimeout(300);
      const haul = (await world(page)).haul;
      if (haul) return haul.kind;
    }
  }
  return null;
}

/** Click a button of the test menu, opening the menu first if it is closed and closing it again, so screenshots stay clear. */
export async function menuClick(page: Page, selector: string): Promise<void> {
  const open = await page.locator('button[data-speed="1"]').isVisible();
  if (!open) await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator(selector).click();
  await page.getByRole('button', { name: 'Test menu' }).click();
}

/** Mama and Papa as the game draws them now (`__game.parents`): the player's own while young, and those of former homes. */
export const parentsNow = (page: Page): Promise<any[]> => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__game.parents())));

/** From inside the lodge, walk to the water hole and press the build button there, which dives out through the entrance. */
export async function leaveLodgeByHole(page: Page): Promise<void> {
  const lodge = (await world(page)).lodge;
  expect(lodge, 'a lodge to leave').toBeTruthy();
  await walkToPoint(page, { x: lodge.x + HOLE.x, z: lodge.z + HOLE.z - HOLE.radius - 0.5 }, 0.5, 15_000);
  await tap(page, 'KeyB');
  await page.waitForFunction(() => !(window as any).__game.world().inLodge, null, { polling: 100, timeout: 5000 });
}
