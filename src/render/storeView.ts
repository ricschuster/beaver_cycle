// Draws the food store of the sim: a heap of branches on the lake bed beside the lodge door, which grows as it fills, with
// the lily pads in it lying green on top.
// It lies under water, so it shows from above through the water and up close when diving. Reads state only.
import * as THREE from 'three';
import { STORE_CAPACITY, STORE_RADIUS, stockOf, storeFill, storeSpot, type Stock } from '../sim/food';
import type { Lodge } from '../sim/lodge';
import { BROKEN_BELOW, needsRepair } from '../sim/wear';
import { createRepairGlow } from './repairGlow';

export interface StoreView {
  /** Draw the store for a whole lodge, or hide it. `bed` is the height of the lake bed at a point, `level` the store's condition. */
  update(lodge: Lodge | null, stock: Stock, bed: (x: number, z: number) => number, level?: number): void;
}

/** Height of a full heap in metres, and of an empty one (a few sticks that mark the spot). */
const FULL_HEIGHT = 1.1;
const EMPTY_HEIGHT = 0.2;
/** Sticks in the heap, each a thin cylinder lying at a set angle and offset. */
const STICKS = 36;

export function createStoreView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void): StoreView {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const geometry = new THREE.CylinderGeometry(0.06, 0.07, 1, 5).rotateZ(Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({ color: 0x8a6a42, flatShading: true });
  prepare(material);
  const sticks: THREE.Mesh[] = [];
  // A fixed scatter so the heap does not change shape from frame to frame: the same pseudo random numbers each time.
  let seed = 7;
  const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < STICKS; i++) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = shadows;
    const r = Math.sqrt(random()) * STORE_RADIUS * 0.8;
    const a = random() * Math.PI * 2;
    // Low sticks lie at the edge, high ones in the middle: the layer a stick belongs to is set by its distance out.
    mesh.userData = { x: Math.sin(a) * r, z: Math.cos(a) * r, layer: 1 - r / (STORE_RADIUS * 0.8), turn: random() * Math.PI, tilt: (random() - 0.5) * 0.5, length: 1.4 + random() * 0.8 };
    group.add(mesh);
    sticks.push(mesh);
  }
  // Lily pads in the store lie on top of the branches as flat green discs, one for each pad, at the same scatter every time.
  const padGeometry = new THREE.CircleGeometry(0.3, 8).rotateX(-Math.PI / 2);
  const padMaterial = new THREE.MeshLambertMaterial({ color: 0x4f9d4b, flatShading: true, side: THREE.DoubleSide });
  prepare(padMaterial);
  const pads: THREE.Mesh[] = [];
  for (let i = 0; i < STORE_CAPACITY; i++) {
    const mesh = new THREE.Mesh(padGeometry, padMaterial);
    const r = Math.sqrt(random()) * STORE_RADIUS * 0.85;
    const a = random() * Math.PI * 2;
    mesh.userData = { x: Math.sin(a) * r, z: Math.cos(a) * r, layer: 1 - r / (STORE_RADIUS * 0.85), tilt: (random() - 0.5) * 0.3 };
    group.add(mesh);
    pads.push(mesh);
  }
  const glow = createRepairGlow(scene, STORE_RADIUS + 0.4);
  return {
    update(lodge, stock, bed, level = 1) {
      const spot = storeSpot(lodge);
      group.visible = spot !== null;
      if (!spot) {
        glow.set(null);
        return;
      }
      const y = bed(spot.x, spot.z);
      group.position.set(spot.x, y, spot.z);
      glow.set(needsRepair(level) ? { x: spot.x, y, z: spot.z, broken: level < BROKEN_BELOW } : null);
      const fill = storeFill(stock);
      const height = EMPTY_HEIGHT + (FULL_HEIGHT - EMPTY_HEIGHT) * fill;
      // The heap's sticks appear one after another as it fills; an empty store keeps a few.
      const branches = stockOf(stock, 'branch');
      const shown = Math.max(4, Math.ceil((branches / STORE_CAPACITY) * STICKS));
      sticks.forEach((mesh, i) => {
        const u = mesh.userData as { x: number; z: number; layer: number; turn: number; tilt: number; length: number };
        mesh.visible = i < shown;
        mesh.position.set(u.x, 0.08 + height * u.layer * 0.9, u.z);
        mesh.rotation.set(0, u.turn, u.tilt);
        mesh.scale.set(u.length, 1, 1);
      });
      // The pads sit on the heap: a little above the sticks at their spot.
      const lilies = stockOf(stock, 'lily');
      pads.forEach((mesh, i) => {
        const u = mesh.userData as { x: number; z: number; layer: number; tilt: number };
        mesh.visible = i < lilies;
        mesh.position.set(u.x, 0.16 + height * u.layer * 0.9, u.z);
        mesh.rotation.set(u.tilt, 0, u.tilt);
      });
    },
  };
}
