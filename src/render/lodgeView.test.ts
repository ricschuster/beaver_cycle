import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildLodgeShape, createLodgeView, sticksShown } from './lodgeView';
import { LODGE_RADIUS, LODGE_WOOD, type Lodge } from '../sim/lodge';

describe('buildLodgeShape', () => {
  it('is the mud dome followed by sticks of one size, the same for the same seed', () => {
    const shape = buildLodgeShape(7);
    expect(shape.geometry.getAttribute('position').count).toBe(shape.mud + shape.stick * shape.sticks);
    expect(Number.isInteger(shape.stick)).toBe(true);
    expect(Array.from(buildLodgeShape(7).geometry.getAttribute('position').array)).toEqual(Array.from(shape.geometry.getAttribute('position').array));
    // Stays low poly: a lodge is under 2000 triangles.
    expect(shape.geometry.getAttribute('position').count / 3).toBeLessThan(2000);
  });

  it('pokes stick ends out past the mud', () => {
    const shape = buildLodgeShape(7);
    const box = new THREE.Box3().setFromBufferAttribute(shape.geometry.getAttribute('position') as THREE.BufferAttribute);
    expect(box.max.x).toBeGreaterThan(LODGE_RADIUS);
  });
});

describe('sticksShown', () => {
  it('adds sticks as the lodge is built and loses some as it wears', () => {
    expect(sticksShown(60, 0, 0)).toBeLessThan(sticksShown(60, 0.5, 0));
    expect(sticksShown(60, 1, 0)).toBe(60);
    expect(sticksShown(60, 1, 1)).toBeLessThan(60);
    expect(sticksShown(60, 1, 1)).toBeGreaterThan(30);
  });
});

describe('createLodgeView', () => {
  const lodge: Lodge = { x: 3, z: 4, base: 1, door: 0, wood: LODGE_WOOD };
  const meshOf = (scene: THREE.Scene): THREE.Mesh => scene.children.find((o) => o instanceof THREE.Mesh && o.geometry.getAttribute('color')) as THREE.Mesh;

  it('draws one mesh that greys as the lodge wears and slumps when broken', () => {
    const scene = new THREE.Scene();
    const view = createLodgeView(scene, false, () => {});
    view.update(lodge, 1);
    const mesh = meshOf(scene);
    expect(mesh.visible).toBe(true);
    const color = (): number[] => Array.from((mesh.geometry.getAttribute('color').array as Float32Array).slice(0, 3));
    const fresh = color();
    const height = mesh.scale.y;
    view.update(lodge, 0);
    const worn = color();
    // Greyer: the channels lie closer together.
    expect(Math.max(...worn) - Math.min(...worn)).toBeLessThan(Math.max(...fresh) - Math.min(...fresh));
    expect(mesh.scale.y).toBeLessThan(height);
    view.update(null);
    expect(mesh.visible).toBe(false);
  });

  it('shows fewer sticks on a lodge being built', () => {
    const scene = new THREE.Scene();
    const view = createLodgeView(scene, false, () => {});
    view.update(lodge, 1);
    const whole = meshOf(scene).geometry.drawRange.count;
    view.update({ ...lodge, wood: 2 }, 1);
    expect(meshOf(scene).geometry.drawRange.count).toBeLessThan(whole);
  });
});
