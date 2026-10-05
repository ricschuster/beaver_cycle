import { describe, expect, it } from 'vitest';
import { skyLook } from './skyLook';

describe('sky look', () => {
  it('is the old day look at midday in spring', () => {
    expect(skyLook('spring', 0.3)).toEqual({ sky: 0xcfe3d4, intensity: 1.6 });
  });

  it('is dark and dim at night', () => {
    const night = skyLook('summer', 0.9);
    expect(night.sky).toBe(0x0b1426);
    expect(night.intensity).toBeLessThan(skyLook('summer', 0.3).intensity);
  });

  it('differs by season at midday', () => {
    expect(skyLook('autumn', 0.3).sky).not.toBe(skyLook('winter', 0.3).sky);
  });
});
