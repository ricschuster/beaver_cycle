// Shared helpers for the playtests in tests/e2e: drive the real game the way a player does, with the keys and the test menu,
// and read its state through the read only `window.__game` hook (src/main.ts).
import { expect, type Page } from '@playwright/test';
import { SPOT_REACH, costOf, needs } from '../../src/sim/dam';
import { DOOR_DISTANCE, HOLE, LODGE_REACH, NEST, doorPoint } from '../../src/sim/lodge';

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
  // A swimming beaver coasts on after the keys are let go, by about its speed times the delay of the loop (more under load), so it
  // lets go early by that much. Each early stop that ends outside `near` halves the margin, so the last tries are exact.
  let margin = 1;
  let last: { x: number; z: number; at: number } | null = null;
  try {
    while (Date.now() < deadline) {
      const s = await page.evaluate(() => {
        const g = (window as any).__game;
        return { b: g.world().beaver as { x: number; z: number; mode: string }, yaw: g.view().yaw as number };
      });
      const t = await target();
      const dx = t.x - s.b.x;
      const dz = t.z - s.b.z;
      const dist = Math.hypot(dx, dz);
      if (dist <= near) return true;
      const now = Date.now();
      const speed = last && now > last.at ? (Math.hypot(s.b.x - last.x, s.b.z - last.z) / (now - last.at)) * 1000 : 0;
      last = { x: s.b.x, z: s.b.z, at: now };
      if (s.b.mode !== 'walk' && margin > 0.1 && dist <= near + speed * 0.4 * margin) {
        for (const c of held) await page.keyboard.up(c);
        held = [];
        await page.waitForTimeout(700);
        const r = await page.evaluate(() => (window as any).__game.world().beaver as { x: number; z: number });
        if (Math.hypot(t.x - r.x, t.z - r.z) <= near) return true;
        margin /= 2;
        last = null;
        continue;
      }
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

/**
 * Walk to the nearest standing tree within `reach` metres that stands on dry ground and gnaw it down. Returns the id felled, or
 * null if there was none. Do gnaws only on land, so a tree standing in the lake or a new pond is left out, and a tree that still
 * cannot be felled after a few tries is given up for the next nearest.
 */
export async function fellNearestTree(page: Page, reach = 120): Promise<string | null> {
  const skip: string[] = [];
  for (let pick = 0; pick < 3; pick++) {
    const tree = await page.evaluate(
      ({ r, s }) => {
        const g = (window as any).__game;
        const b = g.world().beaver;
        return g.nearestTree(b.x, b.z, r, true, s);
      },
      { r: reach, s: skip },
    );
    if (!tree) return null;
    if (await fellTree(page, tree)) return tree.id;
    skip.push(tree.id);
  }
  throw new Error(`could not fell any of the trees ${skip.join(', ')}`);
}

async function fellTree(page: Page, tree: { id: string; x: number; z: number }): Promise<boolean> {
  // Stand still within reach and gnaw. A press while the beaver is still moving does nothing, so a miss tries again. A press
  // while the tree is still being gnawed, or once it is down, would strip a branch off the new log into the mouth, and a full
  // mouth stops the next Gnaw and Take, so a retry presses only when nothing is being gnawed.
  for (let attempt = 0; attempt < 4; attempt++) {
    // A branch (or anything else) left in the mouth from the last log makes the button read Do, not Gnaw: put it down first.
    if ((await world(page)).carry) {
      await tap(page, 'KeyG');
      await page.waitForFunction(() => !(window as any).__game.world().carry, null, { polling: 100, timeout: 3000 }).catch(() => undefined);
    }
    await walkToPoint(page, tree, 2.2 + attempt * 0.2, 40_000);
    // Still swimming by a tree at the shore: go round the trunk to its far side, which is on land.
    if ((await world(page)).beaver.mode === 'swim') {
      const b = (await world(page)).beaver;
      const d = Math.hypot(tree.x - b.x, tree.z - b.z) || 1;
      await walkToPoint(page, { x: tree.x + ((tree.x - b.x) / d) * 1.5, z: tree.z + ((tree.z - b.z) / d) * 1.5 }, 0.8, 10_000);
    }
    await page.waitForTimeout(300);
    const w = await world(page);
    if (w.felled.includes(tree.id)) return true;
    if (!w.chop) await tap(page, 'KeyE');
    const done = await page.waitForFunction((id) => (window as any).__game.world().felled.includes(id), tree.id, { polling: 100, timeout: 15_000 }).then(() => true, () => false);
    if (done) return true;
    if (process.env.PLAYTEST_DEBUG) {
      const w = await world(page);
      const doLabel = await page.locator('#touch-do').textContent().catch(() => null);
      console.log('fell miss', JSON.stringify({ tree, beaver: w.beaver, chop: w.chop, do: doLabel, d: Math.hypot(tree.x - w.beaver.x, tree.z - w.beaver.z) }));
    }
  }
  return false;
}

/** Grab the log of a felled tree, which the beaver drags by its end. It tries from where it stands, then closer to the log. */
export async function dragLog(page: Page, id: string): Promise<void> {
  const log = (await world(page)).logs.find((l: any) => l.id === id);
  expect(log, `log of ${id} lies where it fell`).toBeTruthy();
  const half = log.length / 2;
  // Points along the log, from its near end to the middle: the beaver reaches 2.5 m from the nearest point of the log.
  const along = [0, 0.25, 0.5].map((f) => ({ x: log.x - Math.sin(log.heading) * half * (1 - f), z: log.z - Math.cos(log.heading) * half * (1 - f) }));
  // Take drops what is in the mouth, and then picks up a piece put down before a log. A press short of the log can also take
  // mud or a rock. So whatever is in the mouth is put down well away from the log first.
  const emptyMouth = async (back: Point): Promise<void> => {
    const w = await world(page);
    if (!w.carry && !w.haul) return;
    const d = Math.hypot(w.beaver.x - log.x, w.beaver.z - log.z) || 1;
    const out = half + 6;
    await walkToPoint(page, { x: log.x + ((w.beaver.x - log.x) / d) * out, z: log.z + ((w.beaver.z - log.z) / d) * out }, 1.5, 15_000);
    await tap(page, 'KeyG');
    await page.waitForFunction(() => !(window as any).__game.world().carry && !(window as any).__game.world().haul, null, { polling: 100, timeout: 3000 }).catch(() => undefined);
    await walkToPoint(page, back, 1.5, 15_000);
    await page.waitForTimeout(200);
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    await emptyMouth(along[Math.min(attempt, along.length - 1)]!);
    await tap(page, 'KeyG');
    const got = await page.waitForFunction((i) => (window as any).__game.world().drag === i, id, { polling: 100, timeout: 1500 }).then(() => true, () => false);
    if (got) return;
    if (process.env.PLAYTEST_DEBUG) {
      const w = await world(page);
      const take = await page.locator('#touch-take').textContent().catch(() => null);
      console.log('grab miss', JSON.stringify({ log, beaver: w.beaver, carry: w.carry, haul: w.haul, chop: w.chop, take, dropped: w.dropped.filter((d: any) => Math.hypot(d.x - w.beaver.x, d.z - w.beaver.z) < 4) }));
    }
    await walkToPoint(page, along[Math.min(attempt, along.length - 1)]!, 1.5, 10_000);
    await page.waitForTimeout(200);
  }
  throw new Error(`could not grab the log of ${id}`);
}

/**
 * A place near `site` (found by `__game.lodgeSite`) where a lodge can start with room to spare: the spot itself and the ground a
 * little round it all pass. `lodgeSite` finds the nearest good spot, which is often right at the edge of the good water, and the
 * beaver cannot stop that exactly, so a press there can land on dry ground ("no lodge spot, face the water"). It also keeps away
 * from the dam spots if it can: in a spot's ring Do puts the log on the dam (mending it) instead. Falls back to `site`.
 */
async function roomySite(page: Page, site: { x: number; z: number; door: number }): Promise<Point> {
  return page.evaluate((s: { x: number; z: number; door: number; reach: number }) => {
    const g = (window as any).__game;
    const ax = { x: Math.sin(s.door), z: Math.cos(s.door) };
    const side = { x: ax.z, z: -ax.x };
    const at = (p: { x: number; z: number }, along: number, across: number) => ({ x: p.x + ax.x * along + side.x * across, z: p.z + ax.z * along + side.z * across });
    const ok = (p: { x: number; z: number }) => g.siteProblem(p.x, p.z) === null;
    // Far enough from every dam spot that the beaver, 3 m short of it, stands out of the spot's ring.
    const clear = (p: { x: number; z: number }) => g.world().spots.every((o: any) => Math.hypot(o.bed.x - p.x, o.bed.z - p.z) > s.reach + 3.5);
    for (const needClear of [true, false]) {
      for (const along of [0, 0.5, 1, 1.5, 2, 2.5, 3, -0.5, -1]) {
        for (const across of [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2, 3, -3, 4, -4]) {
          const p = at(s, along, across);
          if (needClear && !clear(p)) continue;
          if ([[0, 0], [-0.8, 0], [1, 0], [0, 0.8], [0, -0.8], [0.5, 0.5], [0.5, -0.5]].every(([a, c]) => ok(at(p, a!, c!)))) return p;
        }
      }
    }
    return { x: s.x, z: s.z };
  }, { ...site, reach: SPOT_REACH });
}

/** True when the beaver stands in the ring of a dam spot, where Do with a log builds or mends the dam, not the lodge. */
async function atDamSpot(page: Page): Promise<boolean> {
  const w = await world(page);
  return w.spots.some((s: any) => Math.hypot(s.bed.x - w.beaver.x, s.bed.z - w.beaver.z) <= SPOT_REACH);
}

/**
 * Start the lodge with the dragged log near `aim`. The lodge starts SITE_AHEAD (3 m) ahead of the beaver, where it faces, and the
 * beaver faces the way it last moved, one of eight directions of the keys, so a walk rarely ends facing just right. So it goes to
 * a few places about 3 m short of `aim`, and at each one turns with short steps in each of the eight directions, reading the spot
 * ahead (`__game.siteAhead`, what the carry line shows) after each, and presses Do as soon as a lodge can start there.
 */
async function startLodge(page: Page, aim: Point, door: number): Promise<boolean> {
  const placedSince = (before: number): Promise<boolean> =>
    page.waitForFunction((b) => ((window as any).__game.world().lodge?.wood ?? 0) > b, before, { polling: 100, timeout: 2000 }).then(() => true, () => false);
  for (const turn of [0, 1, -1, 2, -2, 4]) {
    const a = door + (turn * Math.PI) / 8;
    // From the land side: the door faces the deep water, so the land is behind the lodge.
    await walkToPoint(page, { x: aim.x - Math.sin(a) * 6, z: aim.z - Math.cos(a) * 6 }, 1.5, 30_000);
    await walkToPoint(page, { x: aim.x - Math.sin(a) * 3, z: aim.z - Math.cos(a) * 3 }, 0.6, 15_000);
    for (const k of KEYS) {
      if (!(await world(page)).drag) return false;
      const ahead = await page.evaluate(() => (window as any).__game.siteAhead());
      if (ahead.problem === null && !(await atDamSpot(page))) {
        await tap(page, 'KeyE');
        if (await placedSince(0)) return true;
      }
      for (const c of k.codes) await page.keyboard.down(c);
      await page.waitForTimeout(80);
      for (const c of k.codes) await page.keyboard.up(c);
      await page.waitForTimeout(150);
    }
    if (process.env.PLAYTEST_DEBUG) {
      const now = await world(page);
      const ahead = await page.evaluate(() => (window as any).__game.siteAhead());
      console.log('lodge miss', JSON.stringify({ aim, door, turn, beaver: now.beaver, drag: now.drag, ahead, hud: await hudText(page) }));
    }
  }
  return false;
}

/**
 * Fell trees, drag the logs to the nearest lodge site, and build until the lodge is whole. The first log starts the lodge (see
 * `startLodge`); later logs only need the beaver within reach of the lodge, which it walks up to from the land side.
 */
export async function buildLodge(page: Page, opts: { maxTrips?: number } = {}): Promise<void> {
  for (let trip = 0; trip < (opts.maxTrips ?? 12); trip++) {
    const w = await world(page);
    if (w.lodge && w.lodge.wood >= 10) return;
    const id = await fellNearestTree(page);
    expect(id, 'a tree to fell near the lodge site').not.toBeNull();
    await dragLog(page, id!);
    if (!w.lodge) {
      const site = await page.evaluate(() => (window as any).__game.lodgeSite(300));
      expect(site, 'a place a lodge can start').toBeTruthy();
      let started = false;
      for (let attempt = 0; attempt < 2 && !started; attempt++) {
        if (!(await world(page)).drag) await dragLog(page, id!);
        started = await startLodge(page, await roomySite(page, site), site.door);
      }
      expect(started, 'the first log started the lodge').toBe(true);
      continue;
    }
    const lodge = w.lodge;
    // Within reach of the lodge but out of the ring of a dam spot, where Do would put the log on the dam instead (to mend it).
    // The land side first: the door faces the deep water.
    let placed = false;
    for (const turn of [4, 3, 5, 2, 6, 1, 7, 0]) {
      if (placed) break;
      const a = lodge.door + (turn * Math.PI) / 4;
      const at = { x: lodge.x + Math.sin(a) * (LODGE_REACH - 1.4), z: lodge.z + Math.cos(a) * (LODGE_REACH - 1.4) };
      if ((await world(page)).spots.some((s: any) => Math.hypot(s.bed.x - at.x, s.bed.z - at.z) <= SPOT_REACH + 0.5)) continue;
      if (!(await world(page)).drag) await dragLog(page, id!);
      await walkToPoint(page, at, 0.8, 30_000);
      const now = await world(page);
      if (Math.hypot(now.beaver.x - lodge.x, now.beaver.z - lodge.z) > LODGE_REACH || (await atDamSpot(page))) continue;
      await tap(page, 'KeyE');
      placed = await page.waitForFunction((b) => ((window as any).__game.world().lodge?.wood ?? 0) > b, now.lodge.wood, { polling: 100, timeout: 3000 }).then(() => true, () => false);
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
    await tap(page, 'KeyG');
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
    await tap(page, 'KeyE');
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

/** Wait until a message has been shown. Toasts queue (#261), so one raised behind others comes up some seconds later. */
export const expectToast = (page: Page, text: string, timeout = 40_000): Promise<void> =>
  expect.poll(() => toasts(page), { timeout, message: `the toast "${text}"` }).toContain(text);

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

/** Jump to a dam spot by its id (`__game.goToSpot`), wait until the beaver is there, and return the spot. */
export async function goToSpotById(page: Page, id: string): Promise<any> {
  expect(await page.evaluate((i) => (window as any).__game.goToSpot(i), id), `a dam spot ${id}`).toBe(true);
  await page.waitForFunction(
    (i) => {
      const w = (window as any).__game.world();
      const s = w.spots.find((x: any) => x.id === i);
      return !!s && Math.hypot(s.bed.x - w.beaver.x, s.bed.z - w.beaver.z) < 15;
    },
    id,
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
export async function scoopLoad(page: Page, spot: { bed: Point }, opts: { rock?: boolean } = {}): Promise<'mud' | 'rock' | null> {
  if (opts.rock) {
    // A rock lies where the hash puts it, so it is walked to: the nearest ones round the spot, within the reach of the Take button.
    const rocks: { id: string; x: number; z: number }[] = await page.evaluate(([x, z]) => {
      const g = (window as any).__game;
      return g.rocksNear(60).map((r: any) => ({ ...r, d: Math.hypot(r.x - x!, r.z - z!) })).sort((p: any, q: any) => p.d - q.d).slice(0, 4).map(({ id, x, z }: any) => ({ id, x, z }));
    }, [spot.bed.x, spot.bed.z]);
    for (const rock of rocks) {
      await walkToPoint(page, rock, 1, 20_000);
      await tap(page, 'KeyG');
      await page.waitForTimeout(300);
      const haul = (await world(page)).haul;
      if (haul) return haul.kind;
    }
  }
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
      await tap(page, 'KeyG');
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

/** From inside the lodge, walk to the water hole and press Dive (Space) there, which dives out through the entrance. */
export async function leaveLodgeByHole(page: Page): Promise<void> {
  const lodge = (await world(page)).lodge;
  expect(lodge, 'a lodge to leave').toBeTruthy();
  await walkToPoint(page, { x: lodge.x + HOLE.x, z: lodge.z + HOLE.z - HOLE.radius - 0.5 }, 0.5, 15_000);
  await tap(page, 'Space');
  await page.waitForFunction(() => !(window as any).__game.world().inLodge, null, { polling: 100, timeout: 5000 });
}

/** The text of the carry line at the top left, where the repair and store lines show. */
export const hudText = (page: Page): Promise<string> => page.locator('#carry-hud').innerText();

/** Walk to the food store beside the lodge door, where both the lodge and the store are in reach. */
export async function walkToStore(page: Page): Promise<void> {
  const lodge = (await world(page)).lodge;
  expect(lodge, 'a lodge with a store').toBeTruthy();
  // STORE_DISTANCE in src/sim/food.ts: the door point 1.5 m beyond the door distance.
  await walkToPoint(page, doorPoint(lodge, DOOR_DISTANCE + 1.5), 0.8, 40_000);
  await page.waitForTimeout(300);
}

/**
 * Build the dam at a spot by real play, from the first log to the last rock: fell a tree, drag the log to the ring and place it,
 * and scoop mud and rocks from the wet ground and put them on, until the dam is whole at level 1. The first log starts the dam.
 * A load the dam no longer needs is put down again. Returns the number of trips it took.
 */
export async function buildDamByHand(page: Page, spot: { id: string; bed: Point }, opts: { maxTrips?: number } = {}): Promise<number> {
  const dam = async (): Promise<any> => (await world(page)).dams.find((d: any) => d.spot === spot.id);
  const left = async (): Promise<{ wood: number; mud: number; rock: number }> => {
    const d = await dam();
    return d ? needs(d, costOf(d)) : { wood: 1, mud: 1, rock: 1 };
  };
  const max = opts.maxTrips ?? 40;
  for (let trip = 1; trip <= max; trip++) {
    let n = await left();
    if (process.env.PLAYTEST_DEBUG) console.log('dam trip', trip, JSON.stringify(n));
    if (n.wood + n.mud + n.rock === 0) return trip - 1;
    const d = await dam();
    if (!d || n.wood > 0) {
      const id = await fellNearestTree(page, 80);
      expect(id, 'a tree to fell near the dam spot').not.toBeNull();
      await dragLog(page, id!);
      await walkToPoint(page, spot.bed, 3, 40_000);
      const before = d?.wood ?? 0;
      await tap(page, 'KeyE');
      await page.waitForFunction(([sp, b]) => ((window as any).__game.world().dams.find((x: any) => x.spot === sp)?.wood ?? 0) > (b as number), [spot.id, before], { polling: 100, timeout: 5000 });
      continue;
    }
    n = await left();
    const kind = await scoopLoad(page, spot, { rock: n.mud === 0 && n.rock > 0 });
    expect(kind, 'mud or a rock in the mouth').not.toBeNull();
    await walkToPoint(page, spot.bed, 3, 30_000);
    await tap(page, 'KeyE');
    await page.waitForFunction(() => (window as any).__game.world().haul === null, null, { polling: 100, timeout: 5000 }).catch(async () => {
      // The dam wants no more of this: put the load down and scoop again.
      await tap(page, 'KeyG');
    });
  }
  throw new Error(`the dam at ${spot.id} was not whole after ${max} trips, still needs ${JSON.stringify(await left())} of ${JSON.stringify(await dam())}`);
}
