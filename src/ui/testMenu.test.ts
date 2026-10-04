import { describe, expect, it } from 'vitest';
import { formatReadout } from './testMenu';

describe('formatReadout', () => {
  it('lists fps, tiles per level, triangles, and memory', () => {
    const text = formatReadout({ fps: 59.6, tilesByLevel: [9, 20, 266], triangles: 412345, memoryMb: 180.4 });
    expect(text).toBe('60 fps\ntiles L0 9  L1 20  L2 266\ntriangles 412k\nmemory 180 MB');
  });

  it('shows n/a where a value is missing', () => {
    const text = formatReadout({ fps: 30, tilesByLevel: null, triangles: null, memoryMb: null });
    expect(text).toBe('30 fps\ntiles none\ntriangles n/a\nmemory n/a');
  });
});
