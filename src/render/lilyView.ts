// Draws the lily pads near the beaver: bright green pads with a notch, a white flower on some, floating on the water. They are drawn larger than the pick
// radius and out to a long distance so a bay of them reads from across the lake. Which pads float is worked out by
// `lilyPadsNear`, so the view only places what the sim would let the beaver pick. Reads state only.
import * as THREE from 'three';
import { dateAt } from '../sim/clock';
import { LILY_RADIUS, lilyInSeason, lilyPadsNear, type Picked } from '../sim/lily';
import type { Terrain } from '../sim/terrain';
import { lilyFlower, lilyPad, propMaterial } from './propShapes';

export interface LilyView {
  /** Draw the pads around a point for this clock and these picked pads. Rebuilds when the beaver has moved on or a pad was picked. */
  update(terrain: Terrain, x: number, z: number, clock: number, picked: Picked): void;
}

/** Pads are drawn this far round the beaver, in metres, and rebuilt after it moves a fifth of that. */
const DRAW_RADIUS = 160;
const REBUILD_DISTANCE = DRAW_RADIUS / 8;
const MAX_PADS = 1500;
/** A drawn pad is this many times the radius the sim uses, so it shows from a distance. */
const DRAW_SCALE = 2.2;
/** The share of pads that carry a flower. */
const FLOWER_SHARE = 0.4;
/** A pad is a thin slab this high in metres, standing a little out of the water, and a flower this wide (one petal long) on top of it. */
const PAD_HEIGHT = 0.14;
const PAD_LIFT = 0.04;
const FLOWER_SIZE = 0.36;

export function createLilyView(scene: THREE.Scene, prepare: (m: THREE.Material) => void): LilyView {
  // A notched pad, pale in the middle, with a little emissive light that keeps it bright against dark water and in shade.
  const material = propMaterial({ emissive: 0x24501a });
  prepare(material);
  const mesh = new THREE.InstancedMesh(lilyPad(LILY_RADIUS * DRAW_SCALE, PAD_HEIGHT, 14), material, MAX_PADS);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  // A white flower with a yellow heart; its petals are single sheets, so both sides show.
  const flowerMaterial = propMaterial({ emissive: 0x8a8080, side: THREE.DoubleSide });
  prepare(flowerMaterial);
  const flowers = new THREE.InstancedMesh(lilyFlower(FLOWER_SIZE), flowerMaterial, MAX_PADS);
  flowers.count = 0;
  flowers.frustumCulled = false;
  scene.add(flowers);
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const at = new THREE.Vector3();
  const tint = new THREE.Color();
  const matrix = new THREE.Matrix4();
  let lastKey = '';
  let lastX = Infinity;
  let lastZ = Infinity;
  return {
    update(terrain, x, z, clock, picked) {
      const key = `${Object.keys(picked).length}:${lilyInSeason(clock)}:${dateAt(clock).year}`;
      if (key === lastKey && Math.hypot(x - lastX, z - lastZ) < REBUILD_DISTANCE) return;
      lastKey = key;
      lastX = x;
      lastZ = z;
      const all = lilyPadsNear(terrain, x, z, DRAW_RADIUS, clock, picked);
      if (all.length > MAX_PADS) all.sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z));
      const pads = all.slice(0, MAX_PADS);
      let flowerCount = 0;
      pads.forEach((pad, i) => {
        // Stand a little out of the water, and vary the size a little by position.
        const surface = terrain.heightAt(pad.x, pad.z) + terrain.waterDepth(pad.x, pad.z);
        const size = 0.8 + 0.4 * ((Math.abs(pad.x * 7 + pad.z * 13) % 1));
        // Turn each pad its own way, so the notches do not all point alike, and vary its green a little.
        rotation.setFromAxisAngle(up, (Math.abs(pad.x * 5 + pad.z * 3) % 1) * Math.PI * 2);
        matrix.compose(at.set(pad.x, surface + PAD_LIFT, pad.z), rotation, scale.set(size, 1, size));
        mesh.setMatrixAt(i, matrix);
        const shade = Math.abs(pad.x * 13 + pad.z * 7) % 1;
        mesh.setColorAt(i, tint.setRGB(0.88 + 0.2 * shade, 0.95 + 0.08 * shade, 0.85 + 0.1 * (1 - shade)));
        if (Math.abs(pad.x * 3 + pad.z * 5) % 1 < FLOWER_SHARE) {
          const dx = ((Math.abs(pad.x * 11) % 1) - 0.5) * 0.5;
          const dz = ((Math.abs(pad.z * 17) % 1) - 0.5) * 0.5;
          matrix.compose(at.set(pad.x + dx, surface + PAD_LIFT + PAD_HEIGHT / 2, pad.z + dz), rotation, scale.set(size, size, size));
          flowers.setMatrixAt(flowerCount++, matrix);
        }
      });
      mesh.count = pads.length;
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      flowers.count = flowerCount;
      flowers.instanceMatrix.needsUpdate = true;
    },
  };
}
