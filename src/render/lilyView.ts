// Draws the lily pads near the beaver: bright green discs with a pale flower on some, floating on the water. They are drawn larger than the pick
// radius and out to a long distance so a bay of them reads from across the lake. Which pads float is worked out by
// `lilyPadsNear`, so the view only places what the sim would let the beaver pick. Reads state only.
import * as THREE from 'three';
import { dateAt } from '../sim/clock';
import { LILY_RADIUS, lilyInSeason, lilyPadsNear, type Picked } from '../sim/lily';
import type { Terrain } from '../sim/terrain';

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

export function createLilyView(scene: THREE.Scene, prepare: (m: THREE.Material) => void): LilyView {
  const geometry = new THREE.CircleGeometry(LILY_RADIUS * DRAW_SCALE, 14).rotateX(-Math.PI / 2);
  // A little emissive light keeps the pads bright against dark water and in shade.
  const material = new THREE.MeshLambertMaterial({ color: 0x86d65c, emissive: 0x2c5a1c });
  prepare(material);
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_PADS);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const flowerGeometry = new THREE.CircleGeometry(LILY_RADIUS * 0.9, 8).rotateX(-Math.PI / 2);
  const flowerMaterial = new THREE.MeshLambertMaterial({ color: 0xffe2ec, emissive: 0x80586a });
  prepare(flowerMaterial);
  const flowers = new THREE.InstancedMesh(flowerGeometry, flowerMaterial, MAX_PADS);
  flowers.count = 0;
  flowers.frustumCulled = false;
  scene.add(flowers);
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
        // Sit on the water surface, a hair above it, and vary the size a little by position.
        const surface = terrain.heightAt(pad.x, pad.z) + terrain.waterDepth(pad.x, pad.z) + 0.03;
        const size = 0.8 + 0.4 * ((Math.abs(pad.x * 7 + pad.z * 13) % 1));
        matrix.makeScale(size, 1, size).setPosition(pad.x, surface, pad.z);
        mesh.setMatrixAt(i, matrix);
        if (Math.abs(pad.x * 3 + pad.z * 5) % 1 < FLOWER_SHARE) {
          const dx = ((Math.abs(pad.x * 11) % 1) - 0.5) * 0.5;
          const dz = ((Math.abs(pad.z * 17) % 1) - 0.5) * 0.5;
          matrix.makeScale(size, 1, size).setPosition(pad.x + dx, surface + 0.03, pad.z + dz);
          flowers.setMatrixAt(flowerCount++, matrix);
        }
      });
      mesh.count = pads.length;
      mesh.instanceMatrix.needsUpdate = true;
      flowers.count = flowerCount;
      flowers.instanceMatrix.needsUpdate = true;
    },
  };
}
