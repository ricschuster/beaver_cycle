import { describe, expect, it } from 'vitest';
import { formatReadout } from './testMenu';

const beaver = { x: 63.4, z: 1750.2, ground: 588.71, waterDepth: 0.346 };

describe('formatReadout', () => {
  it('lists fps, the beaver position and water depth, tiles per level, triangles, and memory', () => {
    const text = formatReadout({ fps: 59.6, beaver, tilesByLevel: [9, 20, 266], triangles: 412345, memoryMb: 180.4 });
    expect(text).toBe('60 fps\nx 63  z 1750\nground 588.71 m\nwater 0.35 m\ntiles L0 9  L1 20  L2 266\ntriangles 412k\nmemory 180 MB');
  });

  it('shows n/a where a value is missing', () => {
    const text = formatReadout({ fps: 30, beaver, tilesByLevel: null, triangles: null, memoryMb: null });
    expect(text).toBe('30 fps\nx 63  z 1750\nground 588.71 m\nwater 0.35 m\ntiles none\ntriangles n/a\nmemory n/a');
  });
});
