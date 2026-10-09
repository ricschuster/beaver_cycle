import { describe, expect, it } from 'vitest';
import { AnimalField, CELL, MAX_ANIMALS, MIN_ANIMALS, capFor, homeOf } from './animals';
import { DAY_SECONDS } from './clock';
import { flatTerrain, type Terrain } from './terrain';

/** Land everywhere except a lake of 5 m depth east of x = 300 (shallow rim of 1 m between 300 and 320). */
const lake: Terrain = {
  heightAt: () => 0,
  isWater: (x) => x > 300,
  waterDepth: (x) => (x <= 300 ? 0 : x < 320 ? 1 : 5),
};

const noon = DAY_SECONDS * 0.3;

describe('animals', () => {
  it('give the same animals for the same place and time', () => {
    const a = new AnimalField().near(lake, 100, 0, noon);
    const b = new AnimalField().near(lake, 100, 0, noon);
    expect(a.length).toBeGreaterThan(0);
    expect(b).toEqual(a);
  });

  it('keeps land animals on land and ducks on shallow water', () => {
    const field = new AnimalField();
    for (const t of [noon, noon + 700, noon + 5000]) {
      for (const a of field.near(lake, 300, 0, t, 500, 250)) {
        const water = lake.isWater(a.x, a.z);
        if (a.kind === 'duck') {
          expect(water).toBe(true);
          expect(lake.waterDepth(a.x, a.z)).toBeGreaterThanOrEqual(0.4);
        } else {
          expect(water).toBe(false);
        }
      }
    }
  });

  it('puts herons on the bank and ducks at the water surface', () => {
    const all = new AnimalField().near(lake, 300, 0, noon, 500, 250);
    const heron = all.find((a) => a.kind === 'heron');
    expect(heron).toBeDefined();
    expect(Math.abs(heron!.x - 300)).toBeLessThan(6);
    for (const d of all.filter((a) => a.kind === 'duck')) expect(d.y).toBeCloseTo(lake.waterDepth(d.x, d.z));
  });

  it('moves smoothly with the clock', () => {
    const field = new AnimalField();
    const before = field.near(flatTerrain(0), 0, 0, noon).find((a) => a.kind === 'deer')!;
    const after = field.near(flatTerrain(0), 0, 0, noon + 1).find((a) => a.id === before.id)!;
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThan(2);
  });

  it('keeps to the cap, nearest first', () => {
    const field = new AnimalField();
    const few = field.near(flatTerrain(0), 0, 0, noon, 5);
    const all = field.near(flatTerrain(0), 0, 0, noon, 500);
    expect(few).toEqual(all.slice(0, 5));
    expect(field.near(flatTerrain(0), 0, 0, noon).length).toBeLessThanOrEqual(MAX_ANIMALS);
  });

  it('leaves ducks and herons out on flat dry land', () => {
    const kinds = new Set(new AnimalField().near(flatTerrain(0), 0, 0, noon, 500).map((a) => a.kind));
    expect(kinds.has('duck')).toBe(false);
    expect(kinds.has('heron')).toBe(false);
  });

  it('thins out in winter', () => {
    const field = new AnimalField();
    const summer = field.near(lake, 300, 0, DAY_SECONDS * 15.3, 500, 250).filter((a) => a.kind === 'duck' || a.kind === 'heron');
    const winter = field.near(lake, 300, 0, DAY_SECONDS * 35.3, 500, 250).filter((a) => a.kind === 'duck' || a.kind === 'heron');
    expect(winter.length).toBeLessThan(summer.length);
  });

  it('has a home only for some cells', () => {
    let homes = 0;
    for (let i = 0; i < 100; i++) if (homeOf(flatTerrain(0), i, 3)) homes++;
    expect(homes).toBeGreaterThan(10);
    expect(homes).toBeLessThan(100);
    expect(CELL).toBeGreaterThan(0);
  });

  it('trims far cells', () => {
    const field = new AnimalField();
    field.near(lake, 0, 0, noon);
    field.trim(5000, 5000);
    expect(field.near(lake, 0, 0, noon).length).toBeGreaterThan(0);
  });

  it('lowers the cap when the frame rate falls', () => {
    expect(capFor(60)).toBe(MAX_ANIMALS);
    expect(capFor(10)).toBe(MIN_ANIMALS);
    expect(capFor(30)).toBeGreaterThan(MIN_ANIMALS);
    expect(capFor(30)).toBeLessThan(MAX_ANIMALS);
  });
});
