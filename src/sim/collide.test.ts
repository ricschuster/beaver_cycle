import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { LOG_HEIGHT, LOG_RADIUS, climbLift, distanceToLog, pushFloating, type Log } from './logs';
import { createWorld, type WorldState } from './state';
import { step } from './step';
import { flatTerrain, type Terrain } from './terrain';
import { BEAVER_RADIUS, avoidTrunks, noTrees, type TreeSource } from './trees';

const flat = flatTerrain(0);
const lake: Terrain = { heightAt: () => -5, isWater: () => true, waterDepth: () => 5 };

const log = (over: Partial<Log> = {}): Log => ({ id: 'a', x: 0, y: 0.3, z: 5, heading: Math.PI / 2, length: 4, floating: false, ...over });

describe('trunks', () => {
  const trunk = { x: 0, z: 5, radius: 0.5 };

  it('pushes a point out of a trunk and leaves a clear one alone', () => {
    const out = avoidTrunks(0, 4.8, [trunk]);
    expect(Math.hypot(out.x - trunk.x, out.z - trunk.z)).toBeCloseTo(trunk.radius + BEAVER_RADIUS);
    expect(out.z).toBeLessThan(5);
    expect(avoidTrunks(0, 3, [trunk])).toEqual({ x: 0, z: 3 });
  });

  it('stops the beaver walking into a tree', () => {
    const trees: TreeSource = { ...noTrees, trunksNear: () => [trunk] };
    let w = createWorld(flat);
    for (let i = 0; i < 40; i++) w = step(w, { move: { x: 0, z: 1 } }, 0.1, flat, trees);
    expect(w.beaver.z).toBeLessThanOrEqual(5 - trunk.radius - BEAVER_RADIUS + 1e-6);
    expect(w.beaver.z).toBeGreaterThan(3);
  });

  it('slides round a trunk when walking at it off centre', () => {
    const trees: TreeSource = { ...noTrees, trunksNear: () => [trunk] };
    let w = createWorld(flat, 0.3, 0);
    for (let i = 0; i < 80; i++) w = step(w, { move: { x: 0, z: 1 } }, 0.1, flat, trees);
    expect(w.beaver.z).toBeGreaterThan(8);
  });
});

describe('logs on land', () => {
  it('lifts a beaver standing on a log to the top of it, and not far from it', () => {
    expect(climbLift([log()], 0, 5, null)).toBeCloseTo(LOG_HEIGHT);
    expect(climbLift([log()], 0, 5 + LOG_RADIUS + 2, null)).toBe(0);
    const edge = climbLift([log()], 0, 5 + LOG_RADIUS + 0.3, null);
    expect(edge).toBeGreaterThan(0);
    expect(edge).toBeLessThan(LOG_HEIGHT);
  });

  it('does not lift for a log that floats or is being dragged', () => {
    expect(climbLift([log({ floating: true })], 0, 5, null)).toBe(0);
    expect(climbLift([log()], 0, 5, 'a')).toBe(0);
  });

  it('walks over a log: higher on it, back on the ground after', () => {
    let w: WorldState = { ...createWorld(flat, 0, 0), logs: [log()] };
    let top = 0;
    for (let i = 0; i < 40; i++) {
      w = step(w, { move: { x: 0, z: 1 } }, 0.1, flat);
      top = Math.max(top, w.beaver.y);
    }
    expect(top).toBeCloseTo(LOG_HEIGHT);
    expect(w.beaver.z).toBeGreaterThan(5 + LOG_RADIUS + 1);
    expect(w.beaver.y).toBe(0);
  });
});

describe('logs in water', () => {
  it('pushes a floating log away from a swimmer', () => {
    const f = log({ floating: true, y: -0.1 });
    const out = pushFloating(lake, [f], 0, 4.7, false, null)[0]!;
    expect(out.z).toBeGreaterThan(f.z);
    expect(distanceToLog(out, 0, 4.7)).toBeGreaterThanOrEqual(LOG_RADIUS + BEAVER_RADIUS - 1e-6);
    expect(out.floating).toBe(true);
  });

  it('leaves a log alone that is clear, grounded, dragged, or over a diver', () => {
    const f = log({ floating: true });
    expect(pushFloating(lake, [f], 0, 0, false, null)[0]).toBe(f);
    expect(pushFloating(lake, [f], 0, 4.7, true, null)[0]).toBe(f);
    expect(pushFloating(lake, [f], 0, 4.7, false, 'a')[0]).toBe(f);
    const g = log();
    expect(pushFloating(lake, [g], 0, 4.7, false, null)[0]).toBe(g);
  });

  it('shoves the log ahead of a swimmer as it swims into it', () => {
    let w: WorldState = { ...createWorld(lake, 0, 0), logs: [log({ floating: true })] };
    for (let i = 0; i < 30; i++) w = step(w, { move: { x: 0, z: 1 } }, 0.1, lake);
    expect(w.logs[0]!.z).toBeGreaterThan(5);
    expect(w.beaver.z).toBeGreaterThan(5);
  });

  it('does not move anything on a calm beaver', () => {
    const w: WorldState = { ...createWorld(lake, 0, 0), logs: [log({ floating: true })] };
    expect(step(w, noActions(), 1, lake).logs[0]).toEqual(w.logs[0]);
  });
});
