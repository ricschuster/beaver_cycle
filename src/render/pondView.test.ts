import { describe, expect, it } from 'vitest';
import { floodPond } from '../sim/pond';
import { buildPondGeometry } from './pondView';

describe('buildPondGeometry', () => {
  it('lies flat at the pond level', () => {
    const spot = { id: 's', bed: { x: 0, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };
    const pond = floodPond({ heightAt: (x, z) => 0.1 * Math.abs(z) - 0.02 * Math.min(x, 0), isWater: () => false, waterDepth: () => 0 }, spot, 1)!;
    const geo = buildPondGeometry(pond)!;
    const p = geo.getAttribute('position');
    expect(p.count).toBeGreaterThan(30);
    for (let i = 0; i < p.count; i++) expect(p.getY(i)).toBe(1);
  });
});
