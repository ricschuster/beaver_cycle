import { describe, expect, it } from 'vitest';
import { DETAIL, groundNoiseData } from './groundDetail';

describe('ground detail', () => {
  const size = 32;
  const data = groundNoiseData(size);
  const at = (x: number, y: number, c: number): number => data[(((y + size) % size) * size + ((x + size) % size)) * 4 + c]!;

  it('fills each noise channel from 0 to 255, with an opaque alpha', () => {
    for (const c of [0, 1, 2]) {
      const values = Array.from({ length: size * size }, (_, k) => data[k * 4 + c]!);
      expect(Math.min(...values)).toBe(0);
      expect(Math.max(...values)).toBe(255);
    }
    for (let k = 0; k < size * size; k++) expect(data[k * 4 + 3]).toBe(255);
  });

  it('is smooth and tiles without a seam', () => {
    // neighbours differ by little, across the wrap as much as inside the texture
    let inside = 0;
    let across = 0;
    for (let y = 0; y < size; y++) {
      for (const c of [0, 1, 2]) {
        inside = Math.max(inside, Math.abs(at(size / 2, y, c) - at(size / 2 - 1, y, c)));
        across = Math.max(across, Math.abs(at(0, y, c) - at(-1, y, c)), Math.abs(at(y, 0, c) - at(y, -1, c)));
      }
    }
    expect(inside).toBeLessThan(90);
    expect(across).toBeLessThan(90);
  });

  it('gives each channel its own noise', () => {
    let same = 0;
    for (let k = 0; k < size * size; k++) if (Math.abs(data[k * 4]! - data[k * 4 + 1]!) < 8) same++;
    expect(same).toBeLessThan(size * size * 0.3);
  });

  it('is the same every time', () => {
    expect(groundNoiseData(size)).toEqual(data);
  });

  it('shows most on rock and least on meadow', () => {
    for (const c of [0, 2, 3, 5]) {
      expect(DETAIL[4]).toBeGreaterThan(DETAIL[c]!);
      expect(DETAIL[c]).toBeGreaterThan(DETAIL[1]!);
    }
  });
});
