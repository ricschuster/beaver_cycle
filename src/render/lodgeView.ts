// Draws the lodge of the sim: a dome of mud with crossed sticks laid over it, their ends poking out, that grows as logs
// are placed. Reads state only.
import * as THREE from 'three';
import { LODGE_RADIUS, doorPoint, lodgeProgress, type Lodge } from '../sim/lodge';
import { BROKEN_BELOW, WORN_BELOW, needsRepair } from '../sim/wear';
import { createRepairGlow } from './repairGlow';
import { BARK, PEELED, mergeParts, paintFaces, seedAt, seeded, stickBetween, vary, vertexCount } from './propShapes';
import { grainMaterial } from './grain';

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
/** Sticks laid over the dome; every FOOT_EVERY-th of them lies round its foot at the water line instead. */
const STICKS = 68;
const FOOT_EVERY = 5;
/** Faces round a stick. */
const STICK_SIDES = 5;

export interface LodgeShape {
  geometry: THREE.BufferGeometry;
  /** Vertices of the mud dome, drawn first. */
  mud: number;
  /** Vertices of one stick; the sticks follow the mud, each the same size. */
  stick: number;
  /** How many sticks there are. */
  sticks: number;
}

/**
 * The whole lodge in metres, its foot at y = 0 and its top at DOME_HEIGHT + SINK: a lumpy mud dome, then the sticks in
 * the order they are added as it is built. `seed` picks the lumps and how the sticks lie.
 */
export function buildLodgeShape(seed: number): LodgeShape {
  const random = seeded(seed);
  const radius = LODGE_RADIUS;
  const height = DOME_HEIGHT + SINK;
  // The mud: a half sphere pushed in and out a little, keyed on where each corner is so the faces stay joined.
  const half = new THREE.SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const dome = half.toNonIndexed();
  half.dispose();
  const p = dome.getAttribute('position');
  const push = new Map<string, number>();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(3)}:${p.getY(i).toFixed(3)}:${p.getZ(i).toFixed(3)}`;
    let k = push.get(key);
    if (k === undefined) {
      k = 0.92 + 0.08 * random();
      push.set(key, k);
    }
    p.setXYZ(i, p.getX(i) * radius * k, p.getY(i) * height * (p.getY(i) > 0.01 ? k : 1), p.getZ(i) * radius * k);
  }
  const mud = new THREE.Color(0x684e38);
  const wet = new THREE.Color(0x3a2c20);
  paintFaces(dome, (c) => vary(mud, random, 0.14).lerp(wet, Math.max(0, 1 - c.y / (SINK + 0.4)) * 0.7));
  const parts: THREE.BufferGeometry[] = [dome];
  // A point on the dome at angle `a` round it and `phi` down from the top, the way out of the dome there, and the
  // ways down the slope and round it.
  const surface = (a: number, phi: number): { at: THREE.Vector3; out: THREE.Vector3; down: THREE.Vector3; round: THREE.Vector3 } => {
    const at = new THREE.Vector3(radius * Math.sin(phi) * Math.cos(a), height * Math.cos(phi), radius * Math.sin(phi) * Math.sin(a));
    const out = new THREE.Vector3(at.x / (radius * radius), at.y / (height * height), at.z / (radius * radius)).normalize();
    const round = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
    const down = round.clone().cross(out).normalize();
    return { at, out, down, round };
  };
  // Beavers build with sticks they have peeled, so about half are pale.
  const woodOf = (): THREE.Color => (random() < 0.45 ? vary(PEELED, random, 0.1) : vary(BARK[Math.floor(random() * BARK.length)]!, random, 0.08));
  const total = STICKS;
  for (let i = 0; i < total; i++) {
    // Some sticks lie round the foot, spread through the list so the foot fills in as the dome does.
    const foot = i % FOOT_EVERY === FOOT_EVERY - 1;
    const a = random() * Math.PI * 2;
    // Spread evenly over the dome's area.
    const phi = foot ? Math.PI / 2 - 0.1 : Math.acos(0.22 + 0.75 * random());
    const s = surface(a, phi);
    const length = foot ? 1.5 + random() * 0.6 : 1.2 + random() * 0.9;
    const thick = 0.07 + random() * 0.05;
    // Sticks cross at a slant to the slope, some one way and some the other; a few stand out at one end.
    // On the steep lower wall they lie flatter, so none stands like a pole in the water.
    const slant = foot ? Math.PI / 2 - 0.2 + random() * 0.4 : (random() < 0.5 ? -1 : 1) * Math.max(phi > 0.95 ? 1.05 : 0, 0.5 + random() * 0.9);
    const dir = s.down.clone().multiplyScalar(Math.cos(slant)).addScaledVector(s.round, Math.sin(slant));
    const poke = !foot && random() < 0.18;
    if (poke) dir.addScaledVector(s.out, 0.35).normalize();
    const centre = s.at.clone().addScaledVector(s.out, thick + (poke ? 0.15 : 0.02));
    if (foot) centre.y = SINK + 0.05 + random() * 0.15;
    parts.push(stickBetween(centre.clone().addScaledVector(dir, -length / 2), centre.clone().addScaledVector(dir, length / 2), thick, STICK_SIDES, woodOf(), random));
  }
  const mudCount = vertexCount(dome);
  const geometry = mergeParts(parts);
  return { geometry, mud: mudCount, stick: (vertexCount(geometry) - mudCount) / total, sticks: total };
}

/** How many of the sticks show: they are added as the lodge is built, and a worn lodge loses some. */
export function sticksShown(total: number, progress: number, wear: number): number {
  return Math.round(total * (0.3 + 0.7 * progress) * (1 - 0.35 * wear));
}

/** `repairable` is false for a lodge the family has left: it gets old but nobody mends it, so it shows no glow. */
export function createLodgeView(scene: THREE.Scene, shadows: boolean, prepare: (m: THREE.Material) => void, repairable = true): LodgeView {
  // One mesh for the dome and its sticks. Its shape is made when a lodge first shows, keyed on where it stands.
  const material = grainMaterial();
  prepare(material);
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  mesh.visible = false;
  scene.add(mesh);
  let shape: LodgeShape | null = null;
  let shapeSeed = -1;
  let fresh = new Float32Array(0);
  let shownWear = -1;
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
  // Wear greys the wood and the mud: each colour moves toward a cool grey of its own brightness.
  const grey = new THREE.Color();
  const wornTint = new THREE.Color(0xb0b0bc);
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
      const seed = seedAt(lodge.x, lodge.z);
      if (!shape || seed !== shapeSeed) {
        shape?.geometry.dispose();
        shape = buildLodgeShape(seed);
        shapeSeed = seed;
        mesh.geometry = shape.geometry;
        fresh = (shape.geometry.getAttribute('color').array as Float32Array).slice();
        shownWear = -1;
      }
      mesh.position.set(lodge.x, lodge.base - SINK, lodge.z);
      // Wear greys the sticks, thins them, and lets the dome slump, down to three quarters of its height when broken.
      const wear = 1 - Math.min(1, level / WORN_BELOW);
      const slump = p < 1 ? 1 : 1 - 0.25 * wear;
      mesh.scale.set(1, (0.25 + 0.75 * p) * slump, 1);
      shape.geometry.setDrawRange(0, shape.mud + shape.stick * sticksShown(shape.sticks, p, wear));
      // Recolour only when the wear shown changes, in twentieths.
      const step = Math.round(wear * 20) / 20;
      if (step !== shownWear) {
        shownWear = step;
        const colors = shape.geometry.getAttribute('color') as THREE.BufferAttribute;
        const out = colors.array as Float32Array;
        for (let i = 0; i < out.length; i += 3) {
          const light = (fresh[i]! + fresh[i + 1]! + fresh[i + 2]!) / 3;
          grey.setRGB(light, light, light).multiply(wornTint);
          out[i] = fresh[i]! + (grey.r - fresh[i]!) * step * 0.85;
          out[i + 1] = fresh[i + 1]! + (grey.g - fresh[i + 1]!) * step * 0.85;
          out[i + 2] = fresh[i + 2]! + (grey.b - fresh[i + 2]!) * step * 0.85;
        }
        colors.needsUpdate = true;
      }
      glow.set(repairable && p >= 1 && needsRepair(level) ? { x: lodge.x, y: lodge.base, z: lodge.z, broken: level < BROKEN_BELOW } : null);
    },
  };
}
