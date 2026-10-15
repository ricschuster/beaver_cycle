import { describe, expect, it } from 'vitest';
import { CLASS_LAKE } from '../terrain/format';
import { makeTile } from '../terrain/testing';
import type { Pond } from '../sim/pond';
import type { DamSpot } from '../sim/damSpots';
import { MOUTH_ARM_COUNT, despikeLine, isStub, smoothLine, buildLakeGeometry, buildStreamGeometry, buildTileGeometry, clearingsOf, farChunkKey, shrubHidden } from './terrainView';
import { DETAIL } from './groundDetail';

describe('water geometry', () => {
  it('covers lake cells with flat quads at the lake level', () => {
    const tile = makeTile(0, 0, 2, () => 0, CLASS_LAKE);
    const geo = buildLakeGeometry(tile, 320, 580)!;
    expect(geo.getAttribute('position').count).toBe(16 * 16 * 6);
    expect(geo.getAttribute('position').getY(5)).toBe(580);
  });

  it('follows a water level that changes over the tile, and cuts the ground against it', () => {
    // the level falls from 590 at x = 0 to 580 at x = 320; the ground is flat at 585, so the water covers it west of x = 160
    const tile = makeTile(0, 0, 2, () => 585, CLASS_LAKE);
    const p = buildLakeGeometry(tile, 320, 585, (x) => 590 - x / 32)!.getAttribute('position');
    let maxX = -Infinity;
    for (let k = 0; k < p.count; k++) {
      maxX = Math.max(maxX, p.getX(k));
      expect(p.getY(k)).toBeCloseTo(590 - p.getX(k) / 32, 1);
    }
    expect(maxX).toBeCloseTo(160, 0);
  });

  it('cuts the water where the ground rises through the lake level', () => {
    // ground rises 1 m per metre along x, crossing the level 580 at x = 160
    const tile = makeTile(0, 0, 2, (x) => 580 + (x - 160), CLASS_LAKE);
    const p = buildLakeGeometry(tile, 320, 580)!.getAttribute('position');
    let maxX = -Infinity;
    for (let k = 0; k < p.count; k++) maxX = Math.max(maxX, p.getX(k));
    expect(maxX).toBeCloseTo(160, 3);
  });

  it('reaches onto non lake cells that lie below the level beside a lake', () => {
    const tile = makeTile(0, 0, 2, () => 570, 1);
    tile.classes[0] = CLASS_LAKE;
    const p = buildLakeGeometry(tile, 320, 580)!.getAttribute('position');
    expect(p.count).toBe(4 * 6); // the lake cell and its three neighbours
  });

  it('reaches over low ground beside the lake mask by the reach, but not far down a valley', () => {
    // 5 m cells; only the first column is marked lake, the ground is below the level everywhere
    const tile = makeTile(0, 0, 0, () => 570, 1);
    for (let j = 0; j < 64; j++) tile.classes[j * 64] = CLASS_LAKE;
    const p = buildLakeGeometry(tile, 320, 580)!.getAttribute('position');
    let maxX = -Infinity;
    for (let k = 0; k < p.count; k++) maxX = Math.max(maxX, p.getX(k));
    expect(maxX).toBe(15); // the lake cell, then the 8 m reach rounded to 2 cells of 5 m
  });

  it('keeps the depth of the water at each vertex, 0 on the shoreline', () => {
    // the same slope as above: the water is 160 m deep at x = 0 and 0 deep at the shore, x = 160
    const tile = makeTile(0, 0, 2, (x) => 580 + (x - 160), CLASS_LAKE);
    const geo = buildLakeGeometry(tile, 320, 580)!;
    const p = geo.getAttribute('position');
    const d = geo.getAttribute('waterDepth');
    expect(d.count).toBe(p.count);
    for (let k = 0; k < p.count; k++) expect(d.getX(k)).toBeCloseTo(160 - p.getX(k), 3);
  });

  it('draws no lake on a tile without lake cells', () => {
    expect(buildLakeGeometry(makeTile(0, 0, 2, () => 0, 1), 320, 580)).toBeNull();
  });

  it('drapes a stream ribbon on the ground, just above it', () => {
    const geo = buildStreamGeometry(
      { lakeLevel_m: null, streams: [{ name: 'b', pts: [[0, 0], [100, 0]] }] },
      (x) => 500 + x * 0.1,
    )!;
    const p = geo.getAttribute('position');
    expect(p.count).toBeGreaterThan(20);
    for (let k = 0; k < p.count; k++) {
      const ground = 500 + p.getX(k) * 0.1;
      expect(p.getY(k) - ground).toBeCloseTo(0.3, 2);
    }
  });

  it('lights a stream ribbon from above all along, not by chance', () => {
    const geo = buildStreamGeometry({ lakeLevel_m: null, streams: [{ name: 'b', pts: [[0, 0], [50, 30], [100, 0]] }] }, (x, z) => 500 + x * 0.1 + Math.sin(z) * 3)!;
    const n = geo.getAttribute('normal');
    for (let k = 0; k < n.count; k++) expect([n.getX(k), n.getY(k), n.getZ(k)]).toEqual([0, 1, 0]);
  });

  it('draws a ribbon as wide as the stream says plus its soft edge, 2.5 m without a width', () => {
    const span = (w?: number): number => {
      const geo = buildStreamGeometry({ lakeLevel_m: null, streams: [{ name: 'b', w, pts: [[0, 0], [100, 0]] }] }, () => 0)!;
      const p = geo.getAttribute('position');
      let lo = Infinity;
      let hi = -Infinity;
      for (let k = 0; k < p.count; k++) {
        lo = Math.min(lo, p.getZ(k));
        hi = Math.max(hi, p.getZ(k));
      }
      return hi - lo;
    };
    // the see through edge reaches a quarter past the stated width
    expect(span()).toBeCloseTo(2.5 * 1.25, 3);
    expect(span(8)).toBeCloseTo(8 * 1.25, 3);
  });

  it('smooths the zigzag of a snapped stream line and keeps its ends', () => {
    const zig: [number, number][] = [];
    for (let k = 0; k <= 20; k++) zig.push([k * 2, k % 2 === 0 ? 0 : 1.5]);
    const out = smoothLine(zig);
    expect(out[0]).toEqual(zig[0]);
    expect(out[20]).toEqual(zig[20]);
    const wobble = (l: [number, number][]): number => Math.max(...l.slice(5, 16).map((p) => p[1])) - Math.min(...l.slice(5, 16).map((p) => p[1]));
    expect(wobble(out)).toBeLessThan(wobble(zig) / 4);
    expect(smoothLine([[0, 0], [100, 0]])).toEqual([[0, 0], [100, 0]]);
  });

  it('darkens the rim of a stream, fades its edge, and lets the rim blend out at a lake mouth', () => {
    const color = (lakeLevel_m: number | null, endHeight: number): { c: Float32Array | number[]; points: number } => {
      const geo = buildStreamGeometry({ lakeLevel_m, streams: [{ name: 'b', w: 4, pts: [[0, 0], [100, 0]] }] }, (x) => (x > 99 ? endHeight : 600), () => false)!;
      return { c: geo.getAttribute('color').array as Float32Array, points: 21 };
    };
    const { c } = color(null, 600);
    // per point five vertices of four numbers: outer, rim, middle, rim, outer
    expect(Array.from(c.slice(0, 4))).toEqual([expect.closeTo(0.8), expect.closeTo(0.8), expect.closeTo(0.8), 0]);
    expect(Array.from(c.slice(8, 12))).toEqual([1, 1, 1, 1]);
    // a stream ending in the lake loses its rim toward the end, the same line elsewhere keeps it
    const mouth = color(580, 580).c;
    const lastRim = (21 - 1) * 20 + 4;
    expect(mouth[lastRim]).toBeCloseTo(1, 5);
    expect(c[lastRim]).toBeCloseTo(0.8, 5);
  });

  it('drops a point the snap left on the bank, so the ribbon does not climb a hump', () => {
    const pts: [number, number][] = [[0, 0], [2, 0], [4, 0], [6, 0], [8, 0]];
    const ground = (x: number, z: number): number => (x === 4 && z === 0 ? 103 : 100 - x * 0.1);
    expect(despikeLine(pts, ground)).toEqual([[0, 0], [2, 0], [6, 0], [8, 0]]);
    // a steady slope in either direction keeps every point
    expect(despikeLine(pts, (x) => 100 - x * 0.3)).toEqual(pts);
    expect(despikeLine(pts, (x) => 100 + x * 0.3)).toEqual(pts);
  });

  it('skips a stub that goes out and comes back, and keeps a short real stream', () => {
    expect(isStub([[3171, 511], [3170, 517], [3173, 515], [3171, 511]])).toBe(true);
    expect(isStub([[0, 0], [10, 0], [20, 0]])).toBe(false);
    expect(isStub([[0, 0], [0, 100], [0, 0]])).toBe(false);
  });

  it('braids a stream that ends in the lake into arms, and only that one', () => {
    const ribbons = (lakeLevel_m: number | null, endHeight: number): number => {
      const geo = buildStreamGeometry({ lakeLevel_m, streams: [{ name: 'b', w: 5, pts: [[0, 0], [200, 0]] }] }, (x) => (x > 199 ? endHeight : 600))!;
      // five vertices per point, so a count above one ribbon's means arms were added
      return geo.getAttribute('position').count;
    };
    const plain = ribbons(null, 580);
    expect(ribbons(580, 580)).toBeGreaterThan(plain + MOUTH_ARM_COUNT * 4);
    expect(ribbons(580, 600)).toBe(plain);
  });

  it('bends a delta arm out of the channel instead of a ruler straight run', () => {
    // a 200 m stream along +x ending in the lake; the lake is the ground at or under 580 beyond x 199 and the whole side z > 30
    const h = (x: number, z: number): number => (x > 199 || z > 30 ? 580 : 600);
    const pos = buildStreamGeometry({ lakeLevel_m: 580, streams: [{ name: 'b', w: 5, pts: [[0, 0], [200, 0]] }] }, h)!.getAttribute('position');
    const mid = (k: number): [number, number] => [pos.getX(5 * k + 2), pos.getZ(5 * k + 2)]; // the middle vertex of five across
    const main = 41; // points of the main channel at a 5 m step; the first arm follows
    const [ax, az] = mid(main);
    const [bx, bz] = mid(main + 1);
    // it leaves along the channel (+x) rather than at the angle of its run
    expect(Math.abs(Math.atan2(bz - az, bx - ax))).toBeLessThan(0.35);
  });

  it('draws no ribbon when a tile has no streams', () => {
    expect(buildStreamGeometry({ lakeLevel_m: 580, streams: [] }, () => 0)).toBeNull();
  });
});

describe('far chunks', () => {
  it('groups neighbouring tiles, including negative ones, into the same chunk', () => {
    expect(farChunkKey(0, 0)).toBe(farChunkKey(7, 7));
    expect(farChunkKey(0, 0)).not.toBe(farChunkKey(8, 0));
    expect(farChunkKey(-1, -1)).toBe(farChunkKey(-8, -8));
    expect(farChunkKey(-1, 0)).not.toBe(farChunkKey(0, 0));
  });
});

describe('ground geometry', () => {
  it('marks meadow vertices for the grass tint and forest vertices for the forest tint', () => {
    const meadow = buildTileGeometry(makeTile(0, 0, 2, () => 0, 1), 320).getAttribute('seasonWeight');
    expect([meadow.getX(0), meadow.getY(0)]).toEqual([1, 0]);
    const forest = buildTileGeometry(makeTile(0, 0, 2, () => 0, 2), 320).getAttribute('seasonWeight');
    expect([forest.getX(0), forest.getY(0)]).toEqual([0, 1]);
  });

  it('leaves rock without a seasonal tint', () => {
    const rock = buildTileGeometry(makeTile(0, 0, 2, () => 0, 4), 320).getAttribute('seasonWeight');
    expect([rock.getX(0), rock.getY(0)]).toEqual([0, 0]);
  });
});

describe('ground detail in the geometry', () => {
  it('gives each vertex the detail of its land cover, rock the most', () => {
    const detailOf = (cls: number): number => buildTileGeometry(makeTile(0, 0, 2, () => 0, cls), 320).getAttribute('detail').getX(0);
    expect(detailOf(4)).toBeCloseTo(DETAIL[4]!, 5);
    expect(detailOf(1)).toBeCloseTo(DETAIL[1]!, 5);
    expect(detailOf(4)).toBeGreaterThan(detailOf(1));
  });
});

describe('shrub clearings', () => {
  const spot = { id: 's1', bed: { x: 100, z: 50 }, bedY: 600, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900, widths: [8, 12, null] } as DamSpot;

  it('keeps the ground round a dam and a lodge clear', () => {
    const clear = clearingsOf([{ spot: 's1', wood: 3, mud: 0, rock: 0 }], [spot], [{ x: 0, z: 0, base: 600, door: 0, wood: 10 }, null]);
    expect(clear).toHaveLength(2);
    expect(clear[0]).toMatchObject({ x: 100, z: 50 });
    expect(clear[0]!.r).toBeGreaterThan(6); // half the longest wall, and some
    expect(shrubHidden([], clear, 1, 600, 1)).toBe(true);
    expect(shrubHidden([], clear, 30, 600, 30)).toBe(false);
  });

  it('hides a shrub under a pond, and not one on the bank above it', () => {
    const n = 5;
    const pond = { spot: 's1', crest: 1, level: 601, n, x0: 0, z0: 0, heights: new Float32Array(n * n).fill(600), flooded: new Uint8Array(n * n).fill(1), area: 64 } as Pond;
    expect(shrubHidden([pond], [], 3, 600.5, 3)).toBe(true);
    expect(shrubHidden([pond], [], 3, 601.5, 3)).toBe(false);
    expect(shrubHidden([pond], [], 30, 600, 30)).toBe(false);
  });
});
