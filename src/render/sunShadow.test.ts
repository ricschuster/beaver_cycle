import { describe, expect, it } from 'vitest';
import { DAY_FRACTION } from '../sim/clock';
import { sunDirection } from './sunShadow';

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
