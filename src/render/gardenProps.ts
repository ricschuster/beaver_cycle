// The veggie garden's shapes (docs/design/50_veggie_garden_dream.md): lettuce and broccoli trees, leeks, bean poles, cabbages,
// pumpkins and radishes for the land, the veggie sweets, the garden beds with the plants that grow in them, and the watering
// can. Built as the candy ones are (dreamProps.ts): at size 1 on the origin, a colour per vertex, so a patch of them merges
// into one mesh. These only use helpers of dreamProps in their bodies, never when this file loads.
import * as THREE from 'three';
import type { PropKind, VegKind } from '../sim/dream';
import { BED_RADIUS } from '../sim/dreamLand';
import { merge, paint, plainPaint, put } from './dreamProps';

type Shape = (colour: number, random: () => number) => THREE.BufferGeometry;

const col = (hex: number): THREE.Color => new THREE.Color(hex);
const STEM = col(0xd9eab0);
const LEAF = [0xa6dc66, 0x82c94e, 0x5fae3c].map(col);
const BROCCOLI = [0x3f8f3a, 0x4fa043, 0x2f7a32].map(col);
const WOOD = col(0xa9794a);

/** A leaf blob: a squashed ball in a green with a little variation from face to face. */
function blob(base: THREE.Color, random: () => number, rx: number, ry: number, rz: number, spread = 0.08): THREE.BufferGeometry {
  return paint(new THREE.SphereGeometry(1, 8, 5).scale(rx, ry, rz), () => base.clone().multiplyScalar(1 - spread / 2 + random() * spread));
}

/** A lettuce tree: a pale thick stem with a ruffled crown of curled leaves in three greens. About 3.2 m high. */
function lettuceTree(colour: number, random: () => number): THREE.BufferGeometry {
  void colour;
  const parts = [put(plainPaint(new THREE.CylinderGeometry(0.14, 0.2, 2.2, 8, 1, true), STEM), 0, 1.1, 0)];
  const layers: [number, number, number, number][] = [[2.0, 0.95, 7, 0], [2.5, 0.8, 7, 0.4], [2.95, 0.55, 5, 0.9]];
  layers.forEach(([y, r, n, turn], k) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + turn + random() * 0.2;
      parts.push(put(blob(LEAF[k]!, random, 0.55, 0.2, 0.4), Math.sin(a) * r, y + random() * 0.1, Math.cos(a) * r, 0.5 - k * 0.2, a, 0));
    }
  });
  parts.push(put(blob(LEAF[0]!, random, 0.45, 0.4, 0.45), 0, 3.05, 0));
  return merge(parts);
}

/** A broccoli tree: a pale stalk and a crown of dark green florets. About 3 m high. */
function broccoliTree(colour: number, random: () => number): THREE.BufferGeometry {
  void colour;
  const parts = [put(plainPaint(new THREE.CylinderGeometry(0.13, 0.19, 1.9, 8, 1, true), col(0xc9e6a0)), 0, 0.95, 0)];
  for (const [x, y, z, r] of [[0, 2.5, 0, 0.7], [0.65, 2.2, 0.1, 0.5], [-0.55, 2.25, -0.2, 0.52], [0.1, 2.15, 0.65, 0.48], [-0.1, 2.2, -0.65, 0.46], [0.15, 2.95, 0.1, 0.42]] as const) {
    parts.push(put(blob(BROCCOLI[Math.floor(random() * BROCCOLI.length)]!, random, r, r * 0.85, r, 0.2), x, y, z));
  }
  return merge(parts);
}

/** A leek: a white stalk with a fan of long green leaves. About 2 m high. */
function leek(colour: number, random: () => number): THREE.BufferGeometry {
  void colour;
  const parts = [put(plainPaint(new THREE.CylinderGeometry(0.1, 0.13, 1.0, 8, 1, true), col(0xf4f8e6)), 0, 0.5, 0)];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + random() * 0.4;
    const tilt = 0.25 + random() * 0.3;
    const leaf = paint(new THREE.CylinderGeometry(0.02, 0.1, 1.5, 4, 1, true), () => LEAF[1 + (i % 2)]!);
    parts.push(put(leaf, Math.sin(a) * 0.2, 1.5, Math.cos(a) * 0.2, Math.cos(a) * tilt, 0, -Math.sin(a) * tilt));
  }
  return merge(parts);
}

/** A bean pole: three sticks in a tepee, a vine winding up them and a few bean pods hanging. About 2.4 m high. */
function beanPole(colour: number, random: () => number): THREE.BufferGeometry {
  void colour;
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push(put(plainPaint(new THREE.CylinderGeometry(0.03, 0.05, 2.5, 5, 1, true), WOOD), Math.sin(a) * 0.22, 1.2, Math.cos(a) * 0.22, Math.cos(a) * 0.18, 0, -Math.sin(a) * 0.18));
  }
  const turns = 14;
  for (let i = 0; i < turns; i++) {
    const f = i / turns;
    const a = f * Math.PI * 6;
    const r = 0.22 * (1 - f * 0.9) + 0.04;
    parts.push(put(blob(LEAF[2]!, random, 0.12, 0.05, 0.09, 0.2), Math.sin(a) * r, 0.2 + f * 2.1, Math.cos(a) * r, 0.3, a, 0));
  }
  for (let i = 0; i < 5; i++) {
    const a = random() * Math.PI * 2;
    parts.push(put(blob(LEAF[0]!, random, 0.04, 0.2, 0.04), Math.sin(a) * 0.17, 0.9 + random() * 1.0, Math.cos(a) * 0.17));
  }
  return merge(parts);
}

/** A cabbage: a big ball of layered leaves, the outer ones darker and open at the foot. About 1.7 m across and 1.5 m high. */
function cabbage(colour: number, random: () => number): THREE.BufferGeometry {
  void colour;
  const parts = [put(blob(col(0xc5e68e), random, 0.72, 0.7, 0.72, 0.1), 0, 0.72, 0)];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + random() * 0.3;
    parts.push(put(blob(LEAF[1 + (i % 2)]!, random, 0.62, 0.52, 0.28, 0.12), Math.sin(a) * 0.4, 0.62, Math.cos(a) * 0.4, 0, a, 0.35));
  }
  parts.push(put(blob(col(0xdff0b0), random, 0.35, 0.3, 0.35), 0.05, 1.3, 0));
  return merge(parts);
}

/** A pumpkin: orange ribs round a squat ball, a green stem and a curl. About 1.8 m across and 1.4 m high. */
function pumpkin(colour: number, random: () => number): THREE.BufferGeometry {
  void colour;
  const orange = col(0xf29a2e);
  const parts: THREE.BufferGeometry[] = [];
  const ribs = 8;
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI;
    parts.push(put(blob(orange.clone().multiplyScalar(0.94 + (i % 2) * 0.08), random, 0.62, 0.62, 0.62, 0.04).scale(1, 1, 1), 0, 0.68, 0, 0, a, 0, 1, 1, 0.55));
  }
  parts.push(put(plainPaint(new THREE.CylinderGeometry(0.07, 0.11, 0.34, 6), col(0x6f9a3a)), 0, 1.38, 0, 0.15, 0, 0));
  parts.push(put(plainPaint(new THREE.TorusGeometry(0.1, 0.025, 5, 10, Math.PI * 1.5), col(0x6f9a3a)), 0.1, 1.2, 0.1, 0, 0.6, 0));
  return merge(parts);
}

/** A radish: a pink ball half out of the ground with a tuft of leaves. About 1.4 m across and 1.8 m high. */
function radish(colour: number, random: () => number): THREE.BufferGeometry {
  void colour;
  const parts = [paint(new THREE.SphereGeometry(0.62, 12, 8).scale(1, 0.95, 1), (c) => (c.y < -0.05 ? col(0xf8e8ee) : col(0xe0407a).lerp(col(0xff7aa6), Math.max(0, c.y))))];
  put(parts[0]!, 0, 0.45, 0);
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + random() * 0.3;
    parts.push(put(blob(LEAF[1 + (i % 2)]!, random, 0.14, 0.7, 0.07, 0.12), Math.sin(a) * 0.28, 1.45, Math.cos(a) * 0.28, Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5));
  }
  return merge(parts);
}

export const GARDEN_SHAPES: Partial<Record<PropKind, Shape>> = { lettuceTree, broccoliTree, leek, beanPole, cabbage, pumpkin, radish };

/** The veggie sweets, about half a metre: a pea pod, a carrot, a sunflower (the star), and a lettuce leaf pad. */
export function gardenSweetShapes(): Record<'drop' | 'swirl' | 'star' | 'lily', { geometry: THREE.BufferGeometry; tinted: boolean }[]> {
  const random = () => 0.5;
  const pod = merge([
    plainPaint(new THREE.SphereGeometry(1, 10, 6).scale(0.34, 0.12, 0.14), col(0x7fc94f)),
    ...[-0.17, 0, 0.17].map((x) => put(plainPaint(new THREE.SphereGeometry(0.095, 8, 6), col(0xb6ee7a)), x, 0.06, 0)),
  ]);
  const carrot = merge([
    put(plainPaint(new THREE.ConeGeometry(0.1, 0.48, 8), col(0xf2831c)), 0, 0, 0, 0, 0, -Math.PI / 2),
    ...[-0.04, 0.04].map((z) => put(blob(LEAF[1]!, random, 0.14, 0.04, 0.05), 0.27, 0.01, z, 0, z * 5, 0)),
  ]);
  const petals = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return put(plainPaint(new THREE.SphereGeometry(1, 8, 5).scale(0.13, 0.05, 0.05), col(0xffd633)), Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0, 0, 0, a);
  });
  const sunflower = merge([...petals, plainPaint(new THREE.CylinderGeometry(0.17, 0.17, 0.08, 14).rotateX(Math.PI / 2), col(0x7a4a1c))]);
  const leaf = merge([
    plainPaint(new THREE.CylinderGeometry(0.5, 0.5, 0.05, 20, 1, false, 0.35, Math.PI * 2 - 0.7), col(0x9ad45f)),
    put(plainPaint(new THREE.CylinderGeometry(0.52, 0.52, 0.03, 20, 1, true, 0.35, Math.PI * 2 - 0.7), col(0x6fb845)), 0, -0.01, 0),
    put(plainPaint(new THREE.SphereGeometry(1, 8, 6).scale(0.12, 0.05, 0.12), col(0xd8f0a8)), 0, 0.05, 0),
  ]);
  return {
    drop: [{ geometry: pod, tinted: false }],
    swirl: [{ geometry: carrot, tinted: false }],
    star: [{ geometry: sunflower, tinted: false }],
    lily: [{ geometry: leaf, tinted: false }],
  };
}

/** The wooden posts round each garden bed, merged into one geometry; `groundAt` gives the ground under a post. */
export function bedsGeometry(beds: readonly { x: number; z: number }[], groundAt: (x: number, z: number) => number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const posts = 12;
  for (const bed of beds) {
    for (let i = 0; i < posts; i++) {
      const a = (i / posts) * Math.PI * 2;
      const x = bed.x + Math.sin(a) * (BED_RADIUS + 0.15);
      const z = bed.z + Math.cos(a) * (BED_RADIUS + 0.15);
      parts.push(put(plainPaint(new THREE.CylinderGeometry(0.07, 0.09, 0.45, 6), i % 2 === 0 ? WOOD : col(0xc79a64)), x, groundAt(x, z) + 0.2, z));
    }
  }
  return merge(parts);
}

const PLANT_LEAF = col(0x78c04a);
const plantCache = new Map<string, THREE.BufferGeometry>();

/**
 * A plant at a stage from 0 (a sprout) to `stages` (full size): a stem and leaves that grow, and from the middle stages its
 * vegetable, the pea pods, the carrot shoulder, tomatoes, a radish, or a pumpkin, getting bigger. Stands on the bed's middle.
 */
export function plantGeometry(veg: VegKind, stage: number, stages: number): THREE.BufferGeometry {
  const key = `${veg}${stage}`;
  const known = plantCache.get(key);
  if (known) return known;
  const f = Math.max(0, Math.min(1, stage / stages));
  const random = () => 0.5;
  const parts: THREE.BufferGeometry[] = [];
  const height = 0.18 + 1.9 * f;
  parts.push(put(plainPaint(new THREE.CylinderGeometry(0.03 + 0.05 * f, 0.05 + 0.07 * f, height, 6, 1, true), col(0x5da03a)), 0, height / 2, 0));
  const leaves = 2 + stage;
  for (let i = 0; i < leaves; i++) {
    const a = i * 2.4;
    const y = height * (0.25 + 0.7 * (i / leaves));
    const r = (0.1 + 0.4 * f) * (1 - 0.3 * (i / leaves));
    parts.push(put(blob(PLANT_LEAF, random, r, r * 0.18, r * 0.55), Math.sin(a) * r, y, Math.cos(a) * r, 0.3, a, 0));
  }
  const ripe = Math.max(0, (stage - 2) / (stages - 2));
  if (ripe > 0) {
    const r = 0.12 + 0.5 * ripe;
    if (veg === 'pea') {
      for (let i = 0; i < 3; i++) parts.push(put(blob(col(0x8fd860), random, r * 0.3, r, r * 0.3), Math.sin(i * 2.1) * 0.25, height * 0.55, Math.cos(i * 2.1) * 0.25, 0, 0, 0.1));
    } else if (veg === 'carrot') {
      parts.push(put(blob(col(0xf2831c), random, r * 0.8, r * 0.5, r * 0.8), 0, 0.05, 0));
    } else if (veg === 'tomato') {
      for (let i = 0; i < 3; i++) parts.push(put(blob(col(0xe8402e), random, r * 0.7, r * 0.7, r * 0.7, 0.05), Math.sin(i * 2.1) * 0.3, height * (0.3 + 0.12 * i), Math.cos(i * 2.1) * 0.3));
    } else if (veg === 'radish') {
      parts.push(put(blob(col(0xe0407a), random, r * 0.8, r * 0.8, r * 0.8, 0.05), 0, r * 0.4, 0));
    } else {
      parts.push(put(blob(col(0xf29a2e), random, r * 1.2, r, r * 1.2, 0.05), 0.35 * f, r * 0.8, 0.25 * f));
    }
  }
  const geometry = merge(parts);
  plantCache.set(key, geometry);
  return geometry;
}

/** Free the plant shapes made so far (when the dream ends). */
export function disposePlants(): void {
  for (const g of plantCache.values()) g.dispose();
  plantCache.clear();
}

/** A small watering can, about 0.5 m long, standing on the origin with its spout along +z. One mesh. */
export function wateringCan(): THREE.BufferGeometry {
  const body = col(0x4fb3d9);
  const dark = col(0x2f86ad);
  return merge([
    put(plainPaint(new THREE.CylinderGeometry(0.15, 0.17, 0.3, 12), body), 0, 0.15, 0),
    put(plainPaint(new THREE.CylinderGeometry(0.035, 0.05, 0.34, 8), dark), 0, 0.28, 0.24, Math.PI / 2 - 0.7, 0, 0),
    put(plainPaint(new THREE.CylinderGeometry(0.07, 0.04, 0.06, 8), dark), 0, 0.42, 0.37, Math.PI / 2 - 0.7, 0, 0),
    put(plainPaint(new THREE.TorusGeometry(0.1, 0.022, 6, 12, Math.PI), dark), 0, 0.3, -0.12, 0, Math.PI / 2, -0.3),
  ]);
}
