import { describe, expect, it } from 'vitest';
import { moonDirection, nightness, starDirections } from './nightSky';

describe('night sky', () => {
  it('has the moon rise in the east, peak in the south, and set in the west', () => {
    const rise = moonDirection(0.63);
    const mid = moonDirection(0.8125);
    const set = moonDirection(0.999);
    expect(rise.x).toBeGreaterThan(0.9);
    expect(mid.z).toBeGreaterThan(0.5);
    expect(mid.y).toBeGreaterThan(rise.y);
    expect(set.x).toBeLessThan(-0.9);
  });

  it('returns unit vectors', () => {
    const m = moonDirection(0.7);
    expect(Math.hypot(m.x, m.y, m.z)).toBeCloseTo(1, 5);
  });

  it('shows the sky only when it is dark', () => {
    expect(nightness(1)).toBe(0);
    expect(nightness(0.7)).toBe(0);
    expect(nightness(0)).toBe(1);
    expect(nightness(0.3)).toBeGreaterThan(0);
    expect(nightness(0.3)).toBeLessThan(1);
  });

  it('places the same stars every time, all above the horizon', () => {
    const a = starDirections(200);
    expect(Array.from(starDirections(200))).toEqual(Array.from(a));
    for (let i = 0; i < 200; i++) {
      const [x, y, z] = [a[i * 3] ?? 0, a[i * 3 + 1] ?? 0, a[i * 3 + 2] ?? 0];
      expect(y).toBeGreaterThan(0);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 4);
    }
  });
});
