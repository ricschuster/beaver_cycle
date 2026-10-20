import { describe, expect, it } from 'vitest';
import { DAY_SECONDS, DAYS_PER_YEAR } from './clock';
import { lodgeComplete } from './lodge';
import { growNeighbours, neighboursAt, startFamilies, START_FAMILIES, type Neighbour } from './neighbours';
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

  it('are out by day with a mama, a papa, and kits, in the pond or on the bank right by it', () => {
    const families = seed().slice(0, 1);
    const all = neighboursAt(families, noon + day * 5, lake);
    expect(all.filter((b) => b.role === 'mama')).toHaveLength(1);
    expect(all.filter((b) => b.role === 'papa')).toHaveLength(1);
    expect(all.filter((b) => b.role === 'kit').length).toBeGreaterThan(0);
    for (let c = day * 20; c < day * 22; c += 7) {
      for (const b of neighboursAt(families, c, lake)) expect(b.x).toBeGreaterThan(300 - 4);
    }
  });

  it('go about errands on the bank too: gnawing on land by the water, and carrying a branch home', () => {
    const families = seed().slice(0, 1);
    const seen = new Set<string>();
    for (let c = day * 20; c < day * 24; c += 3) {
      for (const b of neighboursAt(families, c, lake)) {
        seen.add(`${b.task}:${b.carry}`);
        if (b.task === 'gnaw') {
          expect(lake.isWater(b.x, b.z)).toBe(false);
          expect(b.x).toBeGreaterThan(300 - 2.5);
          expect(b.mode).toBe('walk');
        }
      }
    }
    expect(seen.has('gnaw:null')).toBe(true);
    expect(seen.has('carry:branch')).toBe(true);
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

describe('a played baby', () => {
  it('leaves the first kit of this spring out of its family', () => {
    const [f] = seed();
    const t = DAYS_PER_YEAR * day * 2 + noon;
    const kits = (played: Set<string>) => neighboursAt([f!], t, lake, played).filter((b) => b.role === 'kit').map((b) => b.id);
    const all = kits(new Set());
    const without = kits(new Set([f!.id]));
    expect(all).toContain(`${f!.id}:kit:2:0`);
    expect(without).not.toContain(`${f!.id}:kit:2:0`);
    expect(without).toHaveLength(all.length - 1);
  });
});

describe('starting families', () => {
  const near = { x: 280, z: 0 };
  it('are up to four whole lodges close to the home, apart from each other, the same every time', () => {
    const found = startFamilies(lake, near);
    expect(found.length).toBeGreaterThan(0);
    expect(found.length).toBeLessThanOrEqual(START_FAMILIES);
    for (const a of found) {
      expect(lodgeComplete(a.lodge)).toBe(true);
      expect(Math.hypot(a.lodge.x - near.x, a.lodge.z - near.z)).toBeGreaterThanOrEqual(50);
      for (const b of found) if (a !== b) expect(Math.hypot(a.lodge.x - b.lodge.x, a.lodge.z - b.lodge.z)).toBeGreaterThanOrEqual(50);
    }
    expect(startFamilies(lake, near)).toEqual(found);
  });
  it('find nothing where there is no water', () => {
    expect(startFamilies(flatTerrain(0), near)).toEqual([]);
  });
});
