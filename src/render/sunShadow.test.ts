import { describe, expect, it } from 'vitest';
import { DAY_FRACTION } from '../sim/clock';
import { snapShadowCentre, sunDirection } from './sunShadow';

describe('sun direction', () => {
  it('is a unit vector', () => {
    const d = sunDirection('summer', 0.2);
    expect(Math.hypot(d.x, d.y, d.z)).toBeCloseTo(1);
  });

  it('rises in the east, stands south at midday and sets in the west', () => {
    expect(sunDirection('spring', 0.01).x).toBeGreaterThan(0.9);
    const noon = sunDirection('spring', DAY_FRACTION / 2);
    expect(noon.z).toBeGreaterThan(0.6);
    expect(Math.abs(noon.x)).toBeLessThan(1e-9);
    expect(sunDirection('spring', DAY_FRACTION - 0.01).x).toBeLessThan(-0.9);
  });

  it('is higher in summer than in winter and never below the horizon', () => {
    expect(sunDirection('summer', DAY_FRACTION / 2).y).toBeGreaterThan(sunDirection('winter', DAY_FRACTION / 2).y);
    expect(sunDirection('winter', 0.9).y).toBeGreaterThan(0);
  });
});

describe('shadow centre snapping', () => {
  it('moves the centre by less than a texel', () => {
    const c = { x: 123.456, y: 600.1, z: 789.012 };
    const s = snapShadowCentre(c, sunDirection('summer', 0.2), 0.05);
    expect(Math.hypot(s.x - c.x, s.y - c.y, s.z - c.z)).toBeLessThan(0.05 * Math.SQRT2);
  });

  it('gives the same centre for points within one texel', () => {
    const d = sunDirection('autumn', 0.15);
    const a = snapShadowCentre({ x: 100.001, y: 50, z: 200.001 }, d, 0.1);
    const b = snapShadowCentre({ x: 100.002, y: 50, z: 200.002 }, d, 0.1);
    expect(a.x).toBeCloseTo(b.x);
    expect(a.z).toBeCloseTo(b.z);
  });
});
