// Draws the rocks near the beaver: irregular grey lumps, some with moss, lying on the stream bed, the bank, and stony
// ground. Which rocks lie there is worked out by `rocksNear`, so the view only places what the sim would let the beaver
// pick up. Reads state only.
import * as THREE from 'three';
import { ROCK_RADIUS, rocksNear, type Dropped } from '../sim/haul';
import type { Terrain } from '../sim/terrain';
import { BARK, lilyPad, lump, mergeParts, paintLump, propMaterial, seeded, stick, stickBetween } from './propShapes';

export interface RockView {
  /** Draw the rocks round a point, not those in `taken`. Rebuilds when the beaver has moved on or a rock was taken. */
  update(terrain: Terrain, x: number, z: number, taken: readonly string[], dropped?: readonly Dropped[]): void;
}

/** Rocks are drawn this far round the beaver, in metres, and rebuilt after it moves an eighth of that. */
const DRAW_RADIUS = 120;
const REBUILD_DISTANCE = DRAW_RADIUS / 8;
const MAX_ROCKS = 600;
const MAX_MOUNDS = 200;
const MAX_FOOD = 100;
/** A drawn rock is this many times the radius the sim uses, so it reads from a distance. */
const DRAW_SCALE = 1.3;
/** Rock shapes: a rounded boulder and a flatter, sharper slab. Each rock takes one by where it lies. */
const ROCK_SHAPES = 2;

const STONE = new THREE.Color(0x8d8f8c);
const MOSS = new THREE.Color(0x6f7d4a);
const MUD = new THREE.Color(0x5a3f28);
const WET_MUD = new THREE.Color(0x3a2818);

/** A dropped branch: a stick along x with a side twig, 0.9 m long. */
function branchGeometry(): THREE.BufferGeometry {
  const random = seeded(31);
  const bark = BARK[1]!;
  return mergeParts([
    stick(0.9, 0.06, 6, bark, random),
    stickBetween(new THREE.Vector3(0.05, 0, 0), new THREE.Vector3(0.38, 0.03, 0.2), 0.03, 4, bark, random),
  ]);
}

export function createRockView(scene: THREE.Scene, prepare: (m: THREE.Material) => void): RockView {
  const material = propMaterial();
  prepare(material);
  const instanced = (geometry: THREE.BufferGeometry, count: number): THREE.InstancedMesh => {
    const m = new THREE.InstancedMesh(geometry, material, count);
    m.count = 0;
    m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  const shapes = Array.from({ length: ROCK_SHAPES }, (_, k) => {
    const random = seeded(101 + k);
    const g = paintLump(lump(random, k === 0 ? 0.18 : 0.3, 0, k === 0 ? -0.5 : -0.3), STONE, random, { color: MOSS, share: 0.25 });
    return g.scale(ROCK_RADIUS * DRAW_SCALE, ROCK_RADIUS * DRAW_SCALE * (k === 0 ? 1 : 0.75), ROCK_RADIUS * DRAW_SCALE);
  });
  const meshes = shapes.map((g) => instanced(g, MAX_ROCKS));
  // Mud the beaver put down lies as a low brown mound.
  const moundRandom = seeded(7);
  const mounds = instanced(paintLump(lump(moundRandom, 0.15, 1, -0.3), MUD, moundRandom, { color: WET_MUD, share: 0.3 }).scale(0.5, 0.5, 0.5), MAX_MOUNDS);
  // Food put down lies as a small branch or a notched green pad.
  const sticks = instanced(branchGeometry(), MAX_FOOD);
  const pads = instanced(lilyPad(0.35, 0.04, 10), MAX_FOOD);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const tint = new THREE.Color();
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
        rotation.setFromEuler(euler.set(0, Math.abs(m.x * 5 + m.z * 3) % (Math.PI * 2), 0));
        matrix.compose(new THREE.Vector3(m.x, terrain.heightAt(m.x, m.z) + 0.02, m.z), rotation, new THREE.Vector3(0.8, 0.28, 0.8));
        mounds.setMatrixAt(i, matrix);
      });
      const food = (kind: string, mesh: THREE.InstancedMesh): void => {
        const these = dropped.filter((d) => d.kind === kind).slice(0, MAX_FOOD);
        these.forEach((d, i) => {
          rotation.setFromEuler(euler.set(0, Math.abs(d.x * 7 + d.z * 13) % (Math.PI * 2), 0));
          matrix.compose(new THREE.Vector3(d.x, terrain.heightAt(d.x, d.z) + 0.06, d.z), rotation, new THREE.Vector3(1, 1, 1));
          mesh.setMatrixAt(i, matrix);
        });
        mesh.count = these.length;
        mesh.instanceMatrix.needsUpdate = true;
      };
      food('branch', sticks);
      food('lily', pads);
      mounds.count = piles.length;
      mounds.instanceMatrix.needsUpdate = true;
      const counts = meshes.map(() => 0);
      for (const rock of rocks) {
        // A rock on the bed of a stream sits on the bed, under the water, so the ground is where it rests. Its shape,
        // turn, size, and shade of grey follow from where it lies, so it looks the same every time it is drawn.
        const spin = (Math.abs(rock.x * 7 + rock.z * 13) % 1) * Math.PI * 2;
        const size = 0.7 + 0.6 * (Math.abs(rock.x * 3 + rock.z * 5) % 1);
        const k = Math.floor((Math.abs(rock.x * 11 + rock.z * 17) % 1) * ROCK_SHAPES);
        const tilt = ((Math.abs(rock.x * 19 + rock.z * 23) % 1) - 0.5) * 0.4;
        rotation.setFromEuler(euler.set(tilt, spin, tilt * 0.5));
        matrix.compose(new THREE.Vector3(rock.x, terrain.heightAt(rock.x, rock.z) + ROCK_RADIUS * 0.3, rock.z), rotation, new THREE.Vector3(size, size * 0.7, size));
        const mesh = meshes[k]!;
        const i = counts[k]!++;
        mesh.setMatrixAt(i, matrix);
        const shade = 0.8 + 0.35 * (Math.abs(rock.x * 29 + rock.z * 31) % 1);
        mesh.setColorAt(i, tint.setRGB(shade, shade * (0.98 + 0.04 * (k / ROCK_SHAPES)), shade * (k === 0 ? 0.97 : 1.03)));
      }
      meshes.forEach((mesh, k) => {
        mesh.count = counts[k]!;
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      });
    },
  };
}
