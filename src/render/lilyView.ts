// Draws the lily pads near the beaver: flat green discs floating on the water. Which pads float is worked out by
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
const DRAW_RADIUS = 50;
const REBUILD_DISTANCE = DRAW_RADIUS / 5;
const MAX_PADS = 300;

export function createLilyView(scene: THREE.Scene, prepare: (m: THREE.Material) => void): LilyView {
  const geometry = new THREE.CircleGeometry(LILY_RADIUS, 12).rotateX(-Math.PI / 2);
  const material = new THREE.MeshLambertMaterial({ color: 0x4f9a46 });
  prepare(material);
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_PADS);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
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
      const pads = lilyPadsNear(terrain, x, z, DRAW_RADIUS, clock, picked).slice(0, MAX_PADS);
      pads.forEach((pad, i) => {
        // Sit on the water surface, a hair above it, and vary the size a little by position.
        const surface = terrain.heightAt(pad.x, pad.z) + terrain.waterDepth(pad.x, pad.z) + 0.03;
        const size = 0.8 + 0.4 * ((Math.abs(pad.x * 7 + pad.z * 13) % 1));
        matrix.makeScale(size, 1, size).setPosition(pad.x, surface, pad.z);
        mesh.setMatrixAt(i, matrix);
      });
      mesh.count = pads.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
