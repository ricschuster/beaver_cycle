import { describe, expect, it } from 'vitest';
import { skyLook } from './skyLook';

describe('sky look', () => {
  it('has the full sun and the day sky at midday in spring', () => {
    const noon = skyLook('spring', 0.3);
    expect(noon.sky).toBe(0xcfe3d4);
    expect(noon.sun).toBeGreaterThan(1);
  });

  it('is dark and dim at night', () => {
    const night = skyLook('summer', 0.9);
    expect(night.sky).toBe(0x0b1426);
    expect(night.sun).toBe(0);
    expect(night.ambient).toBeLessThan(skyLook('summer', 0.3).ambient);
  });

  it('darkens the underwater view at night', () => {
    expect(skyLook('summer', 0.3).underwater).toBe(0x2c7a96);
    expect(skyLook('summer', 0.9).underwater).toBe(0x07151f);
  });

  it('differs by season at midday', () => {
    expect(skyLook('autumn', 0.3).sky).not.toBe(skyLook('winter', 0.3).sky);
  });
});
