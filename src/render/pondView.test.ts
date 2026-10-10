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

  it('keeps the water depth at each point, 0 on the shore, for the ice', () => {
    const spot = { id: 's', bed: { x: 0, z: 0 }, bedY: 0, flow: { x: 1, z: 0 }, maxCrest: 2, pondM2: 900 };
    const heightAt = (x: number, z: number): number => 0.1 * Math.abs(z) - 0.02 * Math.min(x, 0);
    const pond = floodPond({ heightAt, isWater: () => false, waterDepth: () => 0 }, spot, 1)!;
    const geo = buildPondGeometry(pond)!;
    const p = geo.getAttribute('position');
    const d = geo.getAttribute('waterDepth');
    expect(d.count).toBe(p.count);
    let shore = 0;
    for (let i = 0; i < d.count; i++) {
      expect(d.getX(i)).toBeGreaterThanOrEqual(0);
      expect(d.getX(i)).toBeLessThanOrEqual(1 - Math.min(...pond.heights) + 1e-6);
      if (d.getX(i) === 0) shore++;
    }
    expect(shore).toBeGreaterThan(0);
  });
});
