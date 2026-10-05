import { describe, expect, it } from 'vitest';
import { stickMove } from './stick';

describe('stickMove', () => {
  it('is zero inside the dead zone', () => {
    expect(stickMove(5, -5, 100, 0.2)).toEqual({ x: 0, z: 0 });
    expect(stickMove(0, 0)).toEqual({ x: 0, z: 0 });
  });

  it('pushing up goes forward, right goes to -x like the D key', () => {
    expect(stickMove(0, -100, 100, 0.1).z).toBeCloseTo(1);
    expect(stickMove(100, 0, 100, 0.1).x).toBeCloseTo(-1);
    expect(stickMove(-100, 0, 100, 0.1).x).toBeCloseTo(1);
    expect(stickMove(0, 100, 100, 0.1).z).toBeCloseTo(-1);
  });

  it('never exceeds full speed and grows from zero past the dead zone', () => {
    const far = stickMove(900, 900, 100, 0.1);
    expect(Math.hypot(far.x, far.z)).toBeCloseTo(1);
    const edge = stickMove(0, -10.1, 100, 0.1);
    expect(Math.hypot(edge.x, edge.z)).toBeLessThan(0.01);
    const half = stickMove(0, -55, 100, 0.1);
    expect(Math.hypot(half.x, half.z)).toBeCloseTo(0.5);
  });
});
