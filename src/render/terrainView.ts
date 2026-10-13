// Draws the loaded tiles. Reads the tile store and the streamer's wishes, never
// changes them. One mesh per tile, rebuilt when the level it shows changes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CLASS_LAKE, LEVEL_FINE, type DecodedTile, type TileWater } from '../terrain/format';
import type { TreeRef, Trunk } from '../sim/trees';
import { KIND_BROADLEAF, placeTrees, TREE_FLOATS, TreeGrid, treeIdPosition } from '../terrain/trees';
import { distToTile, shownLevel, type Streamer } from '../terrain/streamer';
import { tileKey, type TileStore } from '../terrain/store';
import { recordBuildTime, timed } from '../terrain/buildTimes';
import { placeShrubs, SHRUB_FLOATS } from '../terrain/shrubs';
import { POND_CELL, pondDepthAt, type Pond } from '../sim/pond';
import type { Dam } from '../sim/dam';
import type { DamSpot } from '../sim/damSpots';
import type { Lodge } from '../sim/lodge';
import type { SeasonLook, Tint } from './seasonLook';
import { createWaterLook } from './waterLook';
import { broadleafGeometry, coniferGeometry, shrubGeometry } from './treeModels';
import { DETAIL, groundNoiseTexture, NOISE_LARGE_M, NOISE_SMALL_M } from './groundDetail';

const CLASS_COLORS: Record<number, number> = {
  0: 0x8a9a62, // ground
  1: 0x9bbf5f, // meadow
  2: 0x3f6b3a, // forest
  3: 0x6f8a45, // scrub
  4: 0x8d8a82, // rock
  5: 0x6d8a6a, // wetland
  9: 0x2f6f8f, // lake bed, until the water plane arrives
};
const FALLBACK = new THREE.Color(CLASS_COLORS[0]);
/** Which seasonal tint a ground class takes: [grass, forest]. Rock and lake bed keep their colour all year. */
const SEASON_WEIGHT: Record<number, [number, number]> = {
  0: [1, 0],
  1: [1, 0],
  2: [0, 1],
  3: [1, 0],
  5: [1, 0],
};
const NO_WEIGHT: [number, number] = [0, 0];
const COLORS = new Map(Object.entries(CLASS_COLORS).map(([k, v]) => [Number(k), new THREE.Color(v)]));

/** Metres a skirt hangs per metre of cell size, to hide gaps between levels. */
const SKIRT_PER_CELL = 1;
/** Milliseconds per frame spent building tile meshes. At least one is always built. */
const BUILD_BUDGET_MS = 4;

/** Far backdrop tiles are merged into chunks of this many tiles per side, one draw call each. */
export const FAR_CHUNK = 8;

/** Key of the far chunk a tile belongs to. */
export function farChunkKey(tx: number, tz: number): string {
  return `${Math.floor(tx / FAR_CHUNK)},${Math.floor(tz / FAR_CHUNK)}`;
}

/** Colour, season weight, and detail of each class (r, g, b, grass, foliage, detail), looked up once rather than once per cell. */
const PALETTE_STRIDE = 6;
const PALETTE = new Float64Array(256 * PALETTE_STRIDE);
for (let c = 0; c < 256; c++) {
  const color = COLORS.get(c) ?? FALLBACK;
  const [sg, sf] = SEASON_WEIGHT[c] ?? NO_WEIGHT;
  PALETTE.set([color.r, color.g, color.b, sg, sf, DETAIL[c] ?? DETAIL[0]!], c * PALETTE_STRIDE);
}

export function buildTileGeometry(tile: DecodedTile, size: number): THREE.BufferGeometry {
  const { n, heights: h, classes } = tile;
  const w = n + 1;
  const cell = size / n;
  const x0 = tile.tx * size;
  const z0 = tile.tz * size;
  const drop = Math.max(2, cell * SKIRT_PER_CELL);
  const edge: number[] = []; // vertex indices of the border, in a loop
  for (let i = 0; i < n; i++) edge.push(i); // north, west to east
  for (let j = 0; j < n; j++) edge.push(j * w + n); // east, north to south
  for (let i = n; i > 0; i--) edge.push(n * w + i); // south, east to west
  for (let j = n; j > 0; j--) edge.push(j * w); // west, south to north

  const nv = w * w;
  const total = nv + edge.length;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const weight = new Float32Array(total * 2);
  const detail = new Float32Array(total);
  const at = (i: number, j: number): number => h[Math.min(Math.max(j, 0), n) * w + Math.min(Math.max(i, 0), n)]!;

  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      const v = j * w + i;
      pos[v * 3] = x0 + i * cell;
      pos[v * 3 + 1] = h[v]!;
      pos[v * 3 + 2] = z0 + j * cell;
      const dx = (at(i - 1, j) - at(i + 1, j)) / (2 * cell);
      const dz = (at(i, j - 1) - at(i, j + 1)) / (2 * cell);
      const len = Math.hypot(dx, 1, dz);
      nor[v * 3] = dx / len;
      nor[v * 3 + 1] = 1 / len;
      nor[v * 3 + 2] = dz / len;
      // average the colours of the (up to four) cells around the vertex
      let r = 0, g = 0, b = 0, wg = 0, wf = 0, dt = 0, count = 0;
      for (let cj = j - 1; cj <= j; cj++) {
        for (let ci = i - 1; ci <= i; ci++) {
          if (ci < 0 || cj < 0 || ci >= n || cj >= n) continue;
          const o = classes[cj * n + ci]! * PALETTE_STRIDE;
          r += PALETTE[o]!; g += PALETTE[o + 1]!; b += PALETTE[o + 2]!; wg += PALETTE[o + 3]!; wf += PALETTE[o + 4]!; dt += PALETTE[o + 5]!; count++;
        }
      }
      col[v * 3] = r / count;
      col[v * 3 + 1] = g / count;
      col[v * 3 + 2] = b / count;
      weight[v * 2] = wg / count;
      weight[v * 2 + 1] = wf / count;
      detail[v] = dt / count;
    }
  }
  edge.forEach((v, k) => {
    const s = nv + k;
    pos[s * 3] = pos[v * 3]!;
    pos[s * 3 + 1] = pos[v * 3 + 1]! - drop;
    pos[s * 3 + 2] = pos[v * 3 + 2]!;
    nor.copyWithin(s * 3, v * 3, v * 3 + 3);
    col.copyWithin(s * 3, v * 3, v * 3 + 3);
    weight.copyWithin(s * 2, v * 2, v * 2 + 2);
    detail[s] = detail[v]!;
  });

  // typed from the start: 6 indices per cell and 12 per skirt segment, 16 bit while the vertices fit
  const index = total < 65536 ? new Uint16Array(n * n * 6 + edge.length * 12) : new Uint32Array(n * n * 6 + edge.length * 12);
  let ix = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const a = j * w + i;
      const b = a + 1;
      const c = a + w;
      const d = c + 1;
      // counter clockwise seen from above
      index[ix++] = a; index[ix++] = c; index[ix++] = b;
      index[ix++] = b; index[ix++] = c; index[ix++] = d;
    }
  }
  // skirts, in both windings so they show from either side
  for (let k = 0; k < edge.length; k++) {
    const next = (k + 1) % edge.length;
    const p = edge[k]!, q = edge[next]!;
    const p2 = nv + k, q2 = nv + next;
    index.set([p, q, q2, p, q2, p2, p, q2, q, p, p2, q2], ix);
    ix += 12;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('seasonWeight', new THREE.BufferAttribute(weight, 2));
  geo.setAttribute('detail', new THREE.BufferAttribute(detail, 1));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  geo.computeBoundingSphere();
  return geo;
}

/** How far, in metres, the lake water reaches over ground below its level beyond the cells the land cover marks. */
const LAKE_REACH_M = 8;

/**
 * Flat water at the lake level, cut where the ground rises through it. It covers
 * the lake cells and their neighbours, and each ground triangle is clipped to the
 * part below the level, so the shoreline follows the terrain rather than whole
 * cells. Each vertex keeps the depth of the water over the ground in a `waterDepth` attribute (0 on the shoreline), so
 * the shader can freeze the shallows in winter. Null when the tile has no lake cells.
 */
export function buildLakeGeometry(tile: DecodedTile, size: number, level: number): THREE.BufferGeometry | null {
  const { n, classes, heights: h } = tile;
  const w = n + 1;
  const cell = size / n;
  // The land cover marks the lake coarsely, so ground below the level can lie several cells beyond it. The water
  // reaches LAKE_REACH_M over such ground (every cell within one cell of the lake is kept, as before), and the clip
  // below cuts it at the true shoreline, instead of at the edge of the reach, which showed as steps.
  const reach = Math.max(1, Math.round(LAKE_REACH_M / cell));
  const lowCell = (i: number, j: number): boolean =>
    h[j * w + i]! < level || h[j * w + i + 1]! < level || h[(j + 1) * w + i]! < level || h[(j + 1) * w + i + 1]! < level;
  const wet = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (classes[j * n + i] === CLASS_LAKE) wet[j * n + i] = 1;
  // spread the wet cells outward one cell at a time, onto the cells below the level
  for (let step = 0; step < reach; step++) {
    const grown = wet.slice();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        if (wet[j * n + i]) continue;
        let beside = false;
        for (let cj = Math.max(j - 1, 0); cj <= Math.min(j + 1, n - 1) && !beside; cj++) {
          for (let ci = Math.max(i - 1, 0); ci <= Math.min(i + 1, n - 1); ci++) {
            if (wet[cj * n + ci]) {
              beside = true;
              break;
            }
          }
        }
        if (beside && (step === 0 || lowCell(i, j))) grown[j * n + i] = 1;
      }
    }
    wet.set(grown);
  }
  const near = (i: number, j: number): boolean => wet[j * n + i] === 1;
  let pos = new Float32Array(3 * 3 * 1024);
  let depth = new Float32Array(3 * 1024);
  let used = 0;
  const emit = (x: number, z: number, d: number): void => {
    if (used + 3 > pos.length) {
      const bigger = new Float32Array(pos.length * 2);
      bigger.set(pos);
      pos = bigger;
      const deeper = new Float32Array(depth.length * 2);
      deeper.set(depth);
      depth = deeper;
    }
    depth[used / 3] = d;
    pos[used++] = x;
    pos[used++] = level;
    pos[used++] = z;
  };
  // the clipped polygon of one triangle: at most 4 points, x, z, and depth each
  const cx = [0, 0, 0, 0, 0];
  const cz = [0, 0, 0, 0, 0];
  const cd = [0, 0, 0, 0, 0];
  /** Emits the part of a ground triangle that lies below the level, as a fan. */
  const clip = (x0: number, z0: number, h0: number, x1: number, z1: number, h1: number, x2: number, z2: number, h2: number): void => {
    if (h0 > level && h1 > level && h2 > level) return;
    let m = 0;
    const edgeTo = (ax: number, az: number, ah: number, bx: number, bz: number, bh: number): void => {
      const aIn = ah <= level;
      if (aIn) {
        cx[m] = ax;
        cz[m] = az;
        cd[m++] = level - ah;
      }
      if (aIn !== bh <= level) {
        const t = (level - ah) / (bh - ah);
        cx[m] = ax + (bx - ax) * t;
        cz[m] = az + (bz - az) * t;
        cd[m++] = 0;
      }
    };
    edgeTo(x0, z0, h0, x1, z1, h1);
    edgeTo(x1, z1, h1, x2, z2, h2);
    edgeTo(x2, z2, h2, x0, z0, h0);
    for (let k = 1; k + 1 < m; k++) {
      emit(cx[0]!, cz[0]!, cd[0]!);
      emit(cx[k]!, cz[k]!, cd[k]!);
      emit(cx[k + 1]!, cz[k + 1]!, cd[k + 1]!);
    }
  };
  let any = false;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (classes[j * n + i] === CLASS_LAKE) any = true;
      else if (!near(i, j)) continue;
      const x = tile.tx * size + i * cell;
      const z = tile.tz * size + j * cell;
      const ha = h[j * w + i]!;
      const hb = h[j * w + i + 1]!;
      const hc = h[(j + 1) * w + i]!;
      const hd = h[(j + 1) * w + i + 1]!;
      clip(x, z, ha, x, z + cell, hc, x + cell, z, hb); // the same split as the ground mesh
      clip(x + cell, z, hb, x, z + cell, hc, x + cell, z + cell, hd);
    }
  }
  if (!any || used === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(0, used), 3));
  // flat water: every normal points up, so there is nothing to compute
  const up = new Float32Array(used);
  for (let i = 1; i < used; i += 3) up[i] = 1;
  geo.setAttribute('normal', new THREE.BufferAttribute(up, 3));
  geo.setAttribute('waterDepth', new THREE.BufferAttribute(depth.slice(0, used / 3), 1));
  geo.computeBoundingSphere();
  return geo;
}

/** The rock that steep faces turn to. */
const STEEP_ROCK = 0x857f76;
/** Snow on the trees. */
const SNOW = 0xf2f6f8;

/** Width of a stream without a `w` in its tile, metres. */
const STREAM_WIDTH = 2.5;
const STREAM_STEP = 5;
const STREAM_LIFT = 0.3;
/** The rim of a stream is this share of the water colour (darker), from this share of the half width out, and see through at the edge. */
const STREAM_RIM = 0.8;
const STREAM_RIM_AT = 0.6;
/** The see through edge reaches this much past the stream's stated width, so the solid water keeps about the stated width. */
const STREAM_EDGE = 1.25;
/** The rim fades out over the last metres of a stream that ends in a lake. */
const MOUTH_BLEND_M = 14;
/**
 * A stream that ends in a lake braids over its last metres, as a delta does: from this far back, up to MOUTH_ARM_COUNT side
 * arms split off the main channel, each a straight run to the water that is at least MOUTH_ARM_SPREAD radians from the main
 * channel and from the other arms, and no longer than MOUTH_ARM_RANGE_M. Arms are narrower than the channel by this share.
 */
export const MOUTH_ARMS_LENGTH_M = 60;
export const MOUTH_ARM_COUNT = 3;
export const MOUTH_ARM_SPREAD = 0.35;
export const MOUTH_ARM_RANGE_M = 120;
const MOUTH_ARM_WIDTH = 0.5;
/** A stream line ends in the lake when its last point lies this close to the lake level, metres. */
const MOUTH_REACH_M = 1.5;

/**
 * A stream line with its snapping jitter averaged out: the lines are snapped to the lowest cell, so they zigzag by a cell or two.
 * Each pass moves every inner point to the weighted mean of itself and its neighbours; the two ends stay where they are, so a
 * line still meets its tile edge and the lake.
 */
export function smoothLine(pts: readonly [number, number][], passes = STREAM_SMOOTH_PASSES): [number, number][] {
  let line = pts.map((p): [number, number] => [p[0], p[1]]);
  for (let pass = 0; pass < passes; pass++) {
    const next = line.map((p): [number, number] => [p[0], p[1]]);
    for (let k = 1; k + 1 < line.length; k++) {
      next[k] = [(line[k - 1]![0] + 2 * line[k]![0] + line[k + 1]![0]) / 4, (line[k - 1]![1] + 2 * line[k]![1] + line[k + 1]![1]) / 4];
    }
    line = next;
  }
  return line;
}
const STREAM_SMOOTH_PASSES = 4;

/** A line that goes out and comes back to where it started within a few metres: a leftover of the snap, never a stream. */
export function isStub(pts: readonly [number, number][]): boolean {
  if (pts.length < 2) return false;
  let length = 0;
  for (let k = 1; k < pts.length; k++) length += Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]);
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return length < 30 && Math.hypot(last[0] - first[0], last[1] - first[1]) < 1.5;
}

/**
 * A stream line without its spurs: the snap sometimes leaves a point on the bank beside the channel, which drapes the ribbon over
 * a hump. A point that stands more than `rise` metres above the points `reach` steps before and after it is dropped; the ends stay.
 */
export function despikeLine(pts: readonly [number, number][], heightAt: (x: number, z: number) => number, reach = 1, rise = 1): [number, number][] {
  if (pts.length < 2 * reach + 1) return pts.map((p): [number, number] => [p[0], p[1]]);
  const h = pts.map((p) => heightAt(p[0], p[1]));
  return pts.filter((_, k) => k < reach || k >= pts.length - reach || h[k]! - Math.max(h[k - reach]!, h[k + reach]!) <= rise).map((p): [number, number] => [p[0], p[1]]);
}

/** Ribbons draped on the ground along the stream lines of a tile, or null when it has none. */
export function buildStreamGeometry(
  water: TileWater,
  heightAt: (x: number, z: number) => number,
  /** Whether the land cover at a point is lake, to find the water the delta arms run to. Defaults to ground at or under the lake level. */
  isLake: (x: number, z: number) => boolean = (x, z) => water.lakeLevel_m != null && heightAt(x, z) <= water.lakeLevel_m,
): THREE.BufferGeometry | null {
  const pos: number[] = [];
  const color: number[] = [];
  const index: number[] = [];
  /**
   * One ribbon of this half width along the points, each a little above the ground beside it. Across it there are five vertices:
   * the outer edge on each side (see through), a darker rim just inside it, and the water's own colour along the middle, so the
   * ribbon reads as a wet channel with a soft edge. `fadeEnd` metres before the end of the line the rim fades out (a mouth in a lake).
   */
  const addRibbon = (pts: [number, number][], half: number, fadeEnd = 0): void => {
    const base = pos.length / 3;
    let along = 0;
    const lengths = pts.map((p, k) => (along += k === 0 ? 0 : Math.hypot(p[0] - pts[k - 1]![0], p[1] - pts[k - 1]![1])));
    for (let k = 0; k < pts.length; k++) {
      const [x, z] = pts[k]!;
      const [px, pz] = pts[Math.max(k - 1, 0)]!;
      const [qx, qz] = pts[Math.min(k + 1, pts.length - 1)]!;
      const len = Math.hypot(qx - px, qz - pz) || 1;
      const nx = (-(qz - pz) / len) * half * STREAM_EDGE;
      const nz = ((qx - px) / len) * half * STREAM_EDGE;
      const toEnd = fadeEnd > 0 ? Math.min(1, (along - lengths[k]!) / fadeEnd) : 1;
      const rim = 1 - (1 - STREAM_RIM) * toEnd;
      // across the ribbon: where (share of the half width), the colour factor, and the opacity
      for (const [side, factor, alpha] of [[-1, rim, 0], [-STREAM_RIM_AT, rim, 1], [0, 1, 1], [STREAM_RIM_AT, rim, 1], [1, rim, 0]] as const) {
        const wx = x + nx * side;
        const wz = z + nz * side;
        pos.push(wx, heightAt(wx, wz) + STREAM_LIFT, wz);
        color.push(factor, factor, factor, alpha);
      }
    }
    for (let k = 0; k + 1 < pts.length; k++) {
      for (let j = 0; j < 4; j++) {
        const a = base + k * 5 + j;
        index.push(a, a + 1, a + 5, a + 1, a + 6, a + 5);
      }
    }
  };
  for (const s of water.streams) {
    const half = (s.w ?? STREAM_WIDTH) / 2;
    // resample the line every few metres so the ribbon follows the ground
    if (isStub(s.pts)) continue;
    const line = smoothLine(despikeLine(despikeLine(s.pts, heightAt), heightAt, 4, 1.5));
    const pts: [number, number][] = [];
    for (let k = 0; k + 1 < line.length; k++) {
      const [ax, az] = line[k]!;
      const [bx, bz] = line[k + 1]!;
      const parts = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / STREAM_STEP));
      for (let p = 0; p < parts; p++) pts.push([ax + ((bx - ax) * p) / parts, az + ((bz - az) * p) / parts]);
    }
    if (s.pts.length < 2) continue;
    pts.push(line[line.length - 1]!);
    const [endX, endZ] = pts[pts.length - 1]!;
    const inLake = water.lakeLevel_m != null && Math.abs(heightAt(endX, endZ) - water.lakeLevel_m) < MOUTH_REACH_M;
    addRibbon(pts, half, inLake ? MOUTH_BLEND_M : 0);
    if (!inLake) continue;
    // the delta: arms leave the main channel where it is MOUTH_ARMS_LENGTH_M from the lake and fan out into it
    let from = pts.length - 1;
    while (from > 0 && Math.hypot(endX - pts[from]![0], endZ - pts[from]![1]) < MOUTH_ARMS_LENGTH_M) from--;
    const [sx, sz] = pts[from]!;
    const heading = Math.atan2(endZ - sz, endX - sx);
    // how far a straight run from the split point at this heading goes before the ground drops to the lake, or null
    const runTo = (h: number): number | null => {
      for (let d = STREAM_STEP; d <= MOUTH_ARM_RANGE_M; d += STREAM_STEP) {
        if (isLake(sx + Math.cos(h) * d, sz + Math.sin(h) * d)) return d;
      }
      return null;
    };
    const runs: { h: number; d: number }[] = [];
    for (let off = -1.2; off <= 1.2001; off += 0.05) {
      const d = runTo(heading + off);
      if (d !== null) runs.push({ h: heading + off, d });
    }
    runs.sort((p, q) => p.d - q.d);
    const arms: number[] = [heading];
    for (const r of runs) {
      if (arms.length > MOUTH_ARM_COUNT) break;
      if (arms.every((h) => Math.abs(h - r.h) >= MOUTH_ARM_SPREAD)) {
        arms.push(r.h);
        // An arm leaves along the main channel and bends toward the water, with a little wobble, as a distributary does; it
        // ends where the straight run does, so it still reaches the lake.
        const ex = sx + Math.cos(r.h) * r.d;
        const ez = sz + Math.sin(r.h) * r.d;
        const cx = sx + Math.cos(heading) * r.d * 0.5;
        const cz = sz + Math.sin(heading) * r.d * 0.5;
        const wobble = Math.min(3, r.d * 0.05) * (arms.length % 2 === 0 ? 1 : -1);
        const path: [number, number][] = [];
        const steps = Math.max(2, Math.ceil(r.d / STREAM_STEP));
        for (let k = 0; k <= steps; k++) {
          const t = k / steps;
          const a = (1 - t) * (1 - t);
          const b = 2 * (1 - t) * t;
          const c = t * t;
          const bend = Math.sin(t * Math.PI * 3) * Math.sin(t * Math.PI) * wobble;
          // the bend is sideways to the arm's own run, so the end point stays on the straight run's end
          path.push([a * sx + b * cx + c * ex - Math.sin(r.h) * bend, a * sz + b * cz + c * ez + Math.cos(r.h) * bend]);
        }
        addRibbon(path, half * MOUTH_ARM_WIDTH, MOUTH_BLEND_M);
      }
    }
  }
  if (pos.length === 0) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
  geo.setIndex(index);
  geo.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(color), 4));
  // Water is lit as a flat sheet facing up. Every triangle faces up (counter-clockwise from above), so the double sided material
  // never flips the normal over the top; a ribbon draped on a slope would otherwise take the slope's normal.
  geo.setAttribute('normal', new THREE.BufferAttribute(Float32Array.from({ length: pos.length }, (_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  geo.computeBoundingSphere();
  return geo;
}

// Trees are shared geometry, one per level and kind, never disposed (treeModels.ts). Level 2 has none.
const CONIFER_GEOMETRY = [coniferGeometry(0), coniferGeometry(1)];
const BROADLEAF_GEOMETRY = [broadleafGeometry(0), broadleafGeometry(1)];

/** A stable turn for the tree at a point, so the trees of a wood do not all face the same way. */
function treeYaw(x: number, z: number): number {
  const h = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return (h - Math.floor(h)) * Math.PI * 2;
}

function instanced(geometry: THREE.BufferGeometry, material: THREE.Material, trees: number[], depth?: THREE.Material) {
  const count = trees.length / TREE_FLOATS;
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.castShadow = true;
  if (depth) mesh.customDepthMaterial = depth;
  const m = new THREE.Matrix4();
  const scale = new THREE.Matrix4();
  for (let k = 0; k < count; k++) {
    const o = k * TREE_FLOATS;
    const s = trees[o + 3]!;
    m.makeRotationY(treeYaw(trees[o]!, trees[o + 2]!)).multiply(scale.makeScale(s, s, s)).setPosition(trees[o]!, trees[o + 1]!, trees[o + 2]!);
    mesh.setMatrixAt(k, m);
  }
  mesh.computeBoundingSphere();
  return mesh;
}

function buildTrees(
  tile: DecodedTile,
  size: number,
  materials: { conifer: THREE.Material; broadleaf: THREE.Material; broadleafDepth: THREE.Material },
  felled: ReadonlySet<string>,
  lakeLevel: number | null,
): { meshes: THREE.InstancedMesh[]; grid: TreeGrid } | null {
  const shown = tile.level === LEVEL_FINE ? 0 : tile.level;
  const conifers = CONIFER_GEOMETRY[shown];
  const trees = conifers ? placeTrees(tile, size, felled, lakeLevel) : new Float32Array(0);
  if (!conifers || trees.length === 0) return null;
  const conifer: number[] = [];
  const broadleaf: number[] = [];
  for (let o = 0; o < trees.length; o += TREE_FLOATS) {
    (trees[o + 4] === KIND_BROADLEAF ? broadleaf : conifer).push(...trees.subarray(o, o + TREE_FLOATS));
  }
  const meshes: THREE.InstancedMesh[] = [];
  if (conifer.length > 0) meshes.push(instanced(conifers, materials.conifer, conifer));
  if (broadleaf.length > 0) meshes.push(instanced(BROADLEAF_GEOMETRY[shown]!, materials.broadleaf, broadleaf, materials.broadleafDepth));
  return { meshes, grid: new TreeGrid(trees, shown) };
}

// One shrub model for the near levels (treeModels.ts), shared and never disposed. Coarser levels have no shrubs.
const SHRUB_GEOMETRY = shrubGeometry();

/** A round patch of ground kept clear of shrubs, such as round a dam or a lodge. */
export interface Clearing {
  x: number;
  z: number;
  r: number;
}

/** Metres round a lodge's centre kept clear of shrubs: the lodge and the food store by its door. */
const LODGE_CLEARING = 8;
/** Metres round a dam's spot kept clear when the length of its wall is not known. */
const DAM_CLEARING = 7;

/** The patches kept clear of shrubs: round each dam (half its longest wall and a margin) and each lodge. */
export function clearingsOf(dams: readonly Dam[], spots: readonly DamSpot[], lodges: readonly (Lodge | null)[]): Clearing[] {
  const out: Clearing[] = [];
  for (const d of dams) {
    const spot = spots.find((s) => s.id === d.spot);
    if (!spot) continue;
    const widths = (spot.widths ?? []).filter((w): w is number => w != null);
    out.push({ x: spot.bed.x, z: spot.bed.z, r: widths.length > 0 ? Math.max(...widths) / 2 + 2 : DAM_CLEARING });
  }
  for (const l of lodges) if (l) out.push({ x: l.x, z: l.z, r: LODGE_CLEARING });
  return out;
}

/** True when a shrub standing at a point is under a pond's water or in a clearing, so it should not show. */
export function shrubHidden(ponds: readonly Pond[], clearings: readonly Clearing[], x: number, y: number, z: number): boolean {
  for (const c of clearings) if ((x - c.x) ** 2 + (z - c.z) ** 2 < c.r * c.r) return true;
  return ponds.length > 0 && pondDepthAt(ponds, () => y, x, z) > 0;
}

/** Hides a shrub: a matrix of scale 0, whose triangles draw nothing. */
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

/**
 * Sets the matrix of each shrub of a tile: turned and sized by its place, or hidden where `hidden` says it stands
 * in a pond or a clearing.
 */
function setShrubMatrices(mesh: THREE.InstancedMesh, shrubs: Float32Array, hidden: (x: number, y: number, z: number) => boolean): void {
  const m = new THREE.Matrix4();
  const scale = new THREE.Matrix4();
  for (let k = 0; k < mesh.count; k++) {
    const o = k * SHRUB_FLOATS;
    const x = shrubs[o]!;
    const y = shrubs[o + 1]!;
    const z = shrubs[o + 2]!;
    const s = shrubs[o + 3]!;
    if (hidden(x, y, z)) {
      mesh.setMatrixAt(k, HIDDEN);
      continue;
    }
    // the foot sinks a little into the ground, so a shrub on a slope does not float on its downhill side
    m.makeRotationY(treeYaw(z, x)).multiply(scale.makeScale(s, s * shrubs[o + 4]!, s)).setPosition(x, y - 0.15 * s, z);
    mesh.setMatrixAt(k, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
}

/** Each shrub a little lighter or darker, greener or browner than the next, by where it stands. */
function setShrubColors(mesh: THREE.InstancedMesh, shrubs: Float32Array): void {
  const c = new THREE.Color();
  for (let k = 0; k < mesh.count; k++) {
    const o = k * SHRUB_FLOATS;
    const a = treeYaw(shrubs[o]! * 1.7, shrubs[o + 2]! * 0.6) / (Math.PI * 2);
    const b = treeYaw(shrubs[o + 2]! * 1.3, shrubs[o]! * 0.9) / (Math.PI * 2);
    const light = 0.82 + 0.3 * a;
    c.setRGB(light * (0.95 + 0.12 * b), light, light * (1.05 - 0.12 * b));
    mesh.setColorAt(k, c);
  }
}

/** Triangles a mesh draws, counting every instance. */
function trianglesOf(mesh: THREE.Mesh): number {
  const per = (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
  return per * (mesh instanceof THREE.InstancedMesh ? mesh.count : 1);
}

export interface TerrainStats {
  meshes: number;
  triangles: number;
  trees: number;
  shrubs: number;
  /** Triangles of the shrubs alone, counted in `triangles` too. */
  shrubTriangles: number;
  tilesByLevel: number[];
}

/** Marks a mesh whose geometry belongs to its tile, so it is freed with the tile. */
function own<T extends THREE.Mesh>(mesh: T): T {
  mesh.userData.owned = true;
  return mesh;
}

function disposeGroup(scene: THREE.Scene, group: THREE.Group): void {
  scene.remove(group);
  for (const child of group.children as THREE.Mesh[]) {
    if (child.userData.owned) child.geometry.dispose();
    if (child instanceof THREE.InstancedMesh) child.dispose();
  }
}

export interface TerrainView {
  update(x: number, z: number): void;
  /** True when a point is inside a drawn tree, grown by `margin` metres. */
  insideTree(x: number, y: number, z: number, margin: number): boolean;
  /** Appends x, y, z, scale of the drawn broadleaf trees within `radius` metres of a point (four numbers per tree). */
  broadleafNear(x: number, z: number, radius: number, out: number[]): void;
  /** The nearest standing tree within `reach` metres of a point, for chopping. Only the near, detailed trees count. */
  nearestTree(x: number, z: number, reach: number, felled: ReadonlySet<string>): TreeRef | null;
  /** Trunks of the standing trees within `reach` metres of a point, for walking into. */
  trunksNear(x: number, z: number, reach: number, felled: ReadonlySet<string>): Trunk[];
  /** Tells the view which trees are felled, given in the order they fell. Tiles that had one are rebuilt without it. */
  setFelled(ids: readonly string[]): void;
  stats(): TerrainStats;
  /** Sets the seasonal ground, tree, and water look. Cheap, so it can be called every frame. */
  setSeason(look: SeasonLook): void;
  /**
   * Tells the view where the ponds are and which patches to keep clear (dams, lodges): no shrub shows there. Cheap
   * while nothing changes, so it can be called every frame with the same arrays while nothing has moved.
   */
  setClearings(ponds: readonly Pond[], clearings: readonly Clearing[]): void;
}

export function createTerrainView(
  scene: THREE.Scene,
  store: TileStore,
  streamer: Streamer,
  /** Called once for each material that should take part in the shadows. */
  prepareMaterial: (material: THREE.Material) => void = () => {},
): TerrainView {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const lakeMaterial = new THREE.MeshLambertMaterial({
    color: 0x3b8fb0,
    transparent: true,
    opacity: 0.85,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  // Vertex colours darken the rim and fade the edge (buildStreamGeometry), so the material is see through and writes no depth.
  const streamMaterial = new THREE.MeshLambertMaterial({ color: 0x3b8fb0, side: THREE.DoubleSide, vertexColors: true, transparent: true, depthWrite: false });
  // The conifer tiers are open underneath, so both sides are drawn: from below, a tier shows its dark underside.
  const treeMaterial = new THREE.MeshLambertMaterial({ color: 0x2f5a2f, vertexColors: true, side: THREE.DoubleSide });
  const leafMaterial = new THREE.MeshLambertMaterial({ color: 0x3f7a35, vertexColors: true });
  const shrubMaterial = new THREE.MeshLambertMaterial({ color: 0x527d36, vertexColors: true });
  prepareMaterial(material);
  prepareMaterial(treeMaterial);
  prepareMaterial(leafMaterial);
  prepareMaterial(shrubMaterial);
  // The trees' wood keeps its bark colour whatever the season's leaf colour, and in winter snow settles on them,
  // from the spots that hold it best (the `tree` attribute, treeModels.ts) down as the snow grows. The underside of
  // a conifer tier, drawn from behind, holds none.
  const snow = { value: 0 };
  const snowColor = { value: new THREE.Color(SNOW) };
  const addTreeLook = (material: THREE.Material): void => {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms.snow = snow;
      shader.uniforms.snowColor = snowColor;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 tree;\nvarying vec2 vTree;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTree = tree;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vTree;\nuniform float snow;\nuniform vec3 snowColor;')
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          diffuseColor.rgb = mix(diffuseColor.rgb, vColor.rgb, vTree.x);
          float snowLine = mix(1.1, 0.4, snow);
          float snowCap = smoothstep(snowLine - 0.03, snowLine + 0.03, vTree.y) * (gl_FrontFacing ? 1.0 : 0.0);
          diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, snowCap);`,
        );
    };
    const previousKey = material.customProgramCacheKey.bind(material);
    material.customProgramCacheKey = () => `${previousKey()}|tree`;
  };
  addTreeLook(treeMaterial);
  addTreeLook(leafMaterial);
  addTreeLook(shrubMaterial);
  // In winter the shallows of the lake freeze (waterLook.ts); the water the beaver swims in stays open.
  const waterLook = createWaterLook();
  waterLook.apply(lakeMaterial);
  // Broadleaf crowns shrink to nothing as the foliage goes, in the colour pass and in the shadow pass alike.
  const foliage = { value: 1 };
  const leafDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  const addFoliage = (material: THREE.Material): void => {
    const previous = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      previous.call(material, shader, renderer);
      shader.uniforms.foliage = foliage;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 crown;\nuniform float foliage;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          transformed = mix(vec3(0.0, crown.y, 0.0), transformed, mix(1.0, foliage, crown.x));`,
        );
    };
  };
  addFoliage(leafMaterial);
  addFoliage(leafDepthMaterial);
  addFoliage(shrubMaterial);
  // A shrub the beaver walks into is pressed down round it, so the shrubs never hide the beaver. `pushAt` is the
  // view's point, the beaver (or the fly view's point, where it does no harm).
  const pushAt = { value: new THREE.Vector2(1e9, 1e9) };
  const pushHook = shrubMaterial.onBeforeCompile;
  shrubMaterial.onBeforeCompile = (shader, renderer) => {
    pushHook.call(shrubMaterial, shader, renderer);
    shader.uniforms.pushAt = pushAt;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform vec2 pushAt;').replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
      float pressed = 1.0 - smoothstep(1.0, 2.4, distance(vec2(instanceMatrix[3][0], instanceMatrix[3][2]), pushAt));
      transformed.y *= 1.0 - 0.7 * pressed;
      #endif`,
    );
  };
  const shrubKey = shrubMaterial.customProgramCacheKey.bind(shrubMaterial);
  shrubMaterial.customProgramCacheKey = () => `${shrubKey()}|shrub`;
  // Pull the baked ground colours towards the season's colours, by the weights in the geometry. Then steep faces turn
  // to rock, sooner on open ground than under the wood, and stay rock under the snow, since snow does not lie on a
  // cliff. In the fragments a noise laid by world position (groundDetail.ts) varies the brightness, by the land
  // cover's `detail` and more on the steep faces.
  const grassTint = { value: new THREE.Vector4() };
  const forestTint = { value: new THREE.Vector4() };
  const rockColor = { value: new THREE.Color(STEEP_ROCK) };
  const groundNoise = { value: groundNoiseTexture() };
  const shadowHook = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    shadowHook.call(material, shader, renderer);
    shader.uniforms.grassTint = grassTint;
    shader.uniforms.forestTint = forestTint;
    shader.uniforms.rockColor = rockColor;
    shader.uniforms.groundNoise = groundNoise;
    shader.uniforms.snow = snow;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute vec2 seasonWeight;
        attribute float detail;
        uniform vec4 grassTint;
        uniform vec4 forestTint;
        uniform vec3 rockColor;
        uniform float snow;
        varying vec2 vGroundAt;
        varying float vDetail;`,
      )
      .replace(
        '#include <color_vertex>',
        `#include <color_vertex>
        float steep = smoothstep(mix(0.8, 0.62, seasonWeight.y), mix(0.6, 0.44, seasonWeight.y), normal.y);
        #ifdef USE_COLOR
        vColor.rgb = mix(vColor.rgb, grassTint.rgb, grassTint.a * seasonWeight.x);
        vColor.rgb = mix(vColor.rgb, forestTint.rgb, forestTint.a * seasonWeight.y);
        vColor.rgb = mix(vColor.rgb, rockColor * (0.75 + 0.3 * normal.y), 0.8 * steep);
        #endif
        vGroundAt = position.xz;
        // snow is smoother than the ground it covers
        vDetail = (detail + 0.12 * steep) * (1.0 - 0.75 * snow * (seasonWeight.x + seasonWeight.y) * (1.0 - steep));`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D groundNoise;\nvarying vec2 vGroundAt;\nvarying float vDetail;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec4 large = texture2D(groundNoise, vGroundAt * ${(1 / NOISE_LARGE_M).toFixed(5)});
        vec4 small = texture2D(groundNoise, vGroundAt * ${(1 / NOISE_SMALL_M).toFixed(5)});
        // the grain fades out with distance, before the mipmaps would turn it into a pattern
        float grain = (large.r - 0.5) * 1.1 + (small.b - 0.5) * 1.3 * (1.0 - smoothstep(40.0, 160.0, length(vViewPosition)));
        float warm = (large.g - 0.5) * vDetail;
        diffuseColor.rgb *= (1.0 + vDetail * grain) * vec3(1.0 + 0.5 * warm, 1.0 + 0.15 * warm, 1.0 - 0.6 * warm);`,
      );
  };
  const tint = new THREE.Color();
  const setTint = (uniform: { value: THREE.Vector4 }, t: Tint): void => {
    tint.set(t.color);
    uniform.value.set(tint.r, tint.g, tint.b, t.amount);
  };
  interface Shown {
    group: THREE.Group;
    level: number;
    streams: boolean;
    grid: TreeGrid | null;
    shrubs: { mesh: THREE.InstancedMesh; at: Float32Array } | null;
  }
  const meshes = new Map<string, Shown>();
  // Shrubs hide where a pond floods them or a clearing keeps the ground bare.
  let ponds: readonly Pond[] = [];
  let clearings: readonly Clearing[] = [];
  // Counts the changes, so a tile whose shrubs were placed before the last one sets them again when it is shown.
  let clearingVersion = 0;
  const hidden = (x: number, y: number, z: number): boolean => shrubHidden(ponds, clearings, x, y, z);
  const size = store.size;
  // Felled trees are left out when a tile's trees are placed; a tile that lost one is rebuilt.
  const felledIds = new Set<string>();
  const dirty = new Set<string>();
  // Tiles being built a part at a time, not in the scene yet.
  const building = new Map<string, { level: number; group: THREE.Group; stage: number; tile: DecodedTile; clearingVersion: number }>();
  // The far backdrop never changes level, so its tiles are merged into a mesh per chunk,
  // built once the whole chunk has loaded. This is a few hundred draw calls fewer.
  const farChunks = new Map<string, { mesh: THREE.Mesh | null; built: number; tiles: { tx: number; tz: number }[] }>();
  for (const t of store.index.tiles) {
    if (!t.far) continue;
    const key = farChunkKey(t.tx, t.tz);
    const chunk = farChunks.get(key) ?? { mesh: null, built: 0, tiles: [] };
    chunk.tiles.push({ tx: t.tx, tz: t.tz });
    farChunks.set(key, chunk);
  }

  function updateFar(): void {
    const start = performance.now();
    for (const chunk of farChunks.values()) {
      if (chunk.built === chunk.tiles.length) continue; // level 2 is never dropped, so a whole chunk is done for good
      const loaded = chunk.tiles.filter((t) => store.has(t.tx, t.tz, 2));
      // A chunk shows only once whole: with just some tiles in, they hang in the sky as torn islands and ribbons, each with its skirt.
      if (loaded.length < chunk.tiles.length) continue;
      const geos = loaded.map((t) => buildTileGeometry(store.get(t.tx, t.tz, 2)!, size));
      const merged = mergeGeometries(geos);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      merged.computeBoundingSphere();
      if (chunk.mesh) {
        scene.remove(chunk.mesh);
        chunk.mesh.geometry.dispose();
      }
      chunk.mesh = new THREE.Mesh(merged, material);
      scene.add(chunk.mesh);
      chunk.built = loaded.length;
      if (performance.now() - start > BUILD_BUDGET_MS) break;
    }
  }

  return {
    update(x, z) {
      pushAt.value.set(x, z);
      updateFar();
      const todo: { tx: number; tz: number; level: number; dist: number }[] = [];
      for (const t of store.index.tiles) {
        if (t.far) continue;
        const fineOn = streamer.wantsFine(t.tx, t.tz) && store.has(t.tx, t.tz, LEVEL_FINE);
        const level = fineOn ? LEVEL_FINE : shownLevel(streamer.desiredLevel(t.tx, t.tz), (l) => store.has(t.tx, t.tz, l));
        if (level === undefined) continue;
        const shown = meshes.get(tileKey(t.tx, t.tz));
        const wantsStreams = level !== 2 && store.waterOf(t.tx, t.tz) !== undefined;
        if (shown && shown.level === level && shown.streams === wantsStreams && !dirty.has(tileKey(t.tx, t.tz))) continue;
        todo.push({ tx: t.tx, tz: t.tz, level, dist: distToTile(x, z, t.tx, t.tz, size) });
      }
      todo.sort((a, b) => a.dist - b.dist);
      const start = performance.now();
      const wanted = new Map(todo.map((j) => [tileKey(j.tx, j.tz), j.level]));
      for (const [key, p] of building) {
        if (wanted.get(key) !== p.level) {
          disposeGroup(scene, p.group); // no longer wanted at this level
          building.delete(key);
        }
      }
      // A tile is built a part at a time, ground, lake, streams, then trees, and the budget is checked
      // after each part, so a frame no longer carries a whole fine tile. The old tile stays until the
      // new one is done. At least one part is always built.
      for (const job of todo) {
        const key = tileKey(job.tx, job.tz);
        let p = building.get(key);
        if (!p) {
          p = { level: job.level, group: new THREE.Group(), stage: 0, tile: store.get(job.tx, job.tz, job.level)!, clearingVersion };
          building.set(key, p);
        }
        const { tile, group } = p;
        const water = store.waterOf(job.tx, job.tz);
        switch (p.stage++) {
          case 0: {
            const ground = own(new THREE.Mesh(timed('ground', job.level, () => buildTileGeometry(tile, size)), material));
            // Near tiles take and throw shadows; the far rings (level 2) are too far to matter.
            ground.castShadow = ground.receiveShadow = job.level !== 2;
            group.add(ground);
            break;
          }
          case 1: {
            const lakeLevel = store.tileInfo(job.tx, job.tz)?.lakeLevel_m;
            const lake = lakeLevel == null || job.level === 2 ? null : timed('lake', job.level, () => buildLakeGeometry(tile, size, lakeLevel));
            if (lake) group.add(own(new THREE.Mesh(lake, lakeMaterial)));
            break;
          }
          case 2: {
            const streams = job.level !== 2 && water ? timed('streams', job.level, () => buildStreamGeometry(water, (x, z) => store.heightAt(x, z), (x, z) => store.coverAt(x, z) === CLASS_LAKE)) : null;
            if (streams) group.add(own(new THREE.Mesh(streams, streamMaterial)));
            break;
          }
          case 3: {
            const lakeLevel = store.tileInfo(job.tx, job.tz)?.lakeLevel_m ?? null;
            const at = timed('shrubs', job.level, () => placeShrubs(tile, size, { lakeLevel, streamDistance: (x, z, upTo) => store.streamDistance(x, z, upTo) }));
            if (at.length > 0) {
              const mesh = new THREE.InstancedMesh(SHRUB_GEOMETRY, shrubMaterial, at.length / SHRUB_FLOATS);
              mesh.receiveShadow = true; // they take shadows but cast none: too small and low to be worth it
              mesh.userData.shrubs = at;
              setShrubMatrices(mesh, at, hidden);
              p.clearingVersion = clearingVersion;
              setShrubColors(mesh, at);
              mesh.computeBoundingSphere();
              group.add(mesh);
            }
            break;
          }
          default: {
            const trees = timed('trees', job.level, () => buildTrees(tile, size, { conifer: treeMaterial, broadleaf: leafMaterial, broadleafDepth: leafDepthMaterial }, felledIds, store.tileInfo(job.tx, job.tz)?.lakeLevel_m ?? null));
            if (trees) group.add(...trees.meshes);
            const old = meshes.get(key);
            if (old) disposeGroup(scene, old.group);
            scene.add(group);
            dirty.delete(key);
            const shrubMesh = group.children.find((c) => c instanceof THREE.InstancedMesh && c.material === shrubMaterial) as THREE.InstancedMesh | undefined;
            if (shrubMesh && p.clearingVersion !== clearingVersion) setShrubMatrices(shrubMesh, shrubMesh.userData.shrubs as Float32Array, hidden);
            meshes.set(key, {
              group,
              level: job.level,
              streams: job.level !== 2 && water !== undefined,
              grid: trees?.grid ?? null,
              shrubs: shrubMesh ? { mesh: shrubMesh, at: shrubMesh.userData.shrubs as Float32Array } : null,
            });
            building.delete(key);
          }
        }
        if (performance.now() - start > BUILD_BUDGET_MS) break;
      }
      if (todo.length > 0) recordBuildTime('frame', 0, performance.now() - start);
    },
    setSeason(look) {
      shrubMaterial.color.set(look.shrub);
      setTint(grassTint, look.grass);
      setTint(forestTint, look.forest);
      treeMaterial.color.set(look.tree);
      leafMaterial.color.set(look.leaf);
      foliage.value = look.foliage;
      snow.value = look.snow;
      waterLook.setSeason(look);
      // The streams are shallow, so they whiten all along in a frost.
      streamMaterial.color.set(look.water).lerp(waterLook.iceColor, 0.5 * look.ice);
    },
    insideTree(x, y, z, margin) {
      return meshes.get(tileKey(Math.floor(x / size), Math.floor(z / size)))?.grid?.hit(x, y, z, margin) ?? false;
    },
    broadleafNear(x, z, radius, out) {
      const tx = Math.floor(x / size);
      const tz = Math.floor(z / size);
      for (let i = tx - 1; i <= tx + 1; i++) {
        for (let j = tz - 1; j <= tz + 1; j++) meshes.get(tileKey(i, j))?.grid?.broadleafNear(x, z, radius, out);
      }
    },
    nearestTree(x, z, reach, felled) {
      const tx = Math.floor(x / size);
      const tz = Math.floor(z / size);
      let best: TreeRef | null = null;
      let bestDist = reach;
      for (let i = tx - 1; i <= tx + 1; i++) {
        for (let j = tz - 1; j <= tz + 1; j++) {
          const t = meshes.get(tileKey(i, j))?.grid?.nearest(x, z, bestDist, felled);
          if (!t) continue;
          best = t;
          bestDist = Math.hypot(t.x - x, t.z - z);
        }
      }
      return best;
    },
    trunksNear(x, z, reach, felled) {
      const out: Trunk[] = [];
      const tx = Math.floor(x / size);
      const tz = Math.floor(z / size);
      for (let i = tx - 1; i <= tx + 1; i++) {
        for (let j = tz - 1; j <= tz + 1; j++) meshes.get(tileKey(i, j))?.grid?.trunksNear(x, z, reach, felled, out);
      }
      return out;
    },
    setClearings(nextPonds, nextClearings) {
      if (nextPonds === ponds && nextClearings === clearings) return;
      // Only the tiles under a pond or a clearing that came, went, or changed need their shrubs set again.
      const boxes: [number, number, number, number][] = [];
      for (const p of [...ponds, ...nextPonds]) {
        if (!nextPonds.includes(p) || !ponds.includes(p)) boxes.push([p.x0, p.z0, p.x0 + (p.n - 1) * POND_CELL, p.z0 + (p.n - 1) * POND_CELL]);
      }
      if (nextClearings !== clearings) for (const c of [...clearings, ...nextClearings]) boxes.push([c.x - c.r, c.z - c.r, c.x + c.r, c.z + c.r]);
      ponds = nextPonds;
      clearings = nextClearings;
      clearingVersion++;
      for (const [k, shown] of meshes) {
        if (!shown.shrubs) continue;
        const [tx, tz] = k.split('_').map(Number) as [number, number];
        const hit = boxes.some(([x0, z0, x1, z1]) => x1 >= tx * size && x0 <= (tx + 1) * size && z1 >= tz * size && z0 <= (tz + 1) * size);
        if (hit) setShrubMatrices(shown.shrubs.mesh, shown.shrubs.at, hidden);
      }
    },
    setFelled(ids) {
      if (ids.length < felledIds.size) {
        felledIds.clear();
        for (const key of meshes.keys()) dirty.add(key);
      }
      for (let i = felledIds.size; i < ids.length; i++) {
        const id = ids[i]!;
        felledIds.add(id);
        const at = treeIdPosition(id);
        dirty.add(tileKey(Math.floor(at.x / size), Math.floor(at.z / size)));
      }
    },
    stats() {
      let triangles = 0;
      let trees = 0;
      let shrubs = 0;
      let shrubTriangles = 0;
      let drawn = meshes.size;
      for (const { mesh } of farChunks.values()) {
        if (!mesh) continue;
        drawn++;
        triangles += trianglesOf(mesh);
      }
      for (const { group } of meshes.values()) {
        for (const child of group.children as THREE.Mesh[]) {
          const t = trianglesOf(child);
          triangles += t;
          if (child.material === shrubMaterial) {
            shrubs += (child as THREE.InstancedMesh).count;
            shrubTriangles += t;
          } else if (child instanceof THREE.InstancedMesh) trees += child.count;
        }
      }
      return { meshes: drawn, triangles, trees, shrubs, shrubTriangles, tilesByLevel: store.countByLevel() };
    },
  };
}
