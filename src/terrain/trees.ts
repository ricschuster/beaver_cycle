// Tree placement. Trees are not stored: they are placed from a tile's land
// cover classes with a seeded generator, so every device gets the same trees
// (docs/design/14_m2_streamed_core_plan.md). No three.js here.
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
/** Floats per tree in the placement array: x, y, z, scale. */
export const TREE_FLOATS = 4;

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

function seedFor(tx: number, tz: number, level: number): number {
  return (Math.imul(tx + 1000, 73856093) ^ Math.imul(tz + 1000, 19349663) ^ Math.imul(level + 1, 83492791)) >>> 0;
}

/** Trees of a tile as x, y, z, scale per tree, in world metres. */
export function placeTrees(tile: DecodedTile, size: number): Float32Array {
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
        out.push(tile.tx * size + u * cell, sampleHeight(tile, u, v), tile.tz * size + v * cell, scale);
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

  constructor(
    private readonly trees: Float32Array,
    level: number,
  ) {
    this.shape = TREE_SHAPE[level]!;
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
          const up = (y - this.trees[o + 1]!) / s - base;
          if (up < -margin / s || up > height + margin / s) continue;
          const r = (radius * (1 - Math.max(0, up) / height) + margin / s) * s;
          if (Math.hypot(x - this.trees[o]!, z - this.trees[o + 2]!) < r) return true;
        }
      }
    }
    return false;
  }
}
