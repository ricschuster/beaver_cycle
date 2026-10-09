import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, DAYS_PER_YEAR } from './clock';
import type { DamSpot } from './damSpots';
import { lodgeComplete } from './lodge';
import { neighboursAt, seedNeighbours } from './neighbours';
import { flatTerrain, type Terrain } from './terrain';

/** A lake east of x = 300 that deepens 0.2 m per metre to 6 m. */
const lake: Terrain = {
  heightAt: () => 0,
  isWater: (x) => x > 300,
  waterDepth: (x) => (x <= 300 ? 0 : Math.min(6, (x - 300) * 0.2)),
};
const spot = (id: string, x: number, z: number): DamSpot => ({ id, bed: { x, z } }) as DamSpot;
const spots = [spot('a', 310, 0), spot('b', 330, 400)];
const home = { x: 0, z: 0 };
const day = DAY_SECONDS;
const noon = day * 0.3;

describe('neighbour families', () => {
  it('put one family at a pond far from home, with a whole lodge', () => {
    const [n, ...rest] = seedNeighbours(spots, home, lake);
    expect(rest).toEqual([]);
    expect(lodgeComplete(n!.lodge)).toBe(true);
    expect(Math.hypot(n!.lodge.x - home.x, n!.lodge.z - home.z)).toBeGreaterThanOrEqual(120);
  });

  it('are the same every time', () => {
    expect(seedNeighbours(spots, home, lake)).toEqual(seedNeighbours(spots, home, lake));
  });

  it('need water to live in', () => {
    expect(seedNeighbours(spots, home, flatTerrain(0))).toEqual([]);
  });

  it('keep away from lodges to avoid', () => {
    const [n] = seedNeighbours(spots, home, lake);
    const other = seedNeighbours(spots, home, lake, 1, [n!.lodge]);
    expect(other.every((o) => Math.hypot(o.lodge.x - n!.lodge.x, o.lodge.z - n!.lodge.z) >= 150)).toBe(true);
  });

  it('swim in the pond by day with a mama, a papa, and kits', () => {
    const families = seedNeighbours(spots, home, lake);
    const all = neighboursAt(families, noon + day * 5, lake);
    expect(all.filter((b) => b.role === 'mama')).toHaveLength(1);
    expect(all.filter((b) => b.role === 'papa')).toHaveLength(1);
    expect(all.filter((b) => b.role === 'kit').length).toBeGreaterThan(0);
    for (const b of all) expect(lake.isWater(b.x, b.z)).toBe(true);
  });

  it('sleep in the lodge at night', () => {
    expect(neighboursAt(seedNeighbours(spots, home, lake), day * 0.8, lake)).toEqual([]);
  });

  it('grow the kits on the clock, and let them go when grown', () => {
    const families = seedNeighbours(spots, home, lake);
    const kits = (clock: number) => neighboursAt(families, clock, lake).filter((b) => b.role === 'kit');
    // The litter of the year before is still teenagers in the first days of the year; this year's is newborn.
    const young = kits(noon + day * 2).filter((k) => k.id.includes(':kit:0:'));
    expect(young.length).toBeGreaterThan(0);
    expect(young.every((k) => k.stage === 'baby')).toBe(true);
    expect(young[0]!.scale).toBeLessThan(0.5);
    const teens = kits(noon + day * 40);
    expect(teens.some((k) => k.stage === 'teenager')).toBe(true);
    // A year on, the first litter is grown and gone; a new one is a baby.
    const later = kits(noon + day * (DAYS_PER_YEAR + 5));
    expect(later.some((k) => k.stage === 'baby')).toBe(true);
    expect(later.every((k) => k.stage !== 'adult')).toBe(true);
    expect(new Set(later.map((k) => k.id)).size).toBe(later.length);
  });

  it('give the same beavers for the same clock', () => {
    const families = seedNeighbours(spots, home, lake);
    expect(neighboursAt(families, noon + 1000, lake)).toEqual(neighboursAt(families, noon + 1000, lake));
  });
});
