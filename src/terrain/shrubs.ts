// Shrub placement. Shrubs are decoration only: the sim never sees them, and nothing walks into them. Like the
// trees they are not stored but placed from a tile's land cover, here with a hash of each cell's world position, so
// every device gets the same shrubs and a tile placed again gets them where they were. No three.js here.
import { CLASS_LAKE, LEVEL_FINE, sampleHeight, type DecodedTile } from './format';

const CLASS_GROUND = 0;
const CLASS_MEADOW = 1;
const CLASS_FOREST = 2;
const CLASS_SCRUB = 3;
const CLASS_WETLAND = 5;

/**
 * Shrubs per square metre on scrub, on wetland, and along the edge of a wood: on the open ground beside it and
 * in the wood's outer cells, where bushes grow in the light.
 */
export const SHRUB_DENSITY = { scrub: 1 / 80, wetland: 1 / 260, edge: 1 / 70 };
/** Shrubs per square metre on open meadow and bare ground away from the woods: a lone bush now and then. */
const OPEN_DENSITY = 1 / 3000;
/** Floats per shrub in the placement array: x, y, z, scale, and how tall it stands for its width. */
export const SHRUB_FLOATS = 5;
/** Shrubs keep this many metres from a stream's centre line, so none stands in the water. */
export const STREAM_CLEARANCE = 3;
/** And this many metres above the lake level, so none stands in the lake's shallows. */
const LAKE_CLEARANCE = 0.4;

export interface ShrubWater {
  /** The tile's lake level, metres, or null when it has no lake. */
  lakeLevel: number | null;
  /** Metres to the nearest stream, exact up to `upTo`. */
  streamDistance?: (x: number, z: number, upTo: number) => number;
}

/** A stable number in [0, 1) for a pair of integers and a salt. */
export function hash01(a: number, b: number, salt: number): number {
  let h = (Math.imul(a, 374761393) ^ Math.imul(b, 668265263) ^ Math.imul(salt, 2246822519)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Open ground this many metres from a wood is its edge, and wood this many metres from open ground. */
const WOOD_EDGE = 10;
const OPEN_EDGE = 5;

/** Ground a shrub can grow on next to a wood: not lake, rock, or wood. */
const isOpen = (cls: number): boolean => cls === CLASS_GROUND || cls === CLASS_MEADOW || cls === CLASS_SCRUB || cls === CLASS_WETLAND;

/** 1 for each cell within `r` cells (a square) of a cell that passes `is`, 0 elsewhere: grown by two passes. */
function band(classes: Uint8Array, n: number, r: number, is: (cls: number) => boolean): Uint8Array {
  const rows = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (!is(classes[j * n + i]!)) continue;
      for (let ci = Math.max(i - r, 0); ci <= Math.min(i + r, n - 1); ci++) rows[j * n + ci] = 1;
    }
  }
  const band = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (rows[j * n + i] !== 1) continue;
      for (let cj = Math.max(j - r, 0); cj <= Math.min(j + r, n - 1); cj++) band[cj * n + i] = 1;
    }
  }
  return band;
}

/** Shrubs per square metre for a cell of a class, given whether a wood is near, or for a wood, open ground. */
function densityOf(cls: number, byWood: boolean, byOpen: boolean): number {
  if (cls === CLASS_SCRUB) return SHRUB_DENSITY.scrub;
  if (cls === CLASS_FOREST) return byOpen ? SHRUB_DENSITY.edge : 0;
  if (cls === CLASS_WETLAND) return byWood ? SHRUB_DENSITY.edge : SHRUB_DENSITY.wetland;
  if (cls === CLASS_MEADOW || cls === CLASS_GROUND) return byWood ? SHRUB_DENSITY.edge : OPEN_DENSITY;
  return 0;
}

/**
 * Shrubs of a tile as x, y, z, scale, tallness per shrub, in world metres. Only the near levels (0 and the fine
 * level) have shrubs. None stands in the lake or within `STREAM_CLEARANCE` of a stream; ponds come and go, so the
 * view hides the shrubs they flood.
 */
export function placeShrubs(tile: DecodedTile, size: number, water: ShrubWater): Float32Array {
  if (tile.level !== 0 && tile.level !== LEVEL_FINE) return new Float32Array(0);
  const { n, classes } = tile;
  const cell = size / n;
  // cells are counted from the world origin, so a cell's shrubs do not depend on which tile holds it
  const ci0 = Math.round((tile.tx * size) / cell);
  const cj0 = Math.round((tile.tz * size) / cell);
  const lakeAt = (i: number, j: number): boolean => {
    for (let cj = Math.max(j - 1, 0); cj <= Math.min(j + 1, n - 1); cj++) {
      for (let ci = Math.max(i - 1, 0); ci <= Math.min(i + 1, n - 1); ci++) if (classes[cj * n + ci] === CLASS_LAKE) return true;
    }
    return false;
  };
  const byWood = band(classes, n, Math.max(1, Math.round(WOOD_EDGE / cell)), (c) => c === CLASS_FOREST);
  const byOpen = band(classes, n, Math.max(1, Math.round(OPEN_EDGE / cell)), isOpen);
  const out: number[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const cls = classes[j * n + i]!;
      if (cls === CLASS_LAKE) continue;
      const d = densityOf(cls, byWood[j * n + i] === 1, byOpen[j * n + i] === 1);
      if (d === 0) continue;
      const wi = ci0 + i;
      const wj = cj0 + j;
      const expected = d * cell * cell;
      const count = Math.floor(expected) + (hash01(wi, wj, 11) < expected - Math.floor(expected) ? 1 : 0);
      const nearLake = water.lakeLevel !== null && lakeAt(i, j);
      for (let k = 0; k < count; k++) {
        const u = i + hash01(wi, wj, 20 + k * 4);
        const v = j + hash01(wi, wj, 21 + k * 4);
        const x = tile.tx * size + u * cell;
        const z = tile.tz * size + v * cell;
        const y = sampleHeight(tile, u, v);
        if (nearLake && y < water.lakeLevel! + LAKE_CLEARANCE) continue;
        if (water.streamDistance && water.streamDistance(x, z, STREAM_CLEARANCE) < STREAM_CLEARANCE) continue;
        const scale = 0.8 + 0.8 * hash01(wi, wj, 22 + k * 4);
        const tall = 0.8 + 0.45 * hash01(wi, wj, 23 + k * 4);
        out.push(x, y, z, scale, tall);
      }
    }
  }
  return Float32Array.from(out);
}
