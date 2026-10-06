import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { DAY_SECONDS, DAYS_PER_SEASON } from './clock';
import { LILY_DENSITY, LILY_MAX_DEPTH, LILY_MIN_DEPTH, LILY_REACH, lilyPadsNear, pickedPad, reachablePad } from './lily';
import { createWorld } from './state';
import { step } from './step';
import type { Terrain } from './terrain';

/** A lake everywhere, 1.5 m deep. */
const lake: Terrain = { heightAt: () => 0, isWater: () => true, waterDepth: () => 1.5 };
const summer = DAY_SECONDS * DAYS_PER_SEASON * 1.5;
const winter = DAY_SECONDS * DAYS_PER_SEASON * 3.5;

describe('lily pads', () => {
  it('lie in the same places every time, about as dense as set', () => {
    const a = lilyPadsNear(lake, 0, 0, 50, summer);
    expect(lilyPadsNear(lake, 0, 0, 50, summer)).toEqual(a);
    const cells = (100 / 5) ** 2;
    expect(a.length).toBeGreaterThan(cells * LILY_DENSITY * 0.5);
    expect(a.length).toBeLessThan(cells * LILY_DENSITY * 1.5);
  });

  it('grow only in water of the right depth', () => {
    for (const depth of [LILY_MIN_DEPTH - 0.1, LILY_MAX_DEPTH + 0.1, 0]) {
      expect(lilyPadsNear({ ...lake, waterDepth: () => depth }, 0, 0, 50, summer)).toEqual([]);
    }
  });

  it('die back in winter and are there again in spring', () => {
    expect(lilyPadsNear(lake, 0, 0, 50, winter)).toEqual([]);
    expect(lilyPadsNear(lake, 0, 0, 50, winter + DAY_SECONDS * DAYS_PER_SEASON).length).toBeGreaterThan(0);
  });

  it('a picked pad is gone this year and back the next', () => {
    const pad = reachablePadNearby();
    const picked = pickedPad({}, pad, summer);
    expect(lilyPadsNear(lake, pad.x, pad.z, 1, summer, picked)).toEqual([]);
    expect(lilyPadsNear(lake, pad.x, pad.z, 1, summer + DAY_SECONDS * 40, picked)).toContainEqual(pad);
  });
});

function reachablePadNearby() {
  return lilyPadsNear(lake, 0, 0, 50, summer)[0]!;
}

describe('picking a lily pad', () => {
  const pad = reachablePadNearby();
  const at = (clock: number) => {
    const w = createWorld(lake, pad.x + 0.5, pad.z);
    return { ...w, clock };
  };

  it('gnawing next to a pad puts it in the mouth, and it is gone from the water', () => {
    const w = step(at(summer), { ...noActions(), chop: true }, 0.1, lake);
    expect(w.carry).toBe('lily');
    expect(reachablePad(lake, pad.x, pad.z, w.clock, w.picked)).toBeNull();
  });

  it('does nothing in winter, with a full mouth, or out of reach', () => {
    expect(step(at(winter), { ...noActions(), chop: true }, 0.1, lake).carry).toBeNull();
    expect(step({ ...at(summer), carry: 'branch' }, { ...noActions(), chop: true }, 0.1, lake).carry).toBe('branch');
    const far = at(summer);
    const moved = { ...far, beaver: { ...far.beaver, x: pad.x + LILY_REACH + 3, z: pad.z + 3 } };
    expect(reachablePad(lake, moved.beaver.x, moved.beaver.z, summer, {})).toBeNull();
  });
});
