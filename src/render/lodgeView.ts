// Draws the lodge of the sim: a dome of sticks that grows as logs are placed. Reads state only.
import * as THREE from 'three';
import { LODGE_RADIUS, doorPoint, lodgeProgress, type Lodge } from '../sim/lodge';
import { BROKEN_BELOW, WORN_BELOW, needsRepair } from '../sim/wear';
import { createRepairGlow } from './repairGlow';

export interface LodgeView {
  /** Draw the lodge at a condition (0 broken to 1 new): a worn one is paler and slumps, and glows where it needs repair. */
  update(lodge: Lodge | null, level?: number): void;
  /** A ring where a lodge would start: green if it can start there, red if not. Null hides it. */
  preview(at: { x: number; y: number; z: number; ok: boolean } | null): void;
}

/** Height of a whole dome above the water in metres. */
const DOME_HEIGHT = 1.8;
/** How far the dome's foot sinks below the surface, so it sits in the water. */
const SINK = 0.3;

/** `repairable` is false for a lodge the family has left: it gets old but nobody mends it, so it shows no glow. */
export function createLodgeView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void, repairable = true): LodgeView {
  // A unit half sphere, flat side down, scaled to the lodge's radius and height.
  const geometry = new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({ color: 0x7a5a38, flatShading: true });
  prepare(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.visible = false;
  scene.add(mesh);
  // The entrance: a dark mouth at the foot of the dome, facing the deep water.
  const doorMesh = new THREE.Mesh(new THREE.CircleGeometry(0.6, 12), new THREE.MeshBasicMaterial({ color: 0x1a120a, side: THREE.DoubleSide }));
  doorMesh.visible = false;
  scene.add(doorMesh);
  // A flat ring on the water or ground at the spot, drawn over everything so the shore does not hide it.
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x4cd964, transparent: true, opacity: 0.7, depthTest: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(LODGE_RADIUS - 0.25, LODGE_RADIUS, 32).rotateX(-Math.PI / 2), ringMaterial);
  ring.renderOrder = 10;
  ring.visible = false;
  scene.add(ring);
  const glow = createRepairGlow(scene, LODGE_RADIUS + 0.5);
  const newColor = new THREE.Color(0x7a5a38);
  const wornColor = new THREE.Color(0x5b5148);
  return {
    preview(at) {
      ring.visible = at !== null;
      if (!at) return;
      ring.position.set(at.x, at.y + 0.05, at.z);
      ringMaterial.color.set(at.ok ? 0x4cd964 : 0xff5a4d);
    },
    update(lodge, level = 1) {
      mesh.visible = lodge !== null;
      doorMesh.visible = lodge !== null;
      if (!lodge) {
        glow.set(null);
        return;
      }
      const mouth = doorPoint(lodge, LODGE_RADIUS * 0.85);
      doorMesh.position.set(mouth.x, lodge.base - 0.2, mouth.z);
      doorMesh.rotation.y = lodge.door;
      const p = lodgeProgress(lodge);
      mesh.position.set(lodge.x, lodge.base - SINK, lodge.z);
      // Wear greys the sticks and lets the dome slump, down to three quarters of its height when broken.
      const wear = 1 - Math.min(1, level / WORN_BELOW);
      const slump = lodgeProgress(lodge) < 1 ? 1 : 1 - 0.25 * wear;
      material.color.copy(newColor).lerp(wornColor, wear);
      mesh.scale.set(LODGE_RADIUS, DOME_HEIGHT * (0.25 + 0.75 * p) * slump, LODGE_RADIUS);
      glow.set(repairable && p >= 1 && needsRepair(level) ? { x: lodge.x, y: lodge.base, z: lodge.z, broken: level < BROKEN_BELOW } : null);
    },
  };
}
