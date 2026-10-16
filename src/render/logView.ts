// Draws the logs of the sim, lying on the ground or on the water: a trunk with bark of its own shade, a pale flat cut at
// one end and a gnawed point at the other, and its side branches. Stripping a branch takes it away and leaves the wood
// pale where it was. Reads state only.
import * as THREE from 'three';
import { LOG_RADIUS, type Log } from '../sim/logs';
import { branchesOf } from '../sim/food';
import { BARK, BARK_REPEAT_M, CUT_RING, CUT_WOOD, barkUv, mergeParts, paintFaces, seedOf, seeded, stickBetween, vary, vertexCount } from './propShapes';
import { grainMaterial } from './grain';

export interface LogView {
  update(logs: readonly Log[], stripped?: Readonly<Record<string, number>>): void;
}

/** Faces round a log and round a branch. */
const SIDES = 8;
const BRANCH_SIDES = 4;
/** The gnawed point at the +z end: this long, narrowing to this share of the radius. */
const POINT = 0.45;
const POINT_TIP = 0.3;
/** The pale wood under the bark, where branches were stripped. */
const BARE = new THREE.Color(0xd8b98a);

/** Where along a log of this length (z, from its centre) the gnawed point starts. */
const pointStart = (length: number): number => length / 2 - Math.min(POINT, length * 0.3);

export interface LogShape {
  geometry: THREE.BufferGeometry;
  /** Vertices of the trunk, drawn first. */
  trunk: number;
  /** Vertices of one branch. The branches follow the trunk, the one nearest the +z end first. */
  branch: number;
  branches: number;
  /** The trunk's colours with its bark on; `paintStripped` paints over a copy of them. */
  bark: Float32Array;
}

/**
 * A log of `length` metres along z, centred on the origin, seeded by `id`: a trunk of rings, one ring for each branch so
 * the stripped part ends on a ring, then its branches, one for each `branchesOf` unit, spaced along it.
 */
export function buildLogShape(id: string, length: number): LogShape {
  const random = seeded(seedOf(id));
  const n = Math.max(1, branchesOf({ length }));
  const r = LOG_RADIUS;
  const half = length / 2;
  // The profile from the flat -z end to the gnawed +z point, as (radius, along) pairs for a lathe about the axis.
  const profile: THREE.Vector2[] = [new THREE.Vector2(0, -half), new THREE.Vector2(r, -half)];
  for (let j = 1; j < n; j++) profile.push(new THREE.Vector2(r * (1 - 0.04 * random()), -half + (j * length) / n));
  const pointAt = pointStart(length);
  profile.push(new THREE.Vector2(r * 0.97, pointAt), new THREE.Vector2(r * POINT_TIP, half), new THREE.Vector2(0, half));
  const lathe = new THREE.LatheGeometry(profile, SIDES, random() * Math.PI);
  const trunk = (lathe.index ? lathe.toNonIndexed() : lathe.clone()).rotateX(Math.PI / 2);
  lathe.dispose();
  // The lathe's v follows its profile points, which are not evenly spaced in z, so the grain runs on z itself.
  barkUv(trunk, 2 * Math.PI * r, length);
  const trunkUv = trunk.getAttribute('uv');
  const trunkAt = trunk.getAttribute('position');
  for (let i = 0; i < trunkUv.count; i++) trunkUv.setY(i, (trunkAt.getZ(i) + half) / BARK_REPEAT_M);
  const bark = BARK[Math.floor(random() * BARK.length)]!;
  paintFaces(trunk, (c, normal) => {
    const out = Math.hypot(c.x, c.y);
    // The flat end: pale wood with a darker ring under the bark.
    if (Math.abs(normal.z) > 0.9 && c.z < 0) return out < r * 0.55 ? CUT_WOOD : CUT_RING;
    // The gnawed point is pale too.
    if (c.z > pointAt + 0.01) return vary(CUT_WOOD, random, 0.06);
    return vary(bark, random, 0.14);
  }, (c, normal) => (Math.abs(normal.z) > 0.9 && c.z < 0) || c.z > pointAt + 0.01 ? 0 : 1);
  const parts = [trunk];
  // Branches stand out of the upper half of the log, leaning toward the +z end (the tree's top), each with a twig.
  for (let j = n - 1; j >= 0; j--) {
    const z = -half + ((j + 0.5) * length) / n;
    const a = (random() - 0.5) * Math.PI * 1.1;
    const out = new THREE.Vector3(Math.sin(a), Math.cos(a), 0);
    const from = new THREE.Vector3(out.x * r * 0.8, out.y * r * 0.8, z);
    const reach = 0.7 + random() * 0.5;
    const tip = from.clone().addScaledVector(out, reach).add(new THREE.Vector3(0, 0, reach * 0.7));
    const fork = from.clone().lerp(tip, 0.5);
    const side = new THREE.Vector3(out.y, -out.x, 0).multiplyScalar((random() < 0.5 ? -1 : 1) * 0.35);
    const twig = fork.clone().addScaledVector(out, 0.25).add(side).add(new THREE.Vector3(0, 0, 0.3));
    const wood = vary(bark, random, 0.1);
    parts.push(mergeParts([stickBetween(from, tip, 0.06, BRANCH_SIDES, wood, random), stickBetween(fork, twig, 0.04, BRANCH_SIDES, wood, random)]));
  }
  const trunkCount = vertexCount(trunk);
  const geometry = mergeParts(parts);
  return { geometry, trunk: trunkCount, branch: (vertexCount(geometry) - trunkCount) / n, branches: n, bark: (geometry.getAttribute('color').array as Float32Array).slice() };
}

/** Paint the trunk pale from the -z end over `bare` of its length (0 to 1), and show only the branches left. */
export function paintStripped(shape: LogShape, length: number, bare: number): void {
  const colors = shape.geometry.getAttribute('color') as THREE.BufferAttribute;
  const out = colors.array as Float32Array;
  out.set(shape.bark);
  if (bare > 0) {
    const p = shape.geometry.getAttribute('position');
    const edge = -length / 2 + bare * length + 1e-3;
    for (let f = 0; f < shape.trunk / 3; f++) {
      const z = (p.getZ(f * 3) + p.getZ(f * 3 + 1) + p.getZ(f * 3 + 2)) / 3;
      // Only the bark faces: the side faces sit at the log's radius, the flat end and the point keep their own colours.
      const side = Math.abs(p.getZ(f * 3) - p.getZ(f * 3 + 1)) + Math.abs(p.getZ(f * 3 + 1) - p.getZ(f * 3 + 2)) > 1e-4;
      if (z > edge || !side || z > pointStart(length)) continue;
      for (let k = 0; k < 3; k++) out.set([BARE.r, BARE.g, BARE.b], (f * 3 + k) * 3);
    }
  }
  colors.needsUpdate = true;
  const left = Math.round(shape.branches * (1 - bare));
  shape.geometry.setDrawRange(0, shape.trunk + shape.branch * left);
}

export function createLogView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void): LogView {
  const material = grainMaterial();
  prepare(material);
  const logs = new Map<string, { mesh: THREE.Mesh; shape: LogShape; length: number; bare: number }>();
  return {
    update(list, stripped = {}) {
      const seen = new Set<string>();
      for (const log of list) {
        seen.add(log.id);
        let entry = logs.get(log.id);
        if (entry && entry.length !== log.length) {
          scene.remove(entry.mesh);
          entry.shape.geometry.dispose();
          entry = undefined;
        }
        if (!entry) {
          const shape = buildLogShape(log.id, log.length);
          const mesh = new THREE.Mesh(shape.geometry, material);
          mesh.castShadow = shadows;
          scene.add(mesh);
          entry = { mesh, shape, length: log.length, bare: -1 };
          logs.set(log.id, entry);
        }
        entry.mesh.position.set(log.x, log.y, log.z);
        entry.mesh.rotation.y = log.heading;
        const bare = Math.min(1, (stripped[log.id] ?? 0) / Math.max(1, branchesOf(log)));
        if (bare !== entry.bare) {
          entry.bare = bare;
          paintStripped(entry.shape, log.length, bare);
        }
      }
      for (const [id, entry] of logs) {
        if (seen.has(id)) continue;
        scene.remove(entry.mesh);
        entry.shape.geometry.dispose();
        logs.delete(id);
      }
    },
  };
}
