import { describe, expect, it } from 'vitest';
import type { Animal } from './animals';
import { DAY_SECONDS } from './clock';
import { LODGE_WOOD } from './lodge';
import { CURIOUS_CLOSE, CURIOUS_FROM, FEED_REACH, WARY_BELOW, banishFox, boltingDeer, feedAnimals, foxesAtStore, moodOf, moodOfAnimal, react, startle, storeFoxSpot, trustOf } from './moods';
import { createWorld, type WorldState } from './state';
import { flatTerrain, type Terrain } from './terrain';
import { storeSpot } from './food';

const land = flatTerrain(0);
const deer = (x: number, z: number, id = '1:1'): Animal => ({ id, kind: 'deer', x, y: 0, z, heading: 0, moving: false });
const fox = (x: number, z: number, id = '2:2'): Animal => ({ id, kind: 'fox', x, y: 0, z, heading: 0, moving: false });
const world = (): WorldState => createWorld(land, 0, 0);
const dist = (a: Animal, w: WorldState): number => Math.hypot(a.x - w.beaver.x, a.z - w.beaver.z);

describe('mood', () => {
  it('follows from trust, and a deer starts wary', () => {
    expect(moodOf(WARY_BELOW - 0.01)).toBe('wary');
    expect(moodOf(0.5)).toBe('calm');
    expect(moodOf(CURIOUS_FROM)).toBe('curious');
    expect(moodOfAnimal(world(), deer(0, 0))).toBe('wary');
    expect(trustOf({ trust: { '1:1': 0.9 } }, deer(0, 0))).toBe(0.9);
  });

  it('shows: a wary deer keeps its distance, a calm one lets the beaver come close, a curious one comes to look', () => {
    const w = world();
    const wary = react([deer(8, 0)], w, land)[0]!;
    expect(dist(wary, w)).toBeGreaterThanOrEqual(14 - 1e-6);
    expect(wary.moving).toBe(true);
    const calm = react([deer(8, 0)], { ...w, trust: { '1:1': 0.5 } }, land)[0]!;
    expect(calm.x).toBe(8);
    const curious = react([deer(25, 0)], { ...w, trust: { '1:1': 0.9 } }, land)[0]!;
    expect(dist(curious, w)).toBeLessThan(25);
    expect(dist(curious, w)).toBeGreaterThanOrEqual(CURIOUS_CLOSE - 1e-6);
  });

  it('does not push a wary animal onto ground that is not its own', () => {
    const lake: Terrain = { heightAt: () => 0, isWater: (x) => x > 10, waterDepth: (x) => (x > 10 ? 2 : 0) };
    const out = react([deer(8, 0)], world(), lake)[0]!;
    expect(out.x).toBe(8);
  });
});

describe('reading the deer', () => {
  it('has a deer bolt from a predator near it', () => {
    const w = world();
    const out = react([deer(30, 0), fox(20, 0)], { ...w, trust: { '1:1': 0.5 } }, land);
    const d = out.find((a) => a.kind === 'deer')!;
    expect(Math.hypot(d.x - 20, d.z)).toBeGreaterThanOrEqual(36 - 1e-6);
    expect(d.moving).toBe(true);
    expect(boltingDeer(out, w)).not.toBeNull();
  });

  it('leaves a deer alone when no predator is near', () => {
    const w = { ...world(), trust: { '1:1': 0.5 } };
    expect(boltingDeer(react([deer(30, 0), fox(150, 0)], w, land), w)).toBeNull();
  });
});

describe('feeding', () => {
  const dropped = (kind: 'branch' | 'lily' | 'mud', x: number) => ({ id: 'drop:1', kind, at: 0, x, z: 0 });

  it('has a deer eat a branch put down near it, and trust the beaver more', () => {
    const w = { ...world(), dropped: [dropped('branch', 1)] };
    const r = feedAnimals(w, [deer(10, 0)]);
    expect(r.fed).toHaveLength(1);
    expect(r.world.dropped).toHaveLength(0);
    expect(r.world.trust['1:1']).toBeCloseTo(0.4);
  });

  it('leaves food out of reach, mud, and a branch a duck will not take', () => {
    const w = { ...world(), dropped: [dropped('branch', 1), dropped('mud', 1)] };
    expect(feedAnimals(w, [deer(1 + FEED_REACH + 2, 0)]).fed).toHaveLength(0);
    expect(feedAnimals(w, [{ ...deer(5, 0), kind: 'duck' }]).fed).toHaveLength(0);
    expect(feedAnimals(w, [deer(5, 0)]).world.dropped).toHaveLength(1);
  });

  it('makes a wary deer curious after three feeds', () => {
    let w = world();
    for (let i = 0; i < 3; i++) w = feedAnimals({ ...w, dropped: [dropped('lily', 1)] }, [deer(6, 0)]).world;
    expect(moodOfAnimal(w, deer(0, 0))).toBe('curious');
  });
});

describe('a startling slap', () => {
  it('lowers the trust of the animals near and not of the far ones', () => {
    const w = { ...world(), trust: { '1:1': 0.5 } };
    const r = startle(w, [deer(10, 0), deer(100, 0, '9:9')]);
    expect(r.trust['1:1']).toBeCloseTo(0.25);
    expect(r.trust['9:9']).toBeUndefined();
    expect(startle({ ...w, trust: { '1:1': 0.1 } }, [deer(10, 0)]).trust['1:1']).toBe(0);
  });
});

describe('the fox at the store', () => {
  const night = 0.9 * DAY_SECONDS;
  const home = (): WorldState => {
    const w = world();
    const stocked = w.store.map((s, i) => (i < 3 ? ('branch' as const) : s));
    return { ...w, lodge: { x: 0, z: 0, base: 0, door: 0, wood: LODGE_WOOD }, store: stocked, clock: night };
  };
  const visiting = (w: WorldState): string => {
    for (let c = 0; c < 200; c++) {
      const id = `${c}:2`;
      if (foxesAtStore([fox(30, 30, id)], { ...w, clock: night }, land)[0]!.x !== 30) return id;
    }
    throw new Error('no fox visits');
  };

  it('goes to a stocked store at night, on some days', () => {
    const w = home();
    const spot = storeSpot(w.lodge)!;
    const id = visiting(w);
    const out = foxesAtStore([fox(30, 30, id)], w, land)[0]!;
    expect(Math.hypot(out.x - spot.x, out.z - spot.z)).toBeLessThan(4);
    expect(out.moving).toBe(false);
  });

  it('stays away by day, from an empty store, and when scared off', () => {
    const w = home();
    const id = visiting(w);
    expect(foxesAtStore([fox(30, 30, id)], { ...w, clock: 0.3 * DAY_SECONDS }, land)[0]!.x).toBe(30);
    expect(storeFoxSpot({ ...w, store: w.store.map(() => null) })).toBeNull();
    expect(foxesAtStore([fox(30, 30, id)], banishFox(w, id), land)[0]!.x).toBe(30);
  });
});
