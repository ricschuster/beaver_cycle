// Tree placement. Trees are not stored: they are placed from a tile's land
// cover classes with a seeded generator, so every device gets the same trees
// (docs/design/14_m2_streamed_core_plan.md). No three.js here.
import type { TreeRef } from '../sim/trees';
import { CLASS_LAKE, LEVEL_FINE, sampleHeight, type DecodedTile } from './format';

const CLASS_FOREST = 2;
const CLASS_SCRUB = 3;

/** Trees per square metre, by level then class. Level 2 has no trees. */
const DENSITY: Record<number, Record<number, number>> = {
  0: { [CLASS_FOREST]: 1 / 70, [CLASS_SCRUB]: 1 / 400 },
  1: { [CLASS_FOREST]: 1 / 280 },
};
/** Coarser levels draw fewer, bigger trees so the woods keep their mass. */
const LEVEL_SCALE = [1, 1.8];
/** Test knob: multiplies every density (the stress runs for the tablet budgets set it from the URL). */
export const treeTuning = { densityScale: 1 };
/** Cone of a tree at scale 1, by shown level: base radius, height, and base height above the ground. */
export const TREE_SHAPE = [
  { radius: 1.8, height: 9, base: -0.5 },
  { radius: 2.4, height: 10, base: -0.5 },
];
/** Kinds of tree. Conifers stay green all year; broadleaf trees turn and drop their leaves in autumn. */
export const KIND_CONIFER = 0;
export const KIND_BROADLEAF = 1;
/**
 * Crown of a broadleaf tree at scale 1, by shown level: radius, and the height of its centre above
 * the base. A trunk of the same base runs up into it.
 */
export const BROADLEAF_SHAPE = [
  { radius: 3, centre: 6.3, base: -0.5 },
  { radius: 3.6, centre: 6.5, base: -0.5 },
];
/** Floats per tree in the placement array: x, y, z, scale, kind. */
export const TREE_FLOATS = 5;

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable number in [0, 1) for a pair of integers, so a tree's kind never depends on the order trees are placed in. */
function hash01(a: number, b: number, salt: number): number {
  let h = (Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Kind of the tree at a spot. The valley is mostly spruce, with beech and maple in stands: a stand is a
 * 60 m patch, about three in ten of them mostly broadleaf, the rest mostly conifer.
 */
export function treeKind(x: number, z: number): number {
  const stand = hash01(Math.floor(x / 60), Math.floor(z / 60), 1);
  const share = stand < 0.3 ? 0.7 : 0.08;
  return hash01(Math.floor(x * 4), Math.floor(z * 4), 2) < share ? KIND_BROADLEAF : KIND_CONIFER;
}

/** Stable id of a tree from where it stands (to half a metre), so felled trees can be skipped when tiles are rebuilt. */
export function treeId(x: number, z: number): string {
  return `${Math.round(x * 2)}:${Math.round(z * 2)}`;
}

/** Where a tree id says the tree stands, in metres. */
export function treeIdPosition(id: string): { x: number; z: number } {
  const [x, z] = id.split(':').map(Number);
  return { x: x! / 2, z: z! / 2 };
}

/** Logs a tree of this scale gives when felled: the bigger trees give two (Q16). */
export function woodOfTree(scale: number): number {
  return scale >= 1.1 ? 2 : 1;
}

function seedFor(tx: number, tz: number, level: number): number {
  return (Math.imul(tx + 1000, 73856093) ^ Math.imul(tz + 1000, 19349663) ^ Math.imul(level + 1, 83492791)) >>> 0;
}

/** Trees of a tile as x, y, z, scale, kind per tree, in world metres. */
export function placeTrees(tile: DecodedTile, size: number, felled?: ReadonlySet<string>): Float32Array {
  // a fine tile has the trees of level 0, on its own finer ground
  const shown = tile.level === LEVEL_FINE ? 0 : tile.level;
  const density = DENSITY[shown];
  if (!density) return new Float32Array(0);
  const { n, classes } = tile;
  const cell = size / n;
  const rand = mulberry32(seedFor(tile.tx, tile.tz, tile.level));
  const out: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const cls = classes[j * n + i]!;
      const d = density[cls];
      // one roll per cell, taken before the class check, decides the fractional tree
      const roll = rand();
      if (!d || cls === CLASS_LAKE) continue;
      const expected = d * treeTuning.densityScale * cell * cell;
      const count = Math.floor(expected) + (roll < expected - Math.floor(expected) ? 1 : 0);
      for (let k = 0; k < count; k++) {
        const u = i + rand();
        const v = j + rand();
        const scale = (0.8 + rand() * 0.5) * LEVEL_SCALE[shown]!;
        const x = tile.tx * size + u * cell;
        const z = tile.tz * size + v * cell;
        // the roll above still ran, so a felled tree never moves the others
        if (felled?.has(treeId(x, z))) continue;
        out.push(x, sampleHeight(tile, u, v), z, scale, treeKind(x, z));
      }
    }
  }
  return Float32Array.from(out);
}

const BUCKET = 16;

/** Finds trees near a point, for keeping the camera out of them. No three.js. */
export class TreeGrid {
  private readonly buckets = new Map<number, number[]>();
  private readonly shape: { radius: number; height: number; base: number };
  private readonly crown: { radius: number; centre: number; base: number };

  constructor(
    private readonly trees: Float32Array,
    level: number,
  ) {
    this.shape = TREE_SHAPE[level]!;
    this.crown = BROADLEAF_SHAPE[level]!;
    for (let o = 0; o < trees.length; o += TREE_FLOATS) {
      const key = this.key(Math.floor(trees[o]! / BUCKET), Math.floor(trees[o + 2]! / BUCKET));
      const list = this.buckets.get(key);
      if (list) list.push(o);
      else this.buckets.set(key, [o]);
    }
  }

  private key(i: number, j: number): number {
    return i * 100003 + j;
  }

  /** True when the point is inside a tree's cone, grown by `margin` metres. */
  hit(x: number, y: number, z: number, margin: number): boolean {
    const bi = Math.floor(x / BUCKET);
    const bj = Math.floor(z / BUCKET);
    const { radius, height, base } = this.shape;
    for (let i = bi - 1; i <= bi + 1; i++) {
      for (let j = bj - 1; j <= bj + 1; j++) {
        for (const o of this.buckets.get(this.key(i, j)) ?? []) {
          const s = this.trees[o + 3]!;
          if (this.trees[o + 4] === KIND_BROADLEAF) {
            const c = this.crown;
            const dy = y - (this.trees[o + 1]! + c.centre * s);
            if (Math.hypot(x - this.trees[o]!, dy, z - this.trees[o + 2]!) < c.radius * s + margin) return true;
            continue;
          }
          const up = (y - this.trees[o + 1]!) / s - base;
          if (up < -margin / s || up > height + margin / s) continue;
          const r = (radius * (1 - Math.max(0, up) / height) + margin / s) * s;
          if (Math.hypot(x - this.trees[o]!, z - this.trees[o + 2]!) < r) return true;
        }
      }
    }
    return false;
  }

  /** The nearest tree within `reach` metres of a point, other than the felled ones, or null. */
  nearest(x: number, z: number, reach: number, felled: ReadonlySet<string>): TreeRef | null {
    const r = Math.ceil(reach / BUCKET);
    const bi = Math.floor(x / BUCKET);
    const bj = Math.floor(z / BUCKET);
    let best: TreeRef | null = null;
    let bestDist = reach;
    for (let i = bi - r; i <= bi + r; i++) {
      for (let j = bj - r; j <= bj + r; j++) {
        for (const o of this.buckets.get(this.key(i, j)) ?? []) {
          const tx = this.trees[o]!;
          const tz = this.trees[o + 2]!;
          const d = Math.hypot(tx - x, tz - z);
          const id = treeId(tx, tz);
          if (d > bestDist || felled.has(id)) continue;
          bestDist = d;
          best = { id, x: tx, z: tz, wood: woodOfTree(this.trees[o + 3]!) };
        }
      }
    }
    return best;
  }

  /** Appends x, y, z, scale of the broadleaf trees within `radius` metres of a point (flat, four per tree). */
  broadleafNear(x: number, z: number, radius: number, out: number[]): void {
    const r = Math.ceil(radius / BUCKET);
    const bi = Math.floor(x / BUCKET);
    const bj = Math.floor(z / BUCKET);
    for (let i = bi - r; i <= bi + r; i++) {
      for (let j = bj - r; j <= bj + r; j++) {
        for (const o of this.buckets.get(this.key(i, j)) ?? []) {
          if (this.trees[o + 4] !== KIND_BROADLEAF) continue;
          if (Math.hypot(this.trees[o]! - x, this.trees[o + 2]! - z) > radius) continue;
          out.push(this.trees[o]!, this.trees[o + 1]!, this.trees[o + 2]!, this.trees[o + 3]!);
        }
      }
    }
  }
}
