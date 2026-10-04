import { describe, expect, it } from 'vitest';
import { CLASS_LAKE } from './format';
import { TileStore } from './store';
import { makeIndex, makeTile } from './testing';

// a plane: 100 m plus a 0.1 slope east and a 0.2 slope south
const plane = (x: number, z: number): number => 100 + 0.1 * x + 0.2 * z;

describe('TileStore', () => {
  it('reads heights across a tile edge', () => {
    const s = new TileStore(makeIndex([0, 1], [0, 0]));
    s.put(makeTile(0, 0, 0, plane));
    s.put(makeTile(1, 0, 0, plane));
    expect(s.heightAt(319.9, 50)).toBeCloseTo(plane(319.9, 50), 2);
    expect(s.heightAt(320.1, 50)).toBeCloseTo(plane(320.1, 50), 2);
    expect(s.heightAt(320, 50)).toBeCloseTo(plane(320, 50), 3);
  });

  it('prefers the finest loaded level and falls back to a coarser one', () => {
    const s = new TileStore(makeIndex([0, 0], [0, 0]));
    s.put(makeTile(0, 0, 2, () => 10));
    expect(s.heightAt(100, 100)).toBe(10);
    s.put(makeTile(0, 0, 0, () => 20));
    expect(s.heightAt(100, 100)).toBe(20);
    s.drop(0, 0, 0);
    expect(s.heightAt(100, 100)).toBe(10);
  });

  it('follows the mesh triangles, not a bilinear blend', () => {
    // one raised vertex at the north west corner of a 5 m cell
    const s = new TileStore(makeIndex([0, 0], [0, 0]));
    const t = makeTile(0, 0, 0, () => 0);
    t.heights[0] = 10; // vertex (0,0)
    s.put(t);
    expect(s.heightAt(0, 0)).toBeCloseTo(10);
    expect(s.heightAt(5, 0)).toBeCloseTo(0);
    // on the diagonal from (5,0) to (0,5) the raised corner has no effect
    expect(s.heightAt(2.5, 2.5)).toBeCloseTo(0);
    expect(s.heightAt(1.25, 1.25)).toBeCloseTo(5); // halfway between corner and diagonal
  });

  it('clamps outside the region and answers 0 with no data', () => {
    const s = new TileStore(makeIndex([0, 0], [0, 0]));
    expect(s.heightAt(50, 50)).toBe(0);
    s.put(makeTile(0, 0, 0, plane));
    expect(s.heightAt(-500, 0)).toBeCloseTo(plane(0, 0), 2);
    expect(s.heightAt(900, 320)).toBeCloseTo(plane(320, 320), 2);
  });

  it('reports lake cells and water depth', () => {
    const s = new TileStore(makeIndex([0, 0], [0, 0], 586));
    s.put(makeTile(0, 0, 0, () => 580, CLASS_LAKE));
    expect(s.isWater(10, 10)).toBe(true);
    expect(s.waterDepth(10, 10)).toBeCloseTo(6);
    const dry = new TileStore(makeIndex([0, 0], [0, 0], 586));
    dry.put(makeTile(0, 0, 0, () => 600, 2));
    expect(dry.isWater(10, 10)).toBe(false);
    expect(dry.waterDepth(10, 10)).toBe(0);
  });

  it('counts tiles by level', () => {
    const s = new TileStore(makeIndex([0, 1], [0, 0]));
    s.put(makeTile(0, 0, 0, () => 0));
    s.put(makeTile(0, 0, 2, () => 0));
    s.put(makeTile(1, 0, 2, () => 0));
    expect(s.countByLevel()).toEqual([1, undefined, 2]);
  });
});
