import { describe, expect, it } from 'vitest';
import type { DamSpot } from './damSpots';
import { newSpotsFrom, withNewSpots } from './newSpots';
import { floodPond } from './pond';
import type { StreamPoint, Terrain } from './terrain';

/** A valley along x: the stream runs toward +x at z = 0, the ground rises 0.1 m per metre sideways and 0.02 per metre upstream (-x). */
const valley = (withLines = true): Terrain => ({
  heightAt: (x, z) => 0.1 * Math.abs(z) - 0.02 * Math.min(x, 0),
  isWater: () => false,
  waterDepth: () => 0,
  ...(withLines
    ? {
        streamDistance: (_x: number, z: number) => Math.abs(z),
        streamPoints: (x: number, _z: number, r: number, step: number): StreamPoint[] =>
          Array.from({ length: Math.floor((2 * r) / step) + 1 }, (_, i) => ({ x: x - r + i * step, z: 0, ux: 1, uz: 0 })),
      }
    : {}),
});
const spot: DamSpot = { id: 'core:0:0', bed: { x: 0, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };

describe('newSpotsFrom', () => {
  it('finds spots on the stream upstream of a pond, clear of the spots known and of each other', () => {
    const t = valley();
    const pond = floodPond(t, spot, 1)!;
    const found = newSpotsFrom(t, pond, [spot]);
    expect(found.length).toBeGreaterThan(0);
    for (const s of found) {
      expect(s.id.startsWith('core:')).toBe(true);
      expect(s.bed.x).toBeLessThan(-pond.area / 40); // beyond the water
      expect(s.maxCrest).toBeGreaterThanOrEqual(1);
      expect(s.widths?.[0]).toBeGreaterThan(0);
      expect(Math.hypot(s.bed.x - spot.bed.x, s.bed.z - spot.bed.z)).toBeGreaterThanOrEqual(45);
    }
    for (const a of found) for (const b of found) if (a !== b) expect(Math.hypot(a.bed.x - b.bed.x, a.bed.z - b.bed.z)).toBeGreaterThanOrEqual(45);
  });

  it('gives none on a ground without stream lines, or for a pond whose spot is not known', () => {
    const pond = floodPond(valley(), spot, 1)!;
    expect(newSpotsFrom(valley(false), pond, [spot])).toEqual([]);
    expect(newSpotsFrom(valley(), pond, [])).toEqual([]);
  });

  it('is none the second time, once the spots are known', () => {
    const t = valley();
    const pond = floodPond(t, spot, 1)!;
    const once = withNewSpots([spot], [pond], t);
    expect(once.length).toBeGreaterThan(1);
    expect(withNewSpots(once, [pond], t)).toBe(once);
  });
});
