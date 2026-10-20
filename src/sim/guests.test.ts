import { describe, expect, it } from 'vitest';
import { newGuest, stepGuest, type Shared } from './guests';
import { noIntent } from './buttons';
import { CHOP_TIME, noTrees, type TreeSource } from './trees';
import { WALK_SPEED } from './state';
import { flatTerrain } from './terrain';

const ground = flatTerrain(0);
const shared: Shared = { felled: [], logs: [], clock: 0 };
const at = { x: 0, z: 0 };
const coat = { coat: 1, shade: 0 };
const tree = { id: 't1', x: 1, z: 0, wood: 4 };
const oneTree: TreeSource = {
  nearest: (_x, _z, _r, felled) => (felled.has('t1') ? null : tree),
  trunksNear: () => [],
};

describe('guest beavers', () => {
  it('walk where the intent points, at the walking speed, and face the way', () => {
    const g = newGuest('g1', at, ground, coat, undefined);
    const r = stepGuest(g, { ...noIntent(), move: { x: 1, z: 0 } }, 1, shared, ground, noTrees);
    expect(r.guest.beaver.x).toBeCloseTo(WALK_SPEED, 5);
    expect(r.guest.beaver.heading).toBeCloseTo(Math.PI / 2, 5);
    expect(r.guest.pace).toBe(1);
  });

  it('cannot move faster than the speed by pushing a long vector', () => {
    const g = newGuest('g1', at, ground, coat, undefined);
    const r = stepGuest(g, { ...noIntent(), move: { x: 50, z: 0 } }, 1, shared, ground, noTrees);
    expect(r.guest.beaver.x).toBeCloseTo(WALK_SPEED, 5);
  });

  it('slide round a trunk', () => {
    const g = newGuest('g1', at, ground, coat, undefined);
    const wall: TreeSource = { nearest: () => null, trunksNear: () => [{ x: 5, z: 0, radius: 1 }] };
    const r = stepGuest(g, { ...noIntent(), move: { x: 1, z: 0 } }, 1, shared, ground, wall);
    expect(r.guest.beaver.x).toBeLessThan(5);
  });

  it('gnaw a tree down standing still, and it is felled for all and lies as a log', () => {
    let g = newGuest('g1', at, ground, coat, undefined);
    let s = shared;
    const gnaw = { ...noIntent(), do: 'gnaw' as const };
    for (let t = 0; t < CHOP_TIME + 1; t += 0.5) {
      const r = stepGuest(g, gnaw, 0.5, s, ground, oneTree);
      g = r.guest;
      s = { ...s, felled: r.felled, logs: r.logs };
    }
    expect(s.felled).toEqual(['t1']);
    expect(s.logs).toHaveLength(1);
    expect(g.chop).toBeNull();
  });

  it('stop gnawing when they move', () => {
    let g = newGuest('g1', at, ground, coat, undefined);
    g = stepGuest(g, { ...noIntent(), do: 'gnaw' }, 1, shared, ground, oneTree).guest;
    expect(g.chop).not.toBeNull();
    g = stepGuest(g, { ...noIntent(), move: { x: 1, z: 0 }, do: 'gnaw' }, 0.1, shared, ground, oneTree).guest;
    expect(g.chop).toBeNull();
  });

  it('clean a look that is out of range', () => {
    const g = newGuest('g1', at, ground, coat, { hat: 99, scarf: -3, tail: 2, name: 'Pip' });
    expect(g.look).toMatchObject({ hat: 0, scarf: 0, tail: 2, name: 'Pip' });
  });
});
