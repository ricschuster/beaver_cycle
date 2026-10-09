// Draws the ambient animals (src/sim/animals.ts) as simple low shapes, one colour each, like the rest of the game.
// Each animal gets a small group, made when first seen and hidden when it is gone. Reads state only.
import * as THREE from 'three';
import type { Animal, AnimalKind } from '../sim/animals';

export interface AnimalView {
  /** Place the animals of this frame. `now` is the real time in seconds, for the walking bob. */
  update(animals: readonly Animal[], now: number): void;
}

interface Part {
  size: [number, number, number];
  at: [number, number, number];
  colour: number;
}

/** Each kind as boxes, facing +z, standing on y = 0. Sizes in metres. */
const PARTS: Record<AnimalKind, Part[]> = {
  deer: [
    { size: [0.5, 0.55, 1.2], at: [0, 0.95, 0], colour: 0x9a6a3e },
    { size: [0.2, 0.7, 0.2], at: [0.17, 0.35, 0.45], colour: 0x7a5230 },
    { size: [0.2, 0.7, 0.2], at: [-0.17, 0.35, 0.45], colour: 0x7a5230 },
    { size: [0.2, 0.7, 0.2], at: [0.17, 0.35, -0.45], colour: 0x7a5230 },
    { size: [0.2, 0.7, 0.2], at: [-0.17, 0.35, -0.45], colour: 0x7a5230 },
    { size: [0.2, 0.6, 0.22], at: [0, 1.45, 0.55], colour: 0x9a6a3e },
    { size: [0.24, 0.24, 0.4], at: [0, 1.7, 0.78], colour: 0x8a5c34 },
  ],
  fox: [
    { size: [0.28, 0.3, 0.7], at: [0, 0.45, 0], colour: 0xd0702a },
    { size: [0.1, 0.3, 0.1], at: [0.1, 0.15, 0.25], colour: 0x3a2a20 },
    { size: [0.1, 0.3, 0.1], at: [-0.1, 0.15, 0.25], colour: 0x3a2a20 },
    { size: [0.1, 0.3, 0.1], at: [0.1, 0.15, -0.25], colour: 0x3a2a20 },
    { size: [0.1, 0.3, 0.1], at: [-0.1, 0.15, -0.25], colour: 0x3a2a20 },
    { size: [0.22, 0.22, 0.3], at: [0, 0.6, 0.45], colour: 0xd8803a },
    { size: [0.16, 0.16, 0.55], at: [0, 0.5, -0.6], colour: 0xf0e8dc },
  ],
  duck: [
    { size: [0.3, 0.2, 0.5], at: [0, 0.1, 0], colour: 0x8a7050 },
    { size: [0.16, 0.2, 0.16], at: [0, 0.3, 0.2], colour: 0x2f6a4a },
    { size: [0.1, 0.05, 0.12], at: [0, 0.3, 0.33], colour: 0xe0a020 },
  ],
  heron: [
    { size: [0.1, 0.8, 0.1], at: [0, 0.4, 0], colour: 0xb0a090 },
    { size: [0.28, 0.4, 0.6], at: [0, 0.95, 0], colour: 0x8c9aa6 },
    { size: [0.08, 0.5, 0.08], at: [0, 1.4, 0.25], colour: 0xd8dde0 },
    { size: [0.1, 0.1, 0.34], at: [0, 1.65, 0.4], colour: 0xe0b040 },
  ],
};

function build(kind: AnimalKind, prepare: (m: THREE.Material) => void): THREE.Group {
  const group = new THREE.Group();
  for (const p of PARTS[kind]) {
    const material = new THREE.MeshLambertMaterial({ color: p.colour });
    prepare(material);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...p.size), material);
    mesh.position.set(...p.at);
    mesh.castShadow = true;
    group.add(mesh);
  }
  return group;
}

export function createAnimalView(scene: THREE.Scene, prepare: (m: THREE.Material) => void): AnimalView {
  // Spare groups of each kind, and the ones now in use by animal id.
  const spare: Record<AnimalKind, THREE.Group[]> = { deer: [], fox: [], duck: [], heron: [] };
  const used = new Map<string, { kind: AnimalKind; group: THREE.Group }>();
  return {
    update(animals, now) {
      const seen = new Set<string>();
      for (const a of animals) {
        seen.add(a.id);
        let entry = used.get(a.id);
        if (entry && entry.kind !== a.kind) {
          entry.group.visible = false;
          spare[entry.kind].push(entry.group);
          used.delete(a.id);
          entry = undefined;
        }
        if (!entry) {
          const group = spare[a.kind].pop() ?? build(a.kind, prepare);
          if (group.parent !== scene) scene.add(group);
          entry = { kind: a.kind, group };
          used.set(a.id, entry);
        }
        const g = entry.group;
        g.visible = true;
        const bob = a.moving ? Math.abs(Math.sin(now * 5 + a.x)) * 0.05 : 0;
        g.position.set(a.x, a.y + bob, a.z);
        g.rotation.y = a.heading;
      }
      for (const [id, entry] of used) {
        if (seen.has(id)) continue;
        entry.group.visible = false;
        spare[entry.kind].push(entry.group);
        used.delete(id);
      }
    },
  };
}
