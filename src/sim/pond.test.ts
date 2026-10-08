import { describe, expect, it } from 'vitest';
import { noActions } from '../actions/actions';
import { LEVEL1_COST } from './dam';
import type { DamSpot } from './damSpots';
import { MIN_CREST, crestOf, floodPond, pondDepthAt, pondsOf, withPonds } from './pond';
import { createWorld } from './state';
import { step } from './step';
import type { Terrain } from './terrain';

/** A valley along x: the stream runs toward +x at z = 0, the ground rises 0.1 m per metre sideways and 0.02 per metre upstream (-x). */
const valley = (side = 0.1): Terrain => ({
  heightAt: (x, z) => side * Math.abs(z) - 0.02 * Math.min(x, 0) + 0.02 * Math.max(x, 0) * 0,
  isWater: () => false,
  waterDepth: () => 0,
});
const spot: DamSpot = { id: 'core:0:0', bed: { x: 0, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };

describe('floodPond', () => {
  it('holds water upstream of the dam line, at the crest above the bed, and none downstream', () => {
    const t = valley();
    const p = floodPond(t, spot, 1)!;
    expect(p.level).toBe(1);
    expect(p.area).toBeGreaterThan(300);
    expect(pondDepthAt([p], (x, z) => t.heightAt(x, z), -20, 0)).toBeCloseTo(1 - 0.4);
    expect(pondDepthAt([p], (x, z) => t.heightAt(x, z), 20, 0)).toBe(0);
    expect(pondDepthAt([p], (x, z) => t.heightAt(x, z), -20, 30)).toBe(0);
  });

  it('is bigger for a higher crest', () => {
    const t = valley();
    expect(floodPond(t, spot, 1)!.area).toBeGreaterThan(floodPond(t, spot, 0.5)!.area);
  });

  it('is none for a crest that is too low, and none where the valley is too wide and it spills', () => {
    expect(floodPond(valley(), spot, MIN_CREST - 0.01)).toBeNull();
    expect(floodPond(valley(0.002), spot, 1)).toBeNull();
  });
});

describe('ponds of dams', () => {
  it('rise as the dam is built and are none before it is started', () => {
    const t = valley();
    expect(pondsOf([], [spot], t)).toEqual([]);
    const part = pondsOf([{ spot: spot.id, wood: 4, mud: 2, rock: 1 }], [spot], t);
    const whole = pondsOf([{ spot: spot.id, ...LEVEL1_COST }], [spot], t);
    expect(part).toHaveLength(1);
    expect(part[0]!.level).toBeCloseTo(0.5);
    expect(whole[0]!.level).toBeCloseTo(1);
    expect(crestOf(undefined)).toBe(0);
  });

  it('add water to the ground for the beaver to swim in', () => {
    const t = valley();
    const wet = withPonds(t, pondsOf([{ spot: spot.id, ...LEVEL1_COST }], [spot], t));
    expect(wet.waterDepth(-20, 0)).toBeGreaterThan(0.5);
    expect(wet.isWater(-20, 0)).toBe(true);
    expect(wet.waterDepth(20, 0)).toBe(0);
    expect(wet.heightAt(-20, 0)).toBe(t.heightAt(-20, 0));
    expect(withPonds(t, [])).toBe(t);
  });
});

describe('placing the last piece', () => {
  it('makes the pond', () => {
    const t = valley();
    const dams = [{ spot: spot.id, wood: 8, mud: 4, rock: 1 }];
    const w = step({ ...createWorld(t, 2, 0), spots: [spot], dams, haul: { kind: 'rock' as const } }, { ...noActions(), build: true }, 0.1, t);
    expect(w.dams[0]).toMatchObject({ rock: 2 });
    expect(w.ponds).toHaveLength(1);
    expect(w.ponds[0]!.level).toBeCloseTo(1);
  });
});
