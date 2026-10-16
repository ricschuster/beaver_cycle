import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BARK_GRAIN_SIZE, barkGrainData } from './grain';
import { BARK, BARK_REPEAT_M, lump, mergeParts, paintLump, seeded, stick } from './propShapes';

describe('bark grain texture', () => {
  const data = barkGrainData();
  const mean = (): number => {
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += data[i]!;
    return sum / (data.length / 4) / 255;
  };

  it('is the same every time and opaque grey', () => {
    expect(Array.from(barkGrainData().slice(0, 64))).toEqual(Array.from(data.slice(0, 64)));
    for (let i = 0; i < data.length; i += 4) {
      expect(data[i]).toBe(data[i + 1]);
      expect(data[i + 3]).toBe(255);
    }
  });

  it('keeps a colour about as bright as it was once multiplied by the gain', () => {
    expect(mean() * 1.3).toBeGreaterThan(0.9);
    expect(mean() * 1.3).toBeLessThan(1.1);
  });

  it('wraps without a seam: the texel past an edge is as like the edge as its neighbour', () => {
    const at = (x: number, y: number): number => data[(y * BARK_GRAIN_SIZE + x) * 4]!;
    let seam = 0;
    let inside = 0;
    for (let y = 0; y < BARK_GRAIN_SIZE; y++) {
      seam += Math.abs(at(BARK_GRAIN_SIZE - 1, y) - at(0, y));
      inside += Math.abs(at(BARK_GRAIN_SIZE / 2 - 1, y) - at(BARK_GRAIN_SIZE / 2, y));
    }
    expect(seam).toBeLessThan(inside * 2 + 255);
  });
});

describe('grain on prop geometry', () => {
  it('a stick has grain on its sides and none on its cut ends, with repeats for uv', () => {
    const g = stick(1.6, 0.1, 6, BARK[0]!, seeded(1));
    const grain = g.getAttribute('grain');
    const values = new Set(Array.from(grain.array));
    expect(values).toEqual(new Set([0, 1]));
    const uv = g.getAttribute('uv');
    let top = 0;
    for (let i = 0; i < uv.count; i++) top = Math.max(top, uv.getY(i));
    expect(top).toBeCloseTo(1.6 / BARK_REPEAT_M, 5);
  });

  it('merging keeps the grain, and a part without it gets none', () => {
    const merged = mergeParts([stick(1, 0.1, 5, BARK[0]!, seeded(2)), paintLump(lump(seeded(3), 0.2), BARK[1]!, seeded(4))]);
    const grain = merged.getAttribute('grain') as THREE.BufferAttribute;
    expect(grain.count).toBe(merged.getAttribute('position').count);
    expect(merged.getAttribute('uv').count).toBe(grain.count);
    expect(grain.getX(grain.count - 1)).toBe(0);
  });
});
