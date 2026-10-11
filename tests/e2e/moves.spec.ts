import { expect, test, type Page } from '@playwright/test';
import { DOOR_DISTANCE, doorPoint } from '../../src/sim/lodge';
import { STORE_CAPACITY } from '../../src/sim/food';
import { BREATH_MIN_START } from '../../src/sim/state';
import { collectToasts, fellNearestTree, hasTiles, menuClick, nearestPad, openStash, pickPad, shot, startGame, tap, toasts, walkToPoint, world, type Point } from './helpers';
// Moves the other playtests do not cover (#258), in the real valley by the start lodge: picking up a rock with Take, climbing
// over a log on the ground, the breath a beaver needs before it dives again, and the Pantry achievement, with two tools of the test
// menu: Out of breath and Fill store but one. Needs the valley tiles.

/* eslint-disable @typescript-eslint/no-explicit-any */

test('a rock is picked up with Take, put down, and taken again', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const rocks: (Point & { id: string })[] = await page.evaluate(() => {
    const g = (window as any).__game;
    const b = g.world().beaver;
    return (g.rocksNear(150) as { id: string; x: number; z: number }[]).sort((p, q) => Math.hypot(p.x - b.x, p.z - b.z) - Math.hypot(q.x - b.x, q.z - b.z));
  });
  expect(rocks.length, 'rocks lie on the stream banks near the start').toBeGreaterThan(0);
  // Walk up to the nearest rock and press Take. Some lie where the beaver cannot stand (in the water, on a steep bank), so a
  // miss tries the next one.
  let got = false;
  for (const rock of rocks.slice(0, 6)) {
    if (!(await walkToPoint(page, rock, 0.6, 40_000))) continue;
    await page.waitForTimeout(300);
    await tap(page, 'KeyG');
    got = await page.waitForFunction(() => (window as any).__game.world().haul?.kind === 'rock', null, { polling: 100, timeout: 2000 }).then(() => true, () => false);
    if (got) break;
    if (process.env.PLAYTEST_DEBUG) console.log('rock miss', JSON.stringify({ rock, beaver: (await world(page)).beaver }));
  }
  expect(got, 'a rock in the mouth').toBe(true);
  let w = await world(page);
  expect(w.rocksTaken).toHaveLength(1);
  // The rock taken is gone from the ground.
  expect((await page.evaluate(() => ((window as any).__game.rocksNear(150) as { id: string }[]).map((r) => r.id))).includes(w.rocksTaken[0])).toBe(false);
  await shot(page, 'moves-01-rock');

  // Take again puts it down in front of the beaver, and once more picks it up again.
  await tap(page, 'KeyG');
  await page.waitForFunction(() => (window as any).__game.world().haul === null, null, { polling: 100, timeout: 3000 });
  w = await world(page);
  expect(w.dropped.map((d: any) => d.kind)).toEqual(['rock']);
  await page.waitForTimeout(300);
  await tap(page, 'KeyG');
  await page.waitForFunction(() => (window as any).__game.world().haul?.kind === 'rock', null, { polling: 100, timeout: 3000 });
  expect((await world(page)).dropped).toEqual([]);
  expect(errors).toEqual([]);
});

/** The beaver each frame, and the bare ground under it. */
type Frame = { x: number; z: number; y: number; mode: string; breath: number; ground: number };

/** Keep the beaver's state every frame, from a loop of animation frames in the page, until `stopFrames`. */
async function recordFrames(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as any;
    w.__frames = [];
    w.__recording = true;
    const tick = (): void => {
      if (!w.__recording) return;
      const g = w.__game;
      const b = g.world().beaver;
      w.__frames.push({ x: b.x, z: b.z, y: b.y, mode: b.mode, breath: b.breath, ground: g.groundAt(b.x, b.z) });
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopFrames(page: Page): Promise<Frame[]> {
  return page.evaluate(() => {
    const w = window as any;
    w.__recording = false;
    return w.__frames;
  });
}

test('the beaver climbs over a log that lies on the ground', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  const id = await fellNearestTree(page);
  expect(id, 'a tree to fell near the start').not.toBeNull();
  const log = (await world(page)).logs.find((l: any) => l.id === id);
  expect(log.floating, 'the log lies on the ground').toBe(false);

  // Cross the log at a right angle, from 3 m on one side to 3 m on the other, and keep how high the feet are over the ground
  // each frame. A crossing that runs into the water (where a log is not climbed) tries another place along the log.
  const along = { x: Math.sin(log.heading), z: Math.cos(log.heading) };
  const across = { x: along.z, z: -along.x };
  let crossing: Frame[] = [];
  for (const f of [0, 0.3, -0.3]) {
    const mid = { x: log.x + along.x * (log.length / 2) * f, z: log.z + along.z * (log.length / 2) * f };
    const from = { x: mid.x + across.x * 3, z: mid.z + across.z * 3 };
    const to = { x: mid.x - across.x * 3, z: mid.z - across.z * 3 };
    if (!(await walkToPoint(page, from, 0.6, 30_000))) continue;
    await recordFrames(page);
    const crossed = await walkToPoint(page, to, 0.6, 20_000);
    const frames = await stopFrames(page);
    const wet = frames.some((p) => p.mode !== 'walk');
    if (process.env.PLAYTEST_DEBUG) {
      const side = (p: Frame): number => (p.x - log.x) * across.x + (p.z - log.z) * across.z;
      console.log('crossing', JSON.stringify({ f, crossed, wet, frames: frames.map((p) => [+side(p).toFixed(2), +(p.y - p.ground).toFixed(2)]) }));
    }
    if (!crossed || wet) continue;
    crossing = frames;
    break;
  }
  expect(crossing.length, 'a crossing on dry ground').toBeGreaterThan(0);
  const lifts = crossing.map((p) => p.y - p.ground);
  const top = lifts.indexOf(Math.max(...lifts));
  // LOG_HEIGHT in src/sim/logs.ts is 0.7 m: on top of the log the feet are most of the way up it.
  expect(lifts[top], 'the feet rose over the log').toBeGreaterThan(0.4);
  // It started on the ground, and came down on the ground on the other side.
  expect(lifts[0]).toBeLessThan(0.05);
  expect(Math.min(...lifts.slice(top)), 'down on the ground past the log').toBeLessThan(0.05);
  expect(errors).toEqual([]);
});

test('out of breath, the beaver rises and dives again only after it has some breath back', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  // Out on the deep lake in front of the lodge door, as in swim.spec.ts.
  await walkToPoint(page, doorPoint((await world(page)).lodge, DOOR_DISTANCE + 8), 2, 60_000);
  await page.waitForFunction(() => (window as any).__game.world().beaver.mode === 'swim', null, { polling: 100, timeout: 10_000 });
  // Dive and stay down with Space held the whole time. A minute of breath takes too long in the software browser, so the test
  // menu's Out of breath tool leaves only a little of it.
  await page.keyboard.down('Space');
  try {
    await page.waitForFunction(() => (window as any).__game.world().beaver.mode === 'dive', null, { polling: 100, timeout: 10_000 });
    await page.waitForTimeout(1500);
    await recordFrames(page);
    await menuClick(page, 'button[data-action="breath-low"]');
    // The menu's button keeps the focus, and Space on a focused button would press it: let it go.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    // It comes up by itself, waits at the surface, and goes down again with Space still held.
    await page.waitForFunction(
      () => {
        const s = (window as any).__frames as { mode: string; breath: number }[];
        const empty = s.findIndex((p) => p.breath === 0);
        const up = s.findIndex((p, i) => empty >= 0 && i > empty && p.mode === 'swim');
        return up > 0 && s.some((p, i) => i > up && p.mode === 'dive');
      },
      null,
      { polling: 100, timeout: 60_000 },
    );
  } finally {
    await page.keyboard.up('Space');
  }
  const s = await stopFrames(page);
  const empty = s.findIndex((p) => p.breath === 0);
  const up = s.findIndex((p, i) => i > empty && p.mode === 'swim');
  const again = s.findIndex((p, i) => i > up && p.mode === 'dive');
  if (process.env.PLAYTEST_DEBUG) console.log('breath', JSON.stringify({ frames: s.length, empty, up, again, at: [s[empty], s[up], s[again]] }));
  // Empty under water, it rose to the surface.
  expect(s[empty]!.mode).toBe('dive');
  expect(s[up]!.y).toBeGreaterThan(s[empty]!.y);
  // At the surface it had next to no breath, and held Space did nothing until the minimum came back.
  expect(s[up]!.breath).toBeLessThan(0.1);
  expect(Math.max(...s.slice(up, again).map((p) => p.breath))).toBeLessThan(BREATH_MIN_START + 0.1);
  // It dived again at about the minimum, not after a full breath.
  expect(s[again]!.breath).toBeGreaterThan(BREATH_MIN_START - 0.03);
  expect(s[again]!.breath).toBeLessThan(BREATH_MIN_START + 0.1);
  expect(errors).toEqual([]);
});

test('the last piece into a nearly full store wins the Pantry', async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await startGame(page);
  test.skip(!(await hasTiles(page)), 'needs the tiles built locally');
  await collectToasts(page);
  const pad = await nearestPad(page);
  expect(pad, 'lily pads float near the lodge in spring').not.toBeNull();
  await pickPad(page, pad!);
  expect((await world(page)).carry).toBe('lily');

  // The test menu fills the store but one place: no Pantry yet.
  await menuClick(page, 'button[data-action="store-fill"]');
  await page.waitForFunction((n) => (window as any).__game.world().store.filter((f: unknown) => f !== null).length === n - 1, STORE_CAPACITY, { polling: 100, timeout: 5000 });
  await page.waitForTimeout(500);
  let w = await world(page);
  expect(w.achievements).not.toContain('pantry');
  const free = w.store.indexOf(null);
  expect(free).toBeGreaterThanOrEqual(0);

  // The pad goes into the last place through the stash screen.
  await openStash(page);
  await page.locator(`#stash button[data-slot="${free}"]`).click();
  await page.waitForFunction(() => (window as any).__game.world().achievements.includes('pantry'), null, { polling: 100, timeout: 5000 });
  w = await world(page);
  expect(w.store.every((f: unknown) => f !== null)).toBe(true);
  expect(w.carry).toBeNull();
  await page.locator('#stash-close').click();
  await page.waitForFunction(() => (window as any).__game.world().stashOpen === false, null, { polling: 100, timeout: 5000 });
  await expect.poll(() => toasts(page), { timeout: 5000 }).toContain('Pantry achievement: the store is full');
  await page.getByRole('button', { name: 'Test menu' }).click();
  await page.locator('button[data-action="achievements"]').click();
  await expect(page.locator('pre', { hasText: '[x] Pantry' })).toBeAttached();
  await shot(page, 'moves-02-pantry');
  expect(errors).toEqual([]);
});
