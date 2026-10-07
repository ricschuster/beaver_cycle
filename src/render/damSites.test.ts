import { describe, expect, it } from 'vitest';
import { damBar, pondColour, type DamSite } from './damSites';

const site = (over: Partial<DamSite>): DamSite => ({ stream: '', x: 10, z: 20, bed_m: 600, flow: [0, 1], crest_m: 1.5, left_m: 6, right_m: 2, pond_m2: 800, max_depth_m: 1.2, near: 'core', ...over });

describe('damBar', () => {
  it('spans both banks and sits between them', () => {
    // Flow south (+z): across is -x. Left is 6 m on that side, right 2 m on the other, so the middle is 2 m toward -x.
    const bar = damBar(site({}));
    expect(bar.length).toBe(8);
    expect(bar.x).toBeCloseTo(10 - 2);
    expect(bar.z).toBeCloseTo(20);
  });
});

describe('pondColour', () => {
  it('changes with pond size', () => {
    expect(new Set([pondColour(200), pondColour(800), pondColour(3000)]).size).toBe(3);
  });
});
