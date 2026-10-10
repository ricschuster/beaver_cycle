import * as THREE from 'three';
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

  it('ends the water in a straight line at the dam wall, not in the steps of the grid', () => {
    // A dam set across the grid at an angle: the flow runs diagonally.
    const flow = { x: Math.SQRT1_2, z: Math.SQRT1_2 };
    const spot = { id: 's', bed: { x: 0, z: 0 }, bedY: 0, flow, maxCrest: 2, pondM2: 900 };
    const along = (x: number, z: number): number => x * flow.x + z * flow.z;
    const across = (x: number, z: number): number => -x * flow.z + z * flow.x;
    const heightAt = (x: number, z: number): number => 0.1 * Math.abs(across(x, z)) - 0.02 * Math.min(along(x, z), 0);
    const pond = floodPond({ heightAt, isWater: () => false, waterDepth: () => 0 }, spot, 1)!;
    const upstream = (geo: THREE.BufferGeometry): number[] => {
      const p = geo.getAttribute('position');
      return Array.from({ length: p.count }, (_, i) => -along(p.getX(i), p.getZ(i)));
    };
    const cut = upstream(buildPondGeometry(pond, spot)!);
    expect(Math.min(...cut)).toBeGreaterThan(-1e-6);
    expect(cut.filter((u) => Math.abs(u) < 1e-6).length).toBeGreaterThan(4);
    // Without the wall the cells along it spill past it, up to a cell's width.
    expect(Math.min(...upstream(buildPondGeometry(pond)!))).toBeLessThan(-0.5);
  });
});
