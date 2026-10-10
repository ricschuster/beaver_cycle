import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { BROADLEAF_SHAPE, TREE_SHAPE } from '../terrain/trees';
import { broadleafGeometry, coniferGeometry, SHRUB_BARE_SHRINK, shrubGeometry } from './treeModels';

const triangles = (g: THREE.BufferGeometry): number => g.getAttribute('position').count / 3;

/** Vertices of the wood (the `tree` attribute's wood flag is 1). */
function woodOf(g: THREE.BufferGeometry): number[] {
  const t = g.getAttribute('tree');
  const wood: number[] = [];
  for (let i = 0; i < t.count; i++) if (t.getX(i) === 1) wood.push(i);
  return wood;
}

describe('tree models', () => {
  it('stay cheap: they are drawn by the ten thousand', () => {
    expect([0, 1].map((l) => triangles(coniferGeometry(l)))).toEqual([21, 12]);
    expect([0, 1].map((l) => triangles(broadleafGeometry(l)))).toEqual([53, 41]);
  });

  it('keep a conifer within the cone the camera and the walking use', () => {
    for (const level of [0, 1]) {
      const { radius, height, base } = TREE_SHAPE[level]!;
      const p = coniferGeometry(level).getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const up = p.getY(i) - base;
        expect(up).toBeGreaterThanOrEqual(-1e-6);
        expect(up).toBeLessThanOrEqual(height + 1e-6);
        // the tiers stand out a little past the cone, never more than a quarter of its foot
        expect(Math.hypot(p.getX(i), p.getZ(i))).toBeLessThanOrEqual(radius * (1 - up / height) + radius * 0.25);
      }
    }
  });

  it('gives a near conifer a trunk and a far one none', () => {
    expect(woodOf(coniferGeometry(0)).length).toBe(9);
    expect(woodOf(coniferGeometry(1)).length).toBe(0);
  });

  it('keeps a broadleaf crown round its centre, where the foliage shrinks it to', () => {
    for (const level of [0, 1]) {
      const { radius, centre } = BROADLEAF_SHAPE[level]!;
      const g = broadleafGeometry(level);
      const p = g.getAttribute('position');
      const crown = g.getAttribute('crown');
      let crownVerts = 0;
      for (let i = 0; i < p.count; i++) {
        if (crown.getX(i) !== 1) continue;
        crownVerts++;
        expect(crown.getY(i)).toBeCloseTo(centre, 5);
        expect(Math.hypot(p.getX(i), p.getY(i) - centre, p.getZ(i))).toBeLessThan(radius * 1.3);
      }
      expect(crownVerts).toBeGreaterThan(0);
    }
  });

  it('shades a crown lighter on top than underneath', () => {
    const { centre } = BROADLEAF_SHAPE[0]!;
    const g = broadleafGeometry(0);
    const p = g.getAttribute('position');
    const c = g.getAttribute('color');
    const crown = g.getAttribute('crown');
    let top = { y: -Infinity, shade: 0 };
    let bottom = { y: Infinity, shade: 0 };
    for (let i = 0; i < p.count; i++) {
      if (crown.getX(i) !== 1) continue;
      if (p.getY(i) > top.y) top = { y: p.getY(i), shade: c.getX(i) };
      if (p.getY(i) < bottom.y) bottom = { y: p.getY(i), shade: c.getX(i) };
    }
    expect(top.y).toBeGreaterThan(centre);
    expect(top.shade).toBeGreaterThan(bottom.shade);
  });

  it('holds snow only on faces that look up: the conifer tiers and the upper faces of the bare branches', () => {
    for (const geo of [coniferGeometry(0), broadleafGeometry(0)]) {
      const t = geo.getAttribute('tree');
      const n = geo.getAttribute('normal');
      let caught = 0;
      for (let i = 0; i < t.count; i++) {
        if (t.getY(i) <= 0) continue;
        caught++;
        expect(n.getY(i)).toBeGreaterThan(0);
      }
      expect(caught).toBeGreaterThan(0);
    }
  });

  it('turns the faces of a conifer outward', () => {
    const g = coniferGeometry(0);
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    // the tiers and the trunk are round the y axis, so their faces look away from it
    for (let i = 0; i < p.count; i++) expect(p.getX(i) * n.getX(i) + p.getZ(i) * n.getZ(i)).toBeGreaterThanOrEqual(-1e-6);
  });
});

describe('shrub model', () => {
  it('stays cheap, since a scrub slope has thousands', () => {
    expect(triangles(shrubGeometry())).toBe(20);
  });

  it('is low and wider than it is tall, and sits in the ground with no faces under it', () => {
    const g = shrubGeometry();
    g.computeBoundingBox();
    const box = g.boundingBox!;
    expect(box.max.y).toBeGreaterThan(0.6);
    expect(box.max.y).toBeLessThan(1.1);
    expect(box.min.y).toBeLessThan(0); // the foot is below the ground, so it never floats
    expect(box.max.x - box.min.x).toBeGreaterThan(box.max.y);
    const n = g.getAttribute('normal');
    for (let i = 0; i < n.count; i++) expect(n.getY(i)).toBeGreaterThan(-0.5);
  });

  it('is all leaves, shrinking a little towards its foot when bare', () => {
    const g = shrubGeometry();
    const t = g.getAttribute('tree');
    const crown = g.getAttribute('crown');
    for (let i = 0; i < t.count; i++) {
      expect(t.getX(i)).toBe(0);
      expect(crown.getX(i)).toBeCloseTo(SHRUB_BARE_SHRINK, 6);
      expect(crown.getY(i)).toBe(0);
    }
  });

  it('holds snow on its top and none low down', () => {
    const g = shrubGeometry();
    const p = g.getAttribute('position');
    const t = g.getAttribute('tree');
    let top = { y: -Infinity, snow: 0 };
    let low = { y: Infinity, snow: 0 };
    for (let i = 0; i < p.count; i++) {
      if (p.getY(i) > top.y) top = { y: p.getY(i), snow: t.getY(i) };
      if (p.getY(i) < low.y) low = { y: p.getY(i), snow: t.getY(i) };
    }
    expect(top.snow).toBeGreaterThan(0.6);
    expect(low.snow).toBeLessThan(0.3);
  });
});
