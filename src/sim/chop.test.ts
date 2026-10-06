import { describe, expect, it } from 'vitest';
import { noActions, type Actions } from '../actions/actions';
import { createWorld, type WorldState } from './state';
import { step } from './step';
import { flatTerrain } from './terrain';
import { CARRY_MAX, CHOP_REACH, CHOP_TIME, type TreeRef, type TreeSource } from './trees';

const flat = flatTerrain(0);

function source(list: TreeRef[]): TreeSource {
  return {
    nearest: (x, z, reach, felled) =>
      list.find((t) => !felled.has(t.id) && Math.hypot(t.x - x, t.z - z) <= reach) ?? null,
  };
}

const oak: TreeRef = { id: 'a', x: 1, z: 0, wood: 2 };
const press: Actions = { ...noActions(), chop: true };

/** Press the gnaw button, then stand still for `seconds` in half second steps. */
function gnawFor(w: WorldState, trees: TreeSource, seconds: number): WorldState {
  let out = step(w, press, 0, flat, trees);
  for (let t = 0; t < seconds; t += 0.5) out = step(out, noActions(), 0.5, flat, trees);
  return out;
}

describe('chop', () => {
  it('fells the tree after the chop time and carries its logs', () => {
    const w = gnawFor(createWorld(flat), source([oak]), CHOP_TIME);
    expect(w.felled).toEqual(['a']);
    expect(w.carry.wood).toBe(2);
    expect(w.chop).toBeNull();
  });

  it('is still gnawing before the chop time', () => {
    const w = gnawFor(createWorld(flat), source([oak]), CHOP_TIME - 1);
    expect(w.felled).toEqual([]);
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
    w = step(w, noActions(), CHOP_TIME, flat, trees);
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
    expect(w.carry.wood).toBe(2);
  });

  it('does not start with full paws, and caps what it carries', () => {
    const full: WorldState = { ...createWorld(flat), carry: { wood: CARRY_MAX } };
    expect(gnawFor(full, source([oak]), CHOP_TIME).felled).toEqual([]);
    const nearly: WorldState = { ...createWorld(flat), carry: { wood: CARRY_MAX - 1 } };
    expect(gnawFor(nearly, source([oak]), CHOP_TIME).carry.wood).toBe(CARRY_MAX);
  });

  it('does nothing without a tree source', () => {
    const w = step(createWorld(flat), press, 1, flat);
    expect(w.chop).toBeNull();
  });
});
