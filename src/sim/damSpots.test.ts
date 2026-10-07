import { describe, expect, it } from 'vitest';
import { firstSpots, maxLevel, spotFromSite, spotsNear, type ScannedSite } from './damSpots';

const site = (over: Partial<ScannedSite>): ScannedSite => ({ x: 0, z: 0, bed_m: 600, flow: [0, 1], crest_m: 1.5, pond_m2: 1000, max_depth_m: 1.2, near: 'core', ...over });

describe('maxLevel', () => {
  it('follows the crest that holds water', () => {
    expect(maxLevel(spotFromSite(site({ crest_m: 1.0 })))).toBe(1);
    expect(maxLevel(spotFromSite(site({ crest_m: 1.5 })))).toBe(2);
    expect(maxLevel(spotFromSite(site({ crest_m: 2.0 })))).toBe(3);
  });
});

describe('firstSpots', () => {
  const anchor = { x: 0, z: 0 };
  it('takes the nearest sites of the location, spaced apart', () => {
    const sites = [site({ x: 200, z: 0 }), site({ x: 250, z: 0 }), site({ x: 100, z: 0 }), site({ x: 500, z: 0 }), site({ x: 900, z: 0 }), site({ x: 50, z: 0, near: 'north' })];
    expect(firstSpots(sites, 'core', anchor).map((s) => s.bed.x)).toEqual([100, 250, 500]);
  });
  it('skips ponds too small or too shallow to swim in', () => {
    const sites = [site({ x: 10, pond_m2: 200 }), site({ x: 20, max_depth_m: 0.5 }), site({ x: 400 })];
    expect(firstSpots(sites, 'core', anchor).map((s) => s.bed.x)).toEqual([400]);
  });
  it('gives fewer when the location has fewer', () => {
    expect(firstSpots([site({})], 'core', anchor)).toHaveLength(1);
    expect(firstSpots([], 'core', anchor)).toEqual([]);
  });
});

describe('spotsNear', () => {
  it('lists spots in range, nearest first', () => {
    const spots = [site({ x: 50 }), site({ x: 10 }), site({ x: 500 })].map(spotFromSite);
    expect(spotsNear(spots, 0, 0, 100).map((s) => s.bed.x)).toEqual([10, 50]);
  });
});
