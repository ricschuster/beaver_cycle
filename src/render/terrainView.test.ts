import { describe, expect, it } from 'vitest';
import { CLASS_LAKE } from '../terrain/format';
import { makeTile } from '../terrain/testing';
import { buildLakeGeometry, buildStreamGeometry } from './terrainView';

describe('water geometry', () => {
  it('covers lake cells with flat quads at the lake level', () => {
    const tile = makeTile(0, 0, 2, () => 0, CLASS_LAKE);
    const geo = buildLakeGeometry(tile, 320, 580)!;
    expect(geo.getAttribute('position').count).toBe(16 * 16 * 6);
    expect(geo.getAttribute('position').getY(5)).toBe(580);
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

  it('draws no ribbon when a tile has no streams', () => {
    expect(buildStreamGeometry({ lakeLevel_m: 580, streams: [] }, () => 0)).toBeNull();
  });
});
