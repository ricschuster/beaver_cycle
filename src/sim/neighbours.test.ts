import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, DAYS_PER_YEAR } from './clock';
import { lodgeComplete } from './lodge';
import { growNeighbours, neighboursAt, type Neighbour } from './neighbours';
import { flatTerrain, type Terrain } from './terrain';

/** A lake east of x = 300 that deepens 0.2 m per metre to 6 m. */
const lake: Terrain = {
  heightAt: () => 0,
  isWater: (x) => x > 300,
  waterDepth: (x) => (x <= 300 ? 0 : Math.min(6, (x - 300) * 0.2)),
};
/** The families found by walking along the shore, every 100 m. */
const seed = (ground: Terrain = lake, avoid: readonly Neighbour[] = []): Neighbour[] => {
  const tried = new Set<string>();
  let families: readonly Neighbour[] = avoid;
  for (let z = -4000; z <= 4000; z += 100) families = growNeighbours(families, ground, { x: 300, z }, home, tried);
  return families.filter((f) => !avoid.includes(f));
};
const home = { x: 0, z: 0 };
const day = DAY_SECONDS;
const noon = day * 0.3;

describe('neighbour families', () => {
  it('find families at ponds as the player passes, each with a whole lodge far from home', () => {
    const found = seed();
    expect(found.length).toBeGreaterThan(2);
    for (const n of found) {
      expect(lodgeComplete(n.lodge)).toBe(true);
      expect(Math.hypot(n.lodge.x - home.x, n.lodge.z - home.z)).toBeGreaterThanOrEqual(120);
    }
  });

  it('are the same every time', () => {
    expect(seed()).toEqual(seed());
  });

  it('find nothing where there is no water', () => {
    expect(seed(flatTerrain(0))).toEqual([]);
  });

  it('look at each cell once', () => {
    const tried = new Set<string>();
    const first = growNeighbours([], lake, { x: 300, z: 1000 }, home, tried);
    expect(growNeighbours(first, lake, { x: 300, z: 1000 }, home, tried)).toBe(first);
  });

  it('keep 150 m from each other', () => {
    const found = seed();
    for (const a of found) for (const b of found) if (a !== b) expect(Math.hypot(a.lodge.x - b.lodge.x, a.lodge.z - b.lodge.z)).toBeGreaterThanOrEqual(150);
  });

  it('swim in the pond by day with a mama, a papa, and kits', () => {
    const families = seed().slice(0, 1);
    const all = neighboursAt(families, noon + day * 5, lake);
    expect(all.filter((b) => b.role === 'mama')).toHaveLength(1);
    expect(all.filter((b) => b.role === 'papa')).toHaveLength(1);
    expect(all.filter((b) => b.role === 'kit').length).toBeGreaterThan(0);
    for (const b of all) expect(lake.isWater(b.x, b.z)).toBe(true);
  });

  it('sleep in the lodge at night', () => {
    expect(neighboursAt(seed(), day * 0.8, lake)).toEqual([]);
  });

  it('grow the kits on the clock, and let them go when grown', () => {
    const families = seed().slice(0, 1);
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
    const families = seed().slice(0, 1);
    expect(neighboursAt(families, noon + 1000, lake)).toEqual(neighboursAt(families, noon + 1000, lake));
  });
});
