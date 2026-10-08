// Draws the rocks near the beaver: grey lumps lying on the stream bed, the bank, and stony ground. Which rocks lie
// there is worked out by `rocksNear`, so the view only places what the sim would let the beaver pick up. Reads state only.
import * as THREE from 'three';
import { ROCK_RADIUS, rocksNear, type Dropped } from '../sim/haul';
import type { Terrain } from '../sim/terrain';

export interface RockView {
  /** Draw the rocks round a point, not those in `taken`. Rebuilds when the beaver has moved on or a rock was taken. */
  update(terrain: Terrain, x: number, z: number, taken: readonly string[], dropped?: readonly Dropped[]): void;
}

/** Rocks are drawn this far round the beaver, in metres, and rebuilt after it moves an eighth of that. */
const DRAW_RADIUS = 120;
const REBUILD_DISTANCE = DRAW_RADIUS / 8;
const MAX_ROCKS = 600;
const MAX_MOUNDS = 200;
/** A drawn rock is this many times the radius the sim uses, so it reads from a distance. */
const DRAW_SCALE = 1.3;

export function createRockView(scene: THREE.Scene, prepare: (m: THREE.Material) => void): RockView {
  const geometry = new THREE.IcosahedronGeometry(ROCK_RADIUS * DRAW_SCALE, 0);
  const material = new THREE.MeshLambertMaterial({ color: 0x8d8f8c, flatShading: true });
  prepare(material);
  const mesh = new THREE.InstancedMesh(geometry, material, MAX_ROCKS);
  mesh.count = 0;
  mesh.frustumCulled = false;
  scene.add(mesh);
  // Mud the beaver put down lies as a low brown mound.
  const moundMaterial = new THREE.MeshLambertMaterial({ color: 0x5a3f28 });
  prepare(moundMaterial);
  const mounds = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 10, 6), moundMaterial, MAX_MOUNDS);
  mounds.count = 0;
  mounds.frustumCulled = false;
  scene.add(mounds);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  let lastKey = '';
  let lastX = Infinity;
  let lastZ = Infinity;
  return {
    update(terrain, x, z, taken, dropped = []) {
      const key = `${taken.length}:${dropped.map((d) => d.id).join(',')}`;
      if (key === lastKey && Math.hypot(x - lastX, z - lastZ) < REBUILD_DISTANCE) return;
      lastKey = key;
      lastX = x;
      lastZ = z;
      const all = rocksNear(terrain, x, z, DRAW_RADIUS, taken);
      if (all.length > MAX_ROCKS) all.sort((p, q) => Math.hypot(p.x - x, p.z - z) - Math.hypot(q.x - x, q.z - z));
      const rocks = [...all.slice(0, MAX_ROCKS)];
      // Rocks the beaver put down lie among them (kept to the room that is left).
      for (const d of dropped) if (d.kind === 'rock' && rocks.length < MAX_ROCKS) rocks.push({ id: d.id, x: d.x, z: d.z });
      const piles = dropped.filter((d) => d.kind === 'mud').slice(0, MAX_MOUNDS);
      piles.forEach((m, i) => {
        matrix.compose(new THREE.Vector3(m.x, terrain.heightAt(m.x, m.z) + 0.02, m.z), rotation.identity(), new THREE.Vector3(0.8, 0.28, 0.8));
        mounds.setMatrixAt(i, matrix);
      });
      mounds.count = piles.length;
      mounds.instanceMatrix.needsUpdate = true;
      rocks.forEach((rock, i) => {
        // A rock on the bed of a stream sits on the bed, under the water, so the ground is where it rests.
        const spin = (Math.abs(rock.x * 7 + rock.z * 13) % 1) * Math.PI * 2;
        const size = 0.7 + 0.6 * (Math.abs(rock.x * 3 + rock.z * 5) % 1);
        rotation.setFromEuler(euler.set(spin, spin * 1.7, 0));
        matrix.compose(new THREE.Vector3(rock.x, terrain.heightAt(rock.x, rock.z) + ROCK_RADIUS * 0.3, rock.z), rotation, new THREE.Vector3(size, size * 0.7, size));
        mesh.setMatrixAt(i, matrix);
      });
      mesh.count = rocks.length;
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}
