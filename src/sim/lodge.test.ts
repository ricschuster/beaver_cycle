import { describe, expect, it } from 'vitest';
import { noIntent, type Intent } from './buttons';
import { DOOR_DISTANCE, HOLE, INTERIOR_RADIUS, NEST, LODGE_REACH, LODGE_WOOD, SOLID_RADIUS, addWood, atHole, atNest, doorPoint, findSite, checkSite, lodgeComplete, lodgeProgress, lodgeSite, logWood, followPond } from './lodge';
import type { Log } from './logs';
import { isNight } from './clock';
import { canSleep, createWorld, type WorldState } from './state';
import { step } from './step';
import { flatTerrain, type Terrain } from './terrain';

/** Dry land for z < 0, then a lake whose depth grows 0.5 m per metre south of the shore (z = 0), so it is deep from z = 3. */
const shore: Terrain = {
  heightAt: () => 0,
  isWater: (_x, z) => z >= 0,
  waterDepth: (_x, z) => Math.max(0, z * 0.5),
};

const build: Intent = { ...noIntent(), build: true };
const log = (id: string, length: number): Log => ({ id, x: 0, y: 0, z: -2, heading: 0, length, floating: false });

/** A beaver on dry land at z = -1 facing the water, dragging a log of this length. */
function dragging(length: number): WorldState {
  let w = createWorld(shore, 0, -1);
  w = { ...w, beaver: { ...w.beaver, heading: 0 }, logs: [log('a', length)], drag: 'a' };
  return w;
}

describe('lodge site', () => {
  it('is ahead of the beaver in shallow water with deep water near', () => {
    const site = lodgeSite(shore, 0, -1, 0);
    expect(site).not.toBeNull();
    expect(site!.z).toBeCloseTo(2);
    expect(site!.base).toBeCloseTo(1);
    expect(site!.wood).toBe(0);
  });

  it('is not on dry land, in deep water, or away from deep water', () => {
    expect(lodgeSite(shore, 0, -10, 0)).toBeNull();
    expect(lodgeSite(shore, 0, 5, 0)).toBeNull();
    const puddle: Terrain = { ...shore, waterDepth: (x, z) => (Math.hypot(x, z - 2) < 8 ? 0.5 : 0) };
    expect(lodgeSite(puddle, 0, -1, 0)).toBeNull();
  });
});

describe('site check', () => {
  it('says why a spot fails', () => {
    expect(checkSite(shore, 0, -1, 0).problem).toBeNull();
    expect(checkSite(shore, 0, -10, 0).problem).toBe('dry');
    expect(checkSite(shore, 0, 5, 0).problem).toBe('deep');
    const puddle: Terrain = { ...shore, waterDepth: (x, z) => (Math.hypot(x, z - 2) < 8 ? 0.5 : 0) };
    expect(checkSite(puddle, 0, -1, 0).problem).toBe('far');
  });

  it('needs deep water at the door, not just somewhere near', () => {
    // A deep hole 5 m out at z = 7 is too far for the door (2.9 m) and its run, so the door would open onto shallows.
    const hole: Terrain = { ...shore, waterDepth: (x, z) => (Math.hypot(x, z - 12) < 3 ? 3 : z > 1 && z < 3 ? 1 : 0.4) };
    expect(checkSite(hole, 0, -1, 0).problem).toBe('far');
    // Deep water right in front of the door is fine, and the door faces it.
    const deepAhead: Terrain = { ...shore, waterDepth: (x, z) => (z > 4 ? 2 : z > 1 ? 1 : 0) };
    const ok = checkSite(deepAhead, 0, -1, 0);
    expect(ok.problem).toBeNull();
    expect(Math.cos(ok.lodge!.door)).toBeGreaterThan(0.9);
  });
});

describe('find site', () => {
  it('finds the nearest spot where a lodge can start, or none', () => {
    const site = findSite(shore, 0, -10, 40);
    expect(site).not.toBeNull();
    expect(site!.z).toBeGreaterThan(0);
    expect(site!.z).toBeLessThan(4);
    expect(findSite(flatTerrain(0), 0, 0, 40)).toBeNull();
  });
});

describe('lodge wood', () => {
  it('counts a long log as two and a short one as one, and stops at a whole lodge', () => {
    expect(logWood({ length: 6 })).toBe(2);
    expect(logWood({ length: 4 })).toBe(1);
    let l = { x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD - 1 };
    expect(lodgeComplete(l)).toBe(false);
    l = addWood(l, { length: 6 });
    expect(l.wood).toBe(LODGE_WOOD);
    expect(lodgeComplete(l)).toBe(true);
    expect(lodgeProgress(l)).toBe(1);
  });
});

describe('build', () => {
  it('places the dragged log, which starts the lodge', () => {
    const w = step(dragging(6), build, 0.1, shore);
    expect(w.lodge).not.toBeNull();
    expect(w.lodge!.wood).toBe(2);
    expect(w.logs).toHaveLength(0);
    expect(w.drag).toBeNull();
  });

  it('keeps the log when there is no site', () => {
    let w = createWorld(shore, 0, -20);
    w = { ...w, logs: [log('a', 6)], drag: 'a' };
    const out = step(w, build, 0.1, shore);
    expect(out.lodge).toBeNull();
    expect(out.drag).toBe('a');
    expect(out.logs).toHaveLength(1);
  });

  it('adds to the lodge near it and not far from it', () => {
    let w = step(dragging(6), build, 0.1, shore);
    w = { ...w, logs: [log('b', 4)], drag: 'b' };
    const near = step(w, build, 0.1, shore);
    expect(near.lodge!.wood).toBe(3);
    const far = step({ ...w, beaver: { ...w.beaver, z: w.lodge!.z - LODGE_REACH - 3 } }, build, 0.1, shore);
    expect(far.lodge!.wood).toBe(2);
    expect(far.drag).toBe('b');
  });

  it('faces the entrance toward the deepest water', () => {
    expect(lodgeSite(shore, 0, -1, 0)!.door).toBeCloseTo(0);
  });
});

/** A whole lodge on the shore, with the beaver diving at its entrance and swimming in. */
function wholeLodge(): WorldState {
  let w = step(dragging(6), build, 0.1, shore);
  w = { ...w, lodge: { ...w.lodge!, wood: LODGE_WOOD } };
  const at = doorPoint(w.lodge!, DOOR_DISTANCE + 0.5);
  return { ...w, beaver: { ...w.beaver, ...at, y: -2, mode: 'dive' } };
}

describe('solid lodge', () => {
  it('stops a beaver walking into the dome', () => {
    let w = step(dragging(6), build, 0.1, shore);
    w = { ...w, beaver: { ...w.beaver, x: 8, z: w.lodge!.z } };
    for (let i = 0; i < 40; i++) w = step(w, { ...noIntent(), move: { x: -1, z: 0 } }, 0.1, shore);
    expect(Math.hypot(w.beaver.x - w.lodge!.x, w.beaver.z - w.lodge!.z)).toBeGreaterThanOrEqual(SOLID_RADIUS - 1e-6);
    expect(w.inLodge).toBe(false);
  });

  it('keeps a diver out of an unfinished lodge', () => {
    let w = wholeLodge();
    w = { ...w, lodge: { ...w.lodge!, wood: 2 } };
    const toward = { ...noIntent(), move: { x: -Math.sin(w.lodge!.door), z: -Math.cos(w.lodge!.door) }, dive: true };
    expect(step(w, toward, 0.1, shore).inLodge).toBe(false);
  });

  it('lets a diver swim in at the entrance of a whole lodge, and only there', () => {
    const w = wholeLodge();
    const door = w.lodge!.door;
    const toward = { ...noIntent(), move: { x: -Math.sin(door), z: -Math.cos(door) }, dive: true };
    const inside = step(w, toward, 0.1, shore);
    expect(inside.inLodge).toBe(true);
    expect(inside.beaver.mode).toBe('walk');
    expect(Math.hypot(inside.beaver.x - w.lodge!.x, inside.beaver.z - w.lodge!.z)).toBeLessThan(INTERIOR_RADIUS);
    const away = { ...w, beaver: { ...w.beaver, ...doorPoint(w.lodge!, 6) } };
    expect(step(away, toward, 0.1, shore).inLodge).toBe(false);
    const wrongSide = { ...w, beaver: { ...w.beaver, ...doorPoint(w.lodge!, -DOOR_DISTANCE - 0.5) } };
    expect(step(wrongSide, toward, 0.1, shore).inLodge).toBe(false);
  });

  it('stays in the room and walks round the water hole', () => {
    const w = wholeLodge();
    const door = w.lodge!.door;
    let inside = step(w, { ...noIntent(), move: { x: -Math.sin(door), z: -Math.cos(door) }, dive: true }, 0.1, shore);
    const l = w.lodge!;
    for (let i = 0; i < 60; i++) inside = step(inside, { ...noIntent(), move: { x: 0, z: 1 } }, 0.1, shore);
    expect(Math.hypot(inside.beaver.x - l.x, inside.beaver.z - l.z)).toBeLessThanOrEqual(INTERIOR_RADIUS + 1e-6);
    expect(Math.hypot(inside.beaver.x - l.x - HOLE.x, inside.beaver.z - l.z - HOLE.z)).toBeGreaterThanOrEqual(HOLE.radius + 0.5 - 1e-6);
    expect(inside.inLodge).toBe(true);
  });

  it('leaves only by the water hole: build at the hole dives out the entrance', () => {
    const w = wholeLodge();
    const l = w.lodge!;
    const inside = step(w, { ...noIntent(), move: { x: -Math.sin(l.door), z: -Math.cos(l.door) }, dive: true }, 0.1, shore);
    expect(step(inside, build, 0.1, shore).inLodge).toBe(true);
    expect(step({ ...inside, beaver: { ...inside.beaver, x: l.x + 3, z: l.z + 3 } }, build, 0.1, shore).inLodge).toBe(true);
    const atPool = { ...inside, beaver: { ...inside.beaver, x: l.x + HOLE.x, z: l.z + HOLE.z - HOLE.radius - 0.5 } };
    expect(atHole(l, atPool.beaver.x, atPool.beaver.z)).toBe(true);
    const out = step(atPool, build, 0.1, shore);
    expect(out.inLodge).toBe(false);
    expect(Math.hypot(out.beaver.x - l.x, out.beaver.z - l.z)).toBeGreaterThan(SOLID_RADIUS);
    expect(out.beaver.mode).toBe('dive');
  });

  it('sleeps only on the nest', () => {
    const w = { ...wholeLodge(), clock: 0.8 * 480 };
    const l = w.lodge!;
    const inside = step(w, { ...noIntent(), move: { x: -Math.sin(l.door), z: -Math.cos(l.door) }, dive: true }, 0.1, shore);
    expect(isNight(inside.clock)).toBe(true);
    expect(canSleep(inside)).toBe(false);
    const onNest = { ...inside, beaver: { ...inside.beaver, x: l.x + NEST.x, z: l.z + NEST.z } };
    expect(atNest(l, onNest.beaver.x, onNest.beaver.z)).toBe(true);
    expect(canSleep(onNest)).toBe(true);
  });
});

describe('followPond', () => {
  const lodge = { x: 5, z: 5, base: 1.5, door: 0, wood: 10, pond: 'a' };
  const ground = flatTerrain(0);

  it('puts the floor at the water of its pond as the pond rises and falls', () => {
    expect(followPond(lodge, [{ spot: 'a', level: 2 }], ground).base).toBe(2);
    expect(followPond(lodge, [{ spot: 'a', level: 1.2 }], ground).base).toBe(1.2);
  });

  it('rests on the ground when the pond has drained, and leaves a lake lodge alone', () => {
    expect(followPond(lodge, [], ground).base).toBe(0);
    const lake = { ...lodge, pond: undefined };
    expect(followPond(lake, [{ spot: 'a', level: 2 }], ground)).toBe(lake);
  });
});
