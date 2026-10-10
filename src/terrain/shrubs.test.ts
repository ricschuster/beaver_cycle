import { describe, expect, it } from 'vitest';
import { CLASS_LAKE, LEVEL_FINE } from './format';
import { placeShrubs, SHRUB_DENSITY, SHRUB_FLOATS, STREAM_CLEARANCE } from './shrubs';
import { makeTile } from './testing';

const SCRUB = 3;
const MEADOW = 1;
const FOREST = 2;
const ROCK = 4;
const dry = { lakeLevel: null };
const count = (a: Float32Array): number => a.length / SHRUB_FLOATS;

describe('shrub placement', () => {
  it('scatters shrubs over scrub at about the scrub density', () => {
    const shrubs = placeShrubs(makeTile(0, 0, 0, () => 600, SCRUB), 320, dry);
    const expected = 320 * 320 * SHRUB_DENSITY.scrub;
    expect(count(shrubs)).toBeGreaterThan(expected * 0.8);
    expect(count(shrubs)).toBeLessThan(expected * 1.2);
  });

  it('places the same shrubs every time, standing on the ground of the tile', () => {
    const tile = makeTile(2, -3, 0, (x, z) => 600 + x * 0.1 - z * 0.05, SCRUB);
    const a = placeShrubs(tile, 320, dry);
    expect(a).toEqual(placeShrubs(tile, 320, dry));
    for (let o = 0; o < a.length; o += SHRUB_FLOATS) {
      const [x, y, z] = [a[o]!, a[o + 1]!, a[o + 2]!];
      expect(x).toBeGreaterThanOrEqual(640);
      expect(x).toBeLessThanOrEqual(960);
      expect(z).toBeGreaterThanOrEqual(-960);
      expect(z).toBeLessThanOrEqual(-640);
      expect(y).toBeCloseTo(600 + x * 0.1 - z * 0.05, 2);
    }
  });

  it('has shrubs on the near levels only', () => {
    expect(count(placeShrubs(makeTile(0, 0, 1, () => 0, SCRUB), 320, dry))).toBe(0);
    expect(count(placeShrubs(makeTile(0, 0, 2, () => 0, SCRUB), 320, dry))).toBe(0);
    const fine = { ...makeTile(0, 0, 0, () => 0, SCRUB), level: LEVEL_FINE };
    expect(count(placeShrubs(fine, 320, dry))).toBeGreaterThan(0);
  });

  it('puts none on rock, and only a rare one on open meadow far from a wood', () => {
    expect(count(placeShrubs(makeTile(0, 0, 0, () => 0, ROCK), 320, dry))).toBe(0);
    expect(count(placeShrubs(makeTile(0, 0, 0, () => 0, MEADOW), 320, dry))).toBeLessThan(80);
  });

  it('grows them thicker along the edge of a wood than out on the meadow or deep in the wood', () => {
    // the west half wood, the east half meadow: the edge runs down the middle at x = 160
    const tile = makeTile(0, 0, 0, () => 0, MEADOW);
    for (let j = 0; j < 64; j++) for (let i = 0; i < 32; i++) tile.classes[j * 64 + i] = FOREST;
    const shrubs = placeShrubs(tile, 320, dry);
    let edge = 0;
    let away = 0;
    for (let o = 0; o < shrubs.length; o += SHRUB_FLOATS) {
      if (Math.abs(shrubs[o]! - 160) < 10) edge++;
      else away++;
    }
    expect(edge).toBeGreaterThan(20);
    expect(edge).toBeGreaterThan(away);
  });

  it('keeps out of the lake and its shallows', () => {
    // a lake on the west half, with the ground rising out of it to the east
    const tile = makeTile(0, 0, 0, (x) => 580 + (x - 150) * 0.05, SCRUB);
    for (let j = 0; j < 64; j++) for (let i = 0; i < 30; i++) tile.classes[j * 64 + i] = CLASS_LAKE;
    const shrubs = placeShrubs(tile, 320, { lakeLevel: 580 });
    expect(count(shrubs)).toBeGreaterThan(0);
    for (let o = 0; o < shrubs.length; o += SHRUB_FLOATS) {
      expect(shrubs[o]!).toBeGreaterThanOrEqual(150);
      expect(shrubs[o + 1]!).toBeGreaterThan(580);
    }
  });

  it('keeps clear of the streams', () => {
    const streamDistance = (x: number): number => Math.abs(x - 100);
    const shrubs = placeShrubs(makeTile(0, 0, 0, () => 0, SCRUB), 320, { lakeLevel: null, streamDistance });
    expect(count(shrubs)).toBeGreaterThan(0);
    for (let o = 0; o < shrubs.length; o += SHRUB_FLOATS) expect(Math.abs(shrubs[o]! - 100)).toBeGreaterThanOrEqual(STREAM_CLEARANCE);
  });

  it('varies their size', () => {
    const shrubs = placeShrubs(makeTile(0, 0, 0, () => 0, SCRUB), 320, dry);
    const scales = new Set<number>();
    for (let o = 0; o < shrubs.length; o += SHRUB_FLOATS) scales.add(Math.round(shrubs[o + 3]! * 10));
    expect(scales.size).toBeGreaterThan(4);
  });
});
