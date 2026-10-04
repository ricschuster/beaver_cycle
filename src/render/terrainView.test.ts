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
