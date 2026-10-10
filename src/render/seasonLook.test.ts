import { describe, expect, it } from 'vitest';
import { DAYS_PER_YEAR } from '../sim/clock';
import { seasonLook } from './seasonLook';

describe('season look', () => {
  it('leaves the tile colours alone in the middle of summer', () => {
    expect(seasonLook(15).grass.amount).toBe(0);
    expect(seasonLook(15).forest.amount).toBe(0);
  });

  it('covers the meadows in snow in the middle of winter', () => {
    const winter = seasonLook(35);
    expect(winter.grass.amount).toBeGreaterThan(0.5);
    expect(winter.grass.color).toBe(0xeef2f5);
  });

  it('differs between all four seasons', () => {
    const trees = [5, 15, 25, 35].map((d) => seasonLook(d).tree);
    expect(new Set(trees).size).toBe(4);
  });

  it('drops leaves in autumn only, and turns them over the year', () => {
    expect([5, 15, 35].map((d) => seasonLook(d).leafFall)).toEqual([0, 0, 0]);
    expect(seasonLook(25).leafFall).toBe(1);
    expect(new Set([5, 15, 25, 35].map((d) => seasonLook(d).leaf)).size).toBe(4);
  });

  it('has full crowns until the autumn ends and bare trees in the middle of winter', () => {
    expect([5, 15, 25].map((d) => seasonLook(d).foliage)).toEqual([1, 1, 1]);
    expect(seasonLook(35).foliage).toBe(0);
  });

  it('puts snow on the trees in winter only', () => {
    expect([5, 15, 25].map((d) => seasonLook(d).snow)).toEqual([0, 0, 0]);
    expect(seasonLook(35).snow).toBe(1);
  });

  it('freezes the lake edges in winter only, and changes the water colour with the seasons', () => {
    expect([5, 15, 25].map((d) => seasonLook(d).ice)).toEqual([0, 0, 0]);
    expect(seasonLook(35).ice).toBe(1);
    expect(seasonLook(15).water).toBe(0x3b8fb0);
    expect(new Set([5, 15, 25, 35].map((d) => seasonLook(d).water)).size).toBe(4);
  });

  it('lets the snow and the ice come and go over the turn of the season', () => {
    // halfway through the blend into winter, and out of it into spring
    expect(seasonLook(30).snow).toBeCloseTo(0.5, 5);
    expect(seasonLook(30).ice).toBeCloseTo(0.5, 5);
    expect(seasonLook(DAYS_PER_YEAR).snow).toBeCloseTo(0.5, 5);
  });

  it('does not jump at a season change or at the new year', () => {
    for (const edge of [10, 20, 30, DAYS_PER_YEAR]) {
      const before = seasonLook(edge - 0.001);
      const after = seasonLook(edge + 0.001);
      expect(Math.abs(before.grass.amount - after.grass.amount)).toBeLessThan(0.01);
      expect(Math.abs(before.tree - after.tree)).toBeLessThan(0x010101 * 2);
      expect(Math.abs(before.leafFall - after.leafFall)).toBeLessThan(0.01);
      expect(Math.abs(before.foliage - after.foliage)).toBeLessThan(0.01);
      expect(Math.abs(before.snow - after.snow)).toBeLessThan(0.01);
      expect(Math.abs(before.ice - after.ice)).toBeLessThan(0.01);
      for (const shift of [16, 8, 0]) expect(Math.abs(((before.water >> shift) & 0xff) - ((after.water >> shift) & 0xff))).toBeLessThan(2);
    }
  });

  it('repeats every year', () => {
    expect(seasonLook(3)).toEqual(seasonLook(3 + DAYS_PER_YEAR));
  });
});
