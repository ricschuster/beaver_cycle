import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BARK, CUT_WOOD, lilyFlower, lilyPad, lump, mergeParts, paintLump, seedAt, seedOf, seeded, stick } from './propShapes';

const positions = (g: THREE.BufferGeometry): number[] => Array.from(g.getAttribute('position').array);

describe('seeded', () => {
  it('repeats for a seed and differs between seeds', () => {
    const a = seeded(42);
    const b = seeded(42);
    const draws = Array.from({ length: 5 }, () => a());
    expect(Array.from({ length: 5 }, () => b())).toEqual(draws);
    expect(seeded(43)()).not.toBe(draws[0]);
    for (const d of draws) {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThan(1);
    }
  });

  it('keys ids and points the same way every time', () => {
    expect(seedOf('tree:1')).toBe(seedOf('tree:1'));
    expect(seedOf('tree:1')).not.toBe(seedOf('tree:2'));
    expect(seedAt(10.001, 5)).toBe(seedAt(10.001, 5));
  });
});

describe('shapes', () => {
  it('gives a stick pale cut ends and bark sides', () => {
    const g = stick(2, 0.1, 5, BARK[0]!, seeded(1));
    const c = g.getAttribute('color');
    const colors = new Set<string>();
    for (let i = 0; i < c.count; i++) colors.add(`${c.getX(i).toFixed(3)},${c.getY(i).toFixed(3)},${c.getZ(i).toFixed(3)}`);
    expect(colors.has(`${CUT_WOOD.r.toFixed(3)},${CUT_WOOD.g.toFixed(3)},${CUT_WOOD.b.toFixed(3)}`)).toBe(true);
    expect(colors.size).toBeGreaterThan(2);
    const box = new THREE.Box3().setFromBufferAttribute(g.getAttribute('position') as THREE.BufferAttribute);
    expect(box.max.x - box.min.x).toBeCloseTo(2);
  });

  it('makes the same lump for the same seed, with joined faces and a flat underside', () => {
    const a = lump(seeded(5), 0.3);
    expect(positions(lump(seeded(5), 0.3))).toEqual(positions(a));
    expect(positions(lump(seeded(6), 0.3))).not.toEqual(positions(a));
    // Every corner the faces share moved alike: a dodecahedron has 20 corners, so no more than 20 distinct points.
    const p = a.getAttribute('position');
    const points = new Set<string>();
    let lowest = Infinity;
    for (let i = 0; i < p.count; i++) {
      points.add(`${p.getX(i).toFixed(4)}:${p.getY(i).toFixed(4)}:${p.getZ(i).toFixed(4)}`);
      lowest = Math.min(lowest, p.getY(i));
    }
    expect(points.size).toBeLessThanOrEqual(20);
    expect(lowest).toBeCloseTo(-0.45);
  });

  it('cuts a notch out of a lily pad', () => {
    const notch = 0.6;
    const g = lilyPad(1, 0.1, 12, notch);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      if (Math.hypot(p.getX(i), p.getZ(i)) < 0.5) continue;
      // No rim point lies inside the notch, which opens along +x.
      expect(Math.abs(Math.atan2(p.getZ(i), p.getX(i)))).toBeGreaterThanOrEqual(notch / 2 - 1e-6);
    }
  });

  it('merges painted parts into one geometry with colours and face normals', () => {
    const parts = [stick(1, 0.1, 5, BARK[0]!, seeded(1)), paintLump(lump(seeded(2), 0.2), BARK[1]!, seeded(3)), lilyFlower(0.3)];
    const count = parts.reduce((n, g) => n + g.getAttribute('position').count, 0);
    const merged = mergeParts(parts);
    expect(merged.getAttribute('position').count).toBe(count);
    expect(merged.getAttribute('color').count).toBe(count);
    expect(merged.getAttribute('normal').count).toBe(count);
    expect(merged.index).toBeNull();
  });
});
