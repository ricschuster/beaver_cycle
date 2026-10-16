// Draws the food store of the sim: a heap of leafless branches on the lake bed beside the lodge door, which grows as it
// fills, with the lily pads in it lying green on top. The heap is one mesh, remade only when what it holds changes.
// It lies under water, so it shows from above through the water and up close when diving. Reads state only.
import * as THREE from 'three';
import { STORE_CAPACITY, STORE_RADIUS, stockOf, storeFill, storeSpot, type Stock } from '../sim/food';
import type { Lodge } from '../sim/lodge';
import { BROKEN_BELOW, needsRepair } from '../sim/wear';
import { createRepairGlow } from './repairGlow';
import { BARK, lilyPad, mergeParts, place, seeded, stick, stickBetween, vary } from './propShapes';
import { grainMaterial } from './grain';

export interface StoreView {
  /** Draw the store for a whole lodge, or hide it. `bed` is the height of the lake bed at a point, `level` the store's condition. */
  update(lodge: Lodge | null, stock: Stock, bed: (x: number, z: number) => number, level?: number): void;
}

/** Height of a full heap in metres, and of an empty one (a few sticks that mark the spot). */
const FULL_HEIGHT = 1.1;
const EMPTY_HEIGHT = 0.2;
/** Sticks in the heap, each lying at a set angle and offset. */
const STICKS = 36;
/** Willow and aspen bark, the food beavers store, a little greener than the bark of the logs. */
const FOOD_BARK = [...BARK, new THREE.Color(0x7d7a5a), new THREE.Color(0x6f6a4c)];

interface Piece {
  x: number;
  z: number;
  /** 1 in the middle of the heap, 0 at its edge: how high up the heap the piece lies. */
  layer: number;
  turn: number;
  tilt: number;
  length: number;
  /** Seed for the piece's own look: its colour and twigs. */
  seed: number;
}

/** One branch of the heap, along x, with a side twig or two. */
function branch(piece: Piece): THREE.BufferGeometry {
  const random = seeded(piece.seed);
  const bark = vary(FOOD_BARK[Math.floor(random() * FOOD_BARK.length)]!, random, 0.1);
  const parts = [stick(piece.length, 0.065, 5, bark, random)];
  const twigs = 1 + Math.floor(random() * 2);
  for (let k = 0; k < twigs; k++) {
    const along = (random() - 0.5) * piece.length * 0.7;
    const side = random() < 0.5 ? -1 : 1;
    parts.push(stickBetween(new THREE.Vector3(along, 0, 0), new THREE.Vector3(along + 0.35, 0.05 + 0.1 * random(), side * (0.2 + 0.15 * random())), 0.03, 4, bark, random));
  }
  return mergeParts(parts);
}

export function createStoreView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void): StoreView {
  const material = grainMaterial();
  prepare(material);
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.castShadow = shadows;
  mesh.visible = false;
  scene.add(mesh);
  // A fixed scatter so the heap does not change shape from frame to frame: the same pseudo random numbers each time.
  let seed = 7;
  const random = (): number => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const sticks: Piece[] = [];
  for (let i = 0; i < STICKS; i++) {
    const r = Math.sqrt(random()) * STORE_RADIUS * 0.8;
    const a = random() * Math.PI * 2;
    // Low sticks lie at the edge, high ones in the middle: the layer a stick belongs to is set by its distance out.
    sticks.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, layer: 1 - r / (STORE_RADIUS * 0.8), turn: random() * Math.PI, tilt: (random() - 0.5) * 0.5, length: 1.4 + random() * 0.8, seed: 500 + i });
  }
  // Lily pads in the store lie on top of the branches, one for each pad, at the same scatter every time.
  const pads: Piece[] = [];
  for (let i = 0; i < STORE_CAPACITY; i++) {
    const r = Math.sqrt(random()) * STORE_RADIUS * 0.85;
    const a = random() * Math.PI * 2;
    pads.push({ x: Math.sin(a) * r, z: Math.cos(a) * r, layer: 1 - r / (STORE_RADIUS * 0.85), turn: a * 3, tilt: (random() - 0.5) * 0.3, length: 0, seed: 900 + i });
  }
  const branches = sticks.map(branch);
  const pad = lilyPad(0.3, 0.03, 9);
  let shownKey = '';
  const glow = createRepairGlow(scene, STORE_RADIUS + 0.4);
  return {
    update(lodge, stock, bed, level = 1) {
      const spot = storeSpot(lodge);
      mesh.visible = spot !== null;
      if (!spot) {
        glow.set(null);
        return;
      }
      const y = bed(spot.x, spot.z);
      mesh.position.set(spot.x, y, spot.z);
      glow.set(needsRepair(level) ? { x: spot.x, y, z: spot.z, broken: level < BROKEN_BELOW } : null);
      const fill = storeFill(stock);
      const height = EMPTY_HEIGHT + (FULL_HEIGHT - EMPTY_HEIGHT) * fill;
      // The heap's sticks appear one after another as it fills; an empty store keeps a few.
      const shown = Math.max(4, Math.ceil((stockOf(stock, 'branch') / STORE_CAPACITY) * STICKS));
      const lilies = stockOf(stock, 'lily');
      const key = `${shown}:${lilies}:${height}`;
      if (key === shownKey) return;
      shownKey = key;
      const parts: THREE.BufferGeometry[] = [];
      sticks.forEach((u, i) => {
        if (i < shown) parts.push(place(branches[i]!.clone(), { x: u.x, y: 0.08 + height * u.layer * 0.9, z: u.z }, new THREE.Euler(0, u.turn, u.tilt)));
      });
      // The pads sit on the heap: a little above the sticks at their spot.
      pads.forEach((u, i) => {
        if (i < lilies) parts.push(place(pad.clone(), { x: u.x, y: 0.16 + height * u.layer * 0.9, z: u.z }, new THREE.Euler(u.tilt, u.turn, u.tilt)));
      });
      mesh.geometry.dispose();
      mesh.geometry = mergeParts(parts);
    },
  };
}
