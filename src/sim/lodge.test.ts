import { describe, expect, it } from 'vitest';
import { noActions, type Actions } from '../actions/actions';
import { CHAMBER_RADIUS, DOOR_DISTANCE, LODGE_REACH, LODGE_WOOD, SOLID_RADIUS, addWood, doorPoint, checkSite, lodgeComplete, lodgeProgress, lodgeSite, logWood } from './lodge';
import type { Log } from './logs';
import { createWorld, type WorldState } from './state';
import { step } from './step';
import type { Terrain } from './terrain';

/** Dry land for z < 0, then a lake whose depth grows 0.5 m per metre south of the shore (z = 0), so it is deep from z = 3. */
const shore: Terrain = {
  heightAt: () => 0,
  isWater: (_x, z) => z >= 0,
  waterDepth: (_x, z) => Math.max(0, z * 0.5),
};

const build: Actions = { ...noActions(), build: true };
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
    for (let i = 0; i < 40; i++) w = step(w, { ...noActions(), move: { x: -1, z: 0 } }, 0.1, shore);
    expect(Math.hypot(w.beaver.x - w.lodge!.x, w.beaver.z - w.lodge!.z)).toBeGreaterThanOrEqual(SOLID_RADIUS - 1e-6);
    expect(w.inLodge).toBe(false);
  });

  it('keeps a diver out of an unfinished lodge', () => {
    let w = wholeLodge();
    w = { ...w, lodge: { ...w.lodge!, wood: 2 } };
    const toward = { ...noActions(), move: { x: -Math.sin(w.lodge!.door), z: -Math.cos(w.lodge!.door) }, dive: true };
    expect(step(w, toward, 0.1, shore).inLodge).toBe(false);
  });

  it('lets a diver swim in at the entrance of a whole lodge, and only there', () => {
    const w = wholeLodge();
    const door = w.lodge!.door;
    const toward = { ...noActions(), move: { x: -Math.sin(door), z: -Math.cos(door) }, dive: true };
    const inside = step(w, toward, 0.1, shore);
    expect(inside.inLodge).toBe(true);
    expect(inside.beaver.mode).toBe('walk');
    expect(Math.hypot(inside.beaver.x - w.lodge!.x, inside.beaver.z - w.lodge!.z)).toBeLessThan(CHAMBER_RADIUS);
    const away = { ...w, beaver: { ...w.beaver, ...doorPoint(w.lodge!, 6) } };
    expect(step(away, toward, 0.1, shore).inLodge).toBe(false);
    const wrongSide = { ...w, beaver: { ...w.beaver, ...doorPoint(w.lodge!, -DOOR_DISTANCE - 0.5) } };
    expect(step(wrongSide, toward, 0.1, shore).inLodge).toBe(false);
  });

  it('stays in the chamber, and leaves by the build button or by pushing out the entrance', () => {
    const w = wholeLodge();
    const door = w.lodge!.door;
    let inside = step(w, { ...noActions(), move: { x: -Math.sin(door), z: -Math.cos(door) }, dive: true }, 0.1, shore);
    for (let i = 0; i < 30; i++) inside = step(inside, { ...noActions(), move: { x: 0, z: -1 } }, 0.1, shore);
    expect(Math.hypot(inside.beaver.x - w.lodge!.x, inside.beaver.z - w.lodge!.z)).toBeLessThanOrEqual(CHAMBER_RADIUS + 1e-6);
    expect(inside.inLodge).toBe(true);
    const byButton = step(inside, build, 0.1, shore);
    expect(byButton.inLodge).toBe(false);
    expect(Math.hypot(byButton.beaver.x - w.lodge!.x, byButton.beaver.z - w.lodge!.z)).toBeGreaterThan(SOLID_RADIUS);
    let out = inside;
    for (let i = 0; i < 30 && out.inLodge; i++) out = step(out, { ...noActions(), move: { x: Math.sin(door), z: Math.cos(door) } }, 0.1, shore);
    expect(out.inLodge).toBe(false);
  });
});
