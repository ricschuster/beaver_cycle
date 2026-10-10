import { describe, expect, it } from 'vitest';
import { noIntent, type Intent } from './buttons';
import { DRAG_GAP, DRAG_SPEED, FLOAT_DEPTH, distanceToLog, logLength } from './logs';
import { createWorld, type WorldState, WALK_SPEED } from './state';
import { step } from './step';
import { flatTerrain, type Terrain } from './terrain';
import { CHOP_REACH, CHOP_TIME, type TreeRef, type TreeSource } from './trees';

const flat = flatTerrain(0);

function source(list: TreeRef[]): TreeSource {
  return {
    nearest: (x, z, reach, felled) =>
      list.find((t) => !felled.has(t.id) && Math.hypot(t.x - x, t.z - z) <= reach) ?? null,
    trunksNear: () => [],
  };
}

const oak: TreeRef = { id: 'a', x: 1, z: 0, wood: 2 };
const press: Intent = { ...noIntent(), do: 'gnaw' };
const grab: Intent = { ...noIntent(), take: 'log' };
const letGo: Intent = { ...noIntent(), take: 'let-go' };

/** Press the gnaw button, then stand still for `seconds` in half second steps. */
function gnawFor(w: WorldState, trees: TreeSource, seconds: number): WorldState {
  let out = step(w, press, 0, flat, trees);
  for (let t = 0; t < seconds; t += 0.5) out = step(out, noIntent(), 0.5, flat, trees);
  return out;
}

describe('chop', () => {
  it('fells the tree after the chop time and leaves a log lying where it fell', () => {
    const w = gnawFor(createWorld(flat), source([oak]), CHOP_TIME);
    expect(w.felled).toEqual(['a']);
    expect(w.chop).toBeNull();
    expect(w.logs).toHaveLength(1);
    const log = w.logs[0]!;
    expect(log.id).toBe('a');
    expect(log.length).toBe(logLength(2));
    expect(log.floating).toBe(false);
    // it falls away from the beaver, its near end at the trunk
    expect(log.heading).toBeCloseTo(Math.PI / 2);
    expect(log.x).toBeCloseTo(1 + log.length / 2);
  });

  it('is still gnawing before the chop time', () => {
    const w = gnawFor(createWorld(flat), source([oak]), CHOP_TIME - 1);
    expect(w.felled).toEqual([]);
    expect(w.logs).toEqual([]);
    expect(w.chop?.id).toBe('a');
  });

  it('needs a tree in reach', () => {
    const far: TreeRef = { ...oak, x: CHOP_REACH + 1 };
    const w = gnawFor(createWorld(flat), source([far]), CHOP_TIME);
    expect(w.chop).toBeNull();
    expect(w.felled).toEqual([]);
  });

  it('stops when the beaver moves, and the tree stands', () => {
    const trees = source([oak]);
    let w = step(createWorld(flat), press, 0, flat, trees);
    w = step(w, { move: { x: 0, z: 1 } }, 0.5, flat, trees);
    expect(w.chop).toBeNull();
    w = step(w, noIntent(), CHOP_TIME, flat, trees);
    expect(w.felled).toEqual([]);
  });

  it('does not start while moving', () => {
    const w = step(createWorld(flat), { ...press, move: { x: 0, z: 1 } }, 0.1, flat, source([oak]));
    expect(w.chop).toBeNull();
  });

  it('does not fell the same tree twice', () => {
    const trees = source([oak]);
    const w = gnawFor(gnawFor(createWorld(flat), trees, CHOP_TIME), trees, CHOP_TIME);
    expect(w.felled).toEqual(['a']);
    expect(w.logs).toHaveLength(1);
  });

  it('does nothing without a tree source', () => {
    const w = step(createWorld(flat), press, 1, flat);
    expect(w.chop).toBeNull();
  });
});

describe('drag', () => {
  const felled = (): WorldState => gnawFor(createWorld(flat), source([oak]), CHOP_TIME);

  it('grabs a log in reach and lets go on the next press', () => {
    const w = step(felled(), grab, 0, flat);
    expect(w.drag).toBe('a');
    expect(step(w, letGo, 0, flat).drag).toBeNull();
  });

  it('cannot grab a log out of reach', () => {
    const w = { ...felled(), beaver: { ...felled().beaver, z: 40 } };
    expect(step(w, grab, 0, flat).drag).toBeNull();
  });

  it('takes one log at a time', () => {
    const base = felled();
    const other = { ...base.logs[0]!, id: 'b' };
    let w = step({ ...base, logs: [...base.logs, other] }, grab, 0, flat);
    const first = w.drag;
    w = step(w, letGo, 0, flat);
    w = step({ ...w, beaver: { ...w.beaver, x: other.x, z: 0 } }, grab, 0, flat);
    expect(first).not.toBeNull();
    expect(w.drag).not.toBeNull();
    expect(w.logs.filter((l) => l.id === w.drag)).toHaveLength(1);
  });

  it('drags the log behind the beaver, slower than a walk', () => {
    let w = step(felled(), grab, 0, flat);
    w = step(w, { move: { x: 0, z: 1 } }, 1, flat);
    expect(w.beaver.z).toBeCloseTo(WALK_SPEED * DRAG_SPEED);
    // after a few seconds it trails behind with its near end a gap from the beaver
    for (let i = 0; i < 40; i++) w = step(w, { move: { x: 0, z: 1 } }, 0.25, flat);
    const log = w.logs[0]!;
    expect(log.z).toBeLessThan(w.beaver.z);
    expect(distanceToLog(log, w.beaver.x, w.beaver.z)).toBeCloseTo(DRAG_GAP, 1);
  });

  it('leaves the log lying when let go, and a chop needs both free paws', () => {
    let w = step(felled(), grab, 0, flat);
    w = step(w, { move: { x: 0, z: 1 } }, 2, flat);
    w = step(w, letGo, 0, flat);
    const at = { x: w.logs[0]!.x, z: w.logs[0]!.z };
    w = step(w, noIntent(), 5, flat);
    expect(w.logs[0]).toMatchObject(at);
    let dragging = step(w, { ...grab, move: { x: 0, z: 0 } }, 0, flat);
    dragging = step(dragging, press, 0, flat, source([{ id: 'c', x: dragging.beaver.x, z: dragging.beaver.z, wood: 1 }]));
    expect(dragging.chop).toBeNull();
  });

  it('floats in deep water and rests on the ground in shallows', () => {
    const lake: Terrain = { heightAt: () => -5, isWater: (x) => x > 20, waterDepth: (x) => (x > 20 ? 5 : 0) };
    let w = step(felled(), grab, 0, lake);
    // walk the beaver to the water with the log in tow, mid stride so a swim begins
    w = { ...w, beaver: { ...w.beaver, x: 30, z: 0, mode: 'swim', y: -0.2 } };
    for (let i = 0; i < 20; i++) w = step(w, { move: { x: 1, z: 0 } }, 0.25, lake);
    expect(w.logs[0]!.floating).toBe(true);
    expect(w.logs[0]!.y).toBeGreaterThan(-0.5);
    expect(lake.waterDepth(30, 0)).toBeGreaterThan(FLOAT_DEPTH);
  });

  it('lets go when the beaver dives', () => {
    const lake: Terrain = { heightAt: () => -5, isWater: () => true, waterDepth: () => 5 };
    let w = step(felled(), grab, 0, flat);
    w = { ...w, beaver: { ...w.beaver, mode: 'swim', y: -0.2 } };
    expect(step(w, noIntent(), 0.1, lake).drag).toBe('a');
    expect(step(w, { ...noIntent(), dive: true }, 0.5, lake).drag).toBeNull();
  });
});
