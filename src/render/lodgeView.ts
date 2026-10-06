// Draws the lodge of the sim: a dome of sticks that grows as logs are placed. Reads state only.
import * as THREE from 'three';
import { LODGE_RADIUS, lodgeProgress, type Lodge } from '../sim/lodge';

export interface LodgeView {
  update(lodge: Lodge | null): void;
}

/** Height of a whole dome above the water in metres. */
const DOME_HEIGHT = 1.8;
/** How far the dome's foot sinks below the surface, so it sits in the water. */
const SINK = 0.3;

export function createLodgeView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void): LodgeView {
  // A unit half sphere, flat side down, scaled to the lodge's radius and height.
  const geometry = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({ color: 0x7a5a38, flatShading: true });
  prepare(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.visible = false;
  scene.add(mesh);
  return {
    update(lodge) {
      mesh.visible = lodge !== null;
      if (!lodge) return;
      const p = lodgeProgress(lodge);
      mesh.position.set(lodge.x, lodge.base - SINK, lodge.z);
      mesh.scale.set(LODGE_RADIUS, DOME_HEIGHT * (0.25 + 0.75 * p), LODGE_RADIUS);
    },
  };
}
