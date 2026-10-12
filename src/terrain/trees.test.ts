import { describe, expect, it } from 'vitest';
import { CLASS_LAKE } from './format';
import { makeTile } from './testing';
import { KIND_BROADLEAF, KIND_CONIFER, placeTrees, TREE_FLOATS, TreeGrid, treeId, treeIdPosition, treeKind, woodOfTree } from './trees';

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

  it('keeps trees out of the lake shallows', () => {
    // forest on a slope from 595 m (below a 600 m lake) to 605 m, with a lake cell at the west edge
    const tile = makeTile(0, 0, 0, (x) => 595 + (x / 320) * 10, 2);
    tile.classes[0] = CLASS_LAKE;
    const dry = placeTrees(tile, 320, undefined, null);
    const wet = placeTrees(tile, 320, undefined, 600);
    expect(count(wet)).toBeLessThan(count(dry));
    // only the cells at the lake cell are cut: trees on low ground elsewhere stay
    expect(count(dry) - count(wet)).toBeLessThan(10);
    for (let k = 0; k < count(wet); k++) {
      const [x, y, z] = [wet[k * 5]!, wet[k * 5 + 1]!, wet[k * 5 + 2]!];
      if (x < 10 && z < 10) expect(y).toBeGreaterThanOrEqual(600.3);
    }
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

describe('felling', () => {
  const tile = () => makeTile(3, -2, 0, () => 600, 2);
  const idOf = (t: Float32Array, k: number): string => treeId(t[k * 5]!, t[k * 5 + 2]!);

  it('leaves a felled tree out and keeps all the others where they were', () => {
    const all = placeTrees(tile(), 320);
    const gone = idOf(all, 7);
    const left = placeTrees(tile(), 320, new Set([gone]));
    expect(count(left)).toBe(count(all) - 1);
    const rest = Array.from(all).filter((_, i) => i < 7 * 5 || i >= 8 * 5);
    expect(Array.from(left)).toEqual(rest);
  });

  it('turns an id back into its position, to half a metre', () => {
    const at = treeIdPosition(treeId(-123.26, 40.74));
    expect(at.x).toBeCloseTo(-123.5, 5);
    expect(at.z).toBeCloseTo(40.5, 5);
  });

  it('gives two logs for big trees and one for small', () => {
    expect(woodOfTree(0.8)).toBe(1);
    expect(woodOfTree(1.25)).toBe(2);
  });

  it('finds the nearest standing tree in reach', () => {
    const t = placeTrees(tile(), 320);
    const grid = new TreeGrid(t, 0);
    const [x, z] = [t[0]!, t[2]!];
    const found = grid.nearest(x + 0.1, z, 3, new Set());
    expect(found?.id).toBe(idOf(t, 0));
    expect(grid.nearest(x + 0.1, z, 3, new Set([found!.id]))?.id).not.toBe(found!.id);
    expect(grid.nearest(x, z, 0.001, new Set([found!.id]))).toBeNull();
  });
});
