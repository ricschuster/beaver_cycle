import { describe, expect, it } from 'vitest';
import { noIntent } from './buttons';
import { LEVEL1_COST } from './dam';
import type { DamSpot } from './damSpots';
import { MIN_CREST, crestOf, floodPond, lodgeGround, pondAt, pondDepthAt, pondsAt, pondsOf, withPonds } from './pond';
import { DAY_SECONDS } from './clock';
import { newWear } from './wear';
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

  it('puts the dam line through the channel bed point when the spot has one, not the drawn line point', () => {
    const t = valley();
    // The drawn line point sits 6 m upstream of the channel bed point: the pond stops at the channel point's dam line.
    const drawn: DamSpot = { ...spot, bed: { x: -6, z: 0 }, channel: { x: 0, z: 0 } };
    const p = floodPond(t, drawn, 1)!;
    expect(pondDepthAt([p], (x, z) => t.heightAt(x, z), -3, 0)).toBeGreaterThan(0);
    expect(pondDepthAt([p], (x, z) => t.heightAt(x, z), 3, 0)).toBe(0);
    const byLine = floodPond(t, { ...drawn, channel: undefined }, 1)!;
    expect(pondDepthAt([byLine], (x, z) => t.heightAt(x, z), -3, 0)).toBe(0);
    expect(p.area).toBeGreaterThan(byLine.area);
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
    expect(pondsOf([], [spot], t).ponds).toEqual([]);
    const part = pondsOf([{ spot: spot.id, wood: 4, mud: 2, rock: 1 }], [spot], t).ponds;
    const whole = pondsOf([{ spot: spot.id, ...LEVEL1_COST }], [spot], t).ponds;
    expect(part).toHaveLength(1);
    expect(part[0]!.level).toBeCloseTo(0.5);
    expect(whole[0]!.level).toBeCloseTo(1);
    expect(crestOf(undefined)).toBe(0);
  });

  it('add water to the ground for the beaver to swim in', () => {
    const t = valley();
    const wet = withPonds(t, pondsOf([{ spot: spot.id, ...LEVEL1_COST }], [spot], t).ponds);
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
    const w = step({ ...createWorld(t, 2, 0), spots: [spot], dams, haul: { kind: 'rock' as const } }, { ...noIntent(), do: 'build' }, 0.1, t);
    expect(w.dams[0]).toMatchObject({ rock: 2 });
    expect(w.ponds).toHaveLength(1);
    expect(w.ponds[0]!.level).toBeCloseTo(1);
  });
});

describe('a pond follows the wear of its dam', () => {
  const t = valley();
  const whole = (age: number) => ({ spot: spot.id, ...LEVEL1_COST, wear: newWear(-age * DAY_SECONDS) });
  const crestAt = (age: number) => crestOf(whole(age), 0);

  it('holds the full crest while the dam is good, then sags and drains to nothing', () => {
    expect(crestAt(0)).toBeCloseTo(1);
    expect(crestAt(9)).toBeCloseTo(1); // still good above 0.5 condition (a season is 10 days)
    expect(crestAt(10.5)).toBeLessThan(1);
    expect(crestAt(10.5)).toBeGreaterThan(crestAt(14));
    expect(crestAt(14)).toBeGreaterThan(0);
    expect(crestAt(20)).toBe(0);
    expect(crestAt(40)).toBe(0);
  });

  it('rises on from the level below when a dam is raised, and wears from the crest of its level', () => {
    const raising = (wood: number) => ({ spot: spot.id, level: 2 as const, wood, mud: 4, rock: 2 });
    expect(crestOf(raising(8))).toBeCloseTo(1); // just raised, nothing added
    expect(crestOf(raising(14))).toBeGreaterThan(1);
    expect(crestOf(raising(14))).toBeLessThan(1.5);
    const level2 = { spot: spot.id, level: 2 as const, wood: 14, mud: 8, rock: 5, wear: newWear(0) };
    expect(crestOf(level2, 0)).toBeCloseTo(1.5);
    expect(crestOf({ ...level2, level: 3 }, 0)).toBeLessThan(2); // level 3 with the level 2 set is a third of the way
    expect(crestOf(level2, 15 * DAY_SECONDS)).toBeCloseTo(0.75, 1); // condition 0.25: half the crest, sagging from 1.5 m
  });

  it('is no pond once drained, and a mended dam brings it back', () => {
    expect(pondsOf([whole(30)], [spot], t, 0).ponds).toEqual([]);
    expect(pondsOf([whole(0)], [spot], t, 0).ponds).toHaveLength(1);
  });

  it('is worked out again only when the crest moves a step', () => {
    const dam = whole(0);
    const first = pondsOf([dam], [spot], t, 0);
    expect(pondsAt(first, [dam], [spot], t, 1 * DAY_SECONDS)).toBe(first);
    const later = pondsAt(first, [dam], [spot], t, 12 * DAY_SECONDS);
    expect(later).not.toBe(first);
    expect(later.ponds[0]!.level).toBeLessThan(first.ponds[0]!.level);
    const drained = pondsOf([whole(30)], [spot], t, 0);
    expect(pondsAt(drained, [whole(30)], [spot], t, 0)).toBe(drained);
  });
});

describe('lodge in a pond', () => {
  it('sees the water of a level 2 pond but not of a level 1 pond', () => {
    const t = valley();
    const one = floodPond(t, spot, 1.0)!;
    const two = floodPond(t, spot, 1.5)!;
    expect(lodgeGround(t, [one]).waterDepth(-20, 0)).toBe(0);
    expect(lodgeGround(t, [two]).waterDepth(-20, 0)).toBeCloseTo(1.5 - 0.4);
  });

  it('finds the pond that covers a point, and none outside', () => {
    const p = floodPond(valley(), spot, 1.0)!;
    expect(pondAt([p], -20, 0)).toBe(p);
    expect(pondAt([p], 20, 0)).toBeUndefined();
  });
});
