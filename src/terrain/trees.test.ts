import { describe, expect, it } from 'vitest';
import { CLASS_LAKE } from './format';
import { makeTile } from './testing';
import { KIND_BROADLEAF, KIND_CONIFER, placeTrees, TREE_FLOATS, treeKind } from './trees';

const count = (a: Float32Array): number => a.length / TREE_FLOATS;

describe('placeTrees', () => {
  it('places the same trees every time', () => {
    const a = placeTrees(makeTile(3, -2, 0, () => 600, 2), 320);
    const b = placeTrees(makeTile(3, -2, 0, () => 600, 2), 320);
    expect(count(a)).toBeGreaterThan(0);
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it('places trees on forest only, not on meadow or lake', () => {
    expect(count(placeTrees(makeTile(0, 0, 0, () => 0, 1), 320))).toBe(0);
    expect(count(placeTrees(makeTile(0, 0, 0, () => 0, CLASS_LAKE), 320))).toBe(0);
  });

  it('keeps trees inside their tile, standing on the ground', () => {
    const t = placeTrees(makeTile(1, 2, 0, (x) => 500 + x * 0.1, 2), 320);
    for (let k = 0; k < count(t); k++) {
      const [x, y, z] = [t[k * 5]!, t[k * 5 + 1]!, t[k * 5 + 2]!];
      expect(x).toBeGreaterThanOrEqual(320);
      expect(x).toBeLessThanOrEqual(640);
      expect(z).toBeGreaterThanOrEqual(640);
      expect(z).toBeLessThanOrEqual(960);
      expect(y).toBeCloseTo(500 + x * 0.1, 3);
    }
  });

  it('places fewer trees at level 1 and none at level 2', () => {
    const l0 = count(placeTrees(makeTile(0, 0, 0, () => 0, 2), 320));
    const l1 = count(placeTrees(makeTile(0, 0, 1, () => 0, 2), 320));
    expect(l1).toBeGreaterThan(0);
    expect(l1).toBeLessThan(l0 / 2);
    expect(count(placeTrees(makeTile(0, 0, 2, () => 0, 2), 320))).toBe(0);
  });

  it('mixes broadleaf trees into the conifers, in stands', () => {
    const t = placeTrees(makeTile(0, 0, 0, () => 0, 2), 320);
    let broad = 0;
    for (let k = 0; k < count(t); k++) {
      const kind = t[k * 5 + 4];
      expect([KIND_CONIFER, KIND_BROADLEAF]).toContain(kind);
      if (kind === KIND_BROADLEAF) broad++;
    }
    const share = broad / count(t);
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.5);
  });

  it('gives a spot the same kind every time', () => {
    expect(treeKind(123.4, -56.7)).toBe(treeKind(123.4, -56.7));
  });
});
