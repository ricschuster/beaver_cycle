import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildLogShape, createLogView, paintStripped } from './logView';
import type { Log } from '../sim/logs';

describe('buildLogShape', () => {
  it('has a branch for each branch the sim gives the log, and is the same for the same id', () => {
    const shape = buildLogShape('tree:1', 5.5);
    expect(shape.branches).toBe(5);
    expect(shape.geometry.getAttribute('position').count).toBe(shape.trunk + shape.branch * shape.branches);
    expect(Array.from(buildLogShape('tree:1', 5.5).geometry.getAttribute('position').array)).toEqual(Array.from(shape.geometry.getAttribute('position').array));
    expect(Array.from(buildLogShape('tree:2', 5.5).geometry.getAttribute('color').array)).not.toEqual(Array.from(shape.geometry.getAttribute('color').array));
  });

  it('is as long as the log', () => {
    const shape = buildLogShape('tree:1', 4);
    const box = new THREE.Box3().setFromBufferAttribute(shape.geometry.getAttribute('position') as THREE.BufferAttribute);
    expect(box.min.z).toBeCloseTo(-2);
  });
});

describe('paintStripped', () => {
  it('drops stripped branches from the -z end and paints the bark there pale', () => {
    const shape = buildLogShape('tree:1', 4);
    paintStripped(shape, 4, 0.5);
    expect(shape.geometry.drawRange.count).toBe(shape.trunk + shape.branch * 2);
    const colors = shape.geometry.getAttribute('color').array as Float32Array;
    let changed = 0;
    for (let i = 0; i < shape.trunk * 3; i++) if (colors[i] !== shape.bark[i]) changed++;
    expect(changed).toBeGreaterThan(0);
    // Back to bark when it is whole again.
    paintStripped(shape, 4, 0);
    expect(Array.from(colors.slice(0, shape.trunk * 3))).toEqual(Array.from(shape.bark.slice(0, shape.trunk * 3)));
    expect(shape.geometry.drawRange.count).toBeGreaterThanOrEqual(shape.trunk + shape.branch * shape.branches);
  });
});

describe('createLogView', () => {
  it('draws one mesh a log and removes it when the log is gone', () => {
    const scene = new THREE.Scene();
    const view = createLogView(scene, false, () => {});
    const log: Log = { id: 'tree:1', x: 1, y: 2, z: 3, heading: 0.5, length: 4, floating: false };
    view.update([log, { ...log, id: 'tree:2' }]);
    expect(scene.children.length).toBe(2);
    expect(scene.children[0]!.position.toArray()).toEqual([1, 2, 3]);
    view.update([log], { 'tree:1': 4 });
    expect(scene.children.length).toBe(1);
    expect((scene.children[0] as THREE.Mesh).geometry.drawRange.count).toBe(buildLogShape('tree:1', 4).trunk);
  });
});
