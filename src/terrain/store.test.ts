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

  it('takes the water level from the grid of a tile whose water bodies differ in level', () => {
    const s = new TileStore(makeIndex([0, 0], [0, 0], 586));
    s.put(makeTile(0, 0, 0, () => 580, CLASS_LAKE));
    expect(s.waterLevel(0, 0, 100, 100)).toBe(586);
    // a 2 by 2 grid 320 m apart: 590 on the west side, 580 on the east, and no sample in the south east corner
    s.putWater(0, 0, { lakeLevel_m: 586, streams: [], levels: { step: 320, n: 2, v: [590, 580, 590, null] } });
    expect(s.waterLevel(0, 0, 0, 0)).toBeCloseTo(590);
    expect(s.waterLevel(0, 0, 160, 0)).toBeCloseTo(585);
    expect(s.waterLevel(0, 0, 320, 320)).toBeCloseTo(586); // on the corner with no sample the tile level stands
    expect(s.waterLevel(0, 0, 320, 160)).toBeCloseTo(580); // halfway up the east side only the sample that has a level counts
    expect(s.waterDepth(160, 10)).toBeCloseTo(585 - 580, 0);
  });

  it('puts the water edge where the ground crosses the lake level', () => {
    const s = new TileStore(makeIndex([0, 0], [0, 0], 586));
    // the ground rises 1 m per 10 m from x = 100, so it meets the level 586 at x = 160
    const tile = makeTile(0, 0, 0, (x) => 580 + Math.max(0, x - 100) * 0.1);
    // lake cells are the first 20 columns (x < 100) and the rest is land
    for (let j = 0; j < tile.n; j++) tile.classes.fill(CLASS_LAKE, j * tile.n, j * tile.n + 20);
    s.put(tile);
    expect(s.waterDepth(50, 100)).toBeCloseTo(6);
    // a land cell beside the lake is wet below the level, and the edge is the crossing
    expect(s.isWater(103, 100)).toBe(true);
    // two cells from the lake there is no water, even below the level
    expect(s.isWater(120, 100)).toBe(false);
  });

  it('has no water in a lake cell whose ground is above the level', () => {
    const s = new TileStore(makeIndex([0, 0], [0, 0], 586));
    s.put(makeTile(0, 0, 0, () => 590, CLASS_LAKE));
    expect(s.isWater(10, 10)).toBe(false);
  });

  it('reads the land cover class under a point, 0 with no data', () => {
    const s = new TileStore(makeIndex([0, 0], [0, 0]));
    expect(s.coverAt(10, 10)).toBe(0);
    const t = makeTile(0, 0, 0, () => 600, 2);
    t.classes[0] = 1; // the north west cell is meadow
    s.put(t);
    expect(s.coverAt(1, 1)).toBe(1);
    expect(s.coverAt(100, 100)).toBe(2);
  });

  it('counts tiles by level', () => {
    const s = new TileStore(makeIndex([0, 1], [0, 0]));
    s.put(makeTile(0, 0, 0, () => 0));
    s.put(makeTile(0, 0, 2, () => 0));
    s.put(makeTile(1, 0, 2, () => 0));
    expect(s.countByLevel()).toEqual([1, undefined, 2]);
  });
});

describe('streamDistance', () => {
  it('is the distance to the nearest stream line, also from a neighbour tile, and Infinity without streams', () => {
    const s = new TileStore({ tileSize_m: 320, tileRange: { tx: [0, 1], tz: [0, 0] }, tiles: [] } as never);
    expect(s.streamDistance(10, 10)).toBe(Infinity);
    s.putWater(0, 0, { lakeLevel_m: null, streams: [{ name: 'a', pts: [[0, 100], [300, 100]] }] });
    expect(s.streamDistance(150, 103)).toBeCloseTo(3);
    expect(s.streamDistance(330, 100)).toBeCloseTo(30);
    expect(s.streamDistance(150, 1000)).toBeGreaterThan(800);
    expect(s.streamDistance(150, 101, 1.5)).toBeCloseTo(1);
    expect(s.streamDistance(150, 110, 1.5)).toBe(Infinity);
  });
});

describe('streamPoints', () => {
  it('lists points every step along the lines near a point, with the direction of the line', () => {
    const s = new TileStore({ tileSize_m: 320, tileRange: { tx: [0, 1], tz: [0, 0] }, tiles: [] } as never);
    expect(s.streamPoints(10, 10, 50, 10)).toEqual([]);
    s.putWater(0, 0, { lakeLevel_m: null, streams: [{ name: 'a', pts: [[0, 100], [100, 100]] }] });
    const p = s.streamPoints(50, 100, 25, 10);
    expect(p.map((q) => q.x)).toEqual([30, 40, 50, 60, 70]);
    expect(p[0]).toMatchObject({ z: 100, ux: 1, uz: 0 });
  });
});
