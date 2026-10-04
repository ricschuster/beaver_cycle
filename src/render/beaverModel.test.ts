import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBeaverModel } from './beaverModel';

describe('createBeaverModel', () => {
  it('is about a metre and a half long with its tail, and stands on its origin', () => {
    const { group } = createBeaverModel();
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.y).toBeLessThan(0.9);
    expect(box.max.z - box.min.z).toBeGreaterThan(1);
    expect(box.max.z - box.min.z).toBeLessThan(2);
  });

  it('faces +z: the head is in front of the tail', () => {
    const { group } = createBeaverModel();
    const box = new THREE.Box3().setFromObject(group);
    const front = box.max.z;
    const back = box.min.z;
    expect(front).toBeGreaterThan(0.4);
    expect(back).toBeLessThan(-0.5);
  });

  it('stands still at speed 0 and bobs when walking', () => {
    const m = createBeaverModel();
    m.update(0.3, 0);
    const still = new THREE.Box3().setFromObject(m.group).max.y;
    m.update(0.3, 1);
    const walking = new THREE.Box3().setFromObject(m.group).max.y;
    expect(walking).toBeGreaterThanOrEqual(still);
  });
});
