import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { Animal, AnimalKind } from '../sim/animals';
import { createAnimalModel, createAnimalView } from './animalView';
import { triangles } from './modelKit';

/** Each kind with its longest side in metres (about, as drawn) and its most triangles. Birds and the frog stay small. */
const KINDS: Record<AnimalKind, { size: number; cap: number }> = {
  deer: { size: 2.1, cap: 4000 },
  fox: { size: 1.6, cap: 4000 },
  duck: { size: 0.85, cap: 2600 },
  heron: { size: 1.6, cap: 2600 },
  owl: { size: 1.65, cap: 2600 },
  lynx: { size: 1.4, cap: 4000 },
  wolf: { size: 2.1, cap: 4000 },
  bear: { size: 2.3, cap: 4000 },
  frog: { size: 0.27, cap: 2000 },
  otter: { size: 1.45, cap: 2600 },
  kingfisher: { size: 0.26, cap: 1500 },
};

function box(o: THREE.Object3D): THREE.Box3 {
  o.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(o);
}

describe('createAnimalModel', () => {
  for (const [kind, { size, cap }] of Object.entries(KINDS) as [AnimalKind, { size: number; cap: number }][]) {
    it(`draws a ${kind} standing on its origin, facing +z, of a sane size and triangle count`, () => {
      const m = createAnimalModel(kind);
      for (let t = 0; t <= 2; t += 1 / 30) m.pose(t, false, 1);
      const b = box(m.group);
      // On the ground or the water at y = 0: nothing sinks far below it, and the lowest part is near it.
      expect(b.min.y).toBeGreaterThan(-0.12);
      expect(b.min.y).toBeLessThan(0.06);
      const dims = b.getSize(new THREE.Vector3());
      const longest = Math.max(dims.x, dims.y, dims.z);
      expect(longest).toBeGreaterThan(size * 0.7);
      expect(longest).toBeLessThan(size * 1.3);
      // The head is ahead, on +z.
      const head = m.group.getObjectByName('head');
      expect(head).toBeDefined();
      expect(head!.getWorldPosition(new THREE.Vector3()).z).toBeGreaterThan(0);
      expect(triangles(m.group)).toBeLessThan(cap);
    });
  }

  it('poses the same at the same time, with no randomness', () => {
    const a = createAnimalModel('fox');
    const b = createAnimalModel('fox');
    for (let t = 0; t <= 1.5; t += 1 / 30) {
      a.pose(t, true, 2);
      b.pose(t, true, 2);
    }
    expect(box(a.group).equals(box(b.group))).toBe(true);
  });

  it('beats the wings of a flying owl', () => {
    const m = createAnimalModel('owl');
    for (let t = 0; t <= 2; t += 1 / 30) m.pose(t, false, 0);
    const perched = box(m.group).getSize(new THREE.Vector3()).x;
    for (let t = 2; t <= 4; t += 1 / 30) m.pose(t, true, 0);
    expect(box(m.group).getSize(new THREE.Vector3()).x).toBeGreaterThan(perched * 1.5);
  });
});

describe('createAnimalView', () => {
  it('places a model for each animal and hides it when the animal is gone', () => {
    const scene = new THREE.Scene();
    const prepared: THREE.Material[] = [];
    const view = createAnimalView(scene, (m) => prepared.push(m));
    const deer: Animal = { id: 'a', kind: 'deer', x: 5, y: 1, z: -3, heading: 0.5, moving: true };
    view.update([deer], 1);
    expect(scene.children).toHaveLength(1);
    const g = scene.children[0]!;
    expect(g.visible).toBe(true);
    expect(g.position.toArray()).toEqual([5, 1, -3]);
    expect(prepared.length).toBeGreaterThan(5);
    view.update([], 2);
    expect(g.visible).toBe(false);
    // The spare model is used again for the next deer.
    view.update([{ ...deer, id: 'b' }], 3);
    expect(scene.children).toHaveLength(1);
    expect(g.visible).toBe(true);
  });
});
