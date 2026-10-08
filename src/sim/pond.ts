// The pond a dam holds (docs/design/20_dams_and_ponds.md): the ground below the water level, upstream of the dam line,
// connected to the stream. A flood fill over a window of the ground, the same walk the dam site scan does
// (tools/dam-sites/scan_dam_sites.py). Water is not simulated: the level is a number and the extent a fill. The fill is
// kept as a grid of ground heights and flooded points, so it never asks the ground again. No three.js (ADR 0007).
import { LEVEL1_COST, damCondition, damProgress, type Dam } from './dam';
import { LEVEL_CREST, type DamSpot } from './damSpots';
import type { Terrain } from './terrain';
import { WORN_BELOW } from './wear';

/** Grid cell and half side of the window, metres: the same as the scan. */
export const POND_CELL = 2;
export const POND_HALF = 80;
/** A pond over this many square metres, or one that reaches the window edge, spills into the valley and is no pond. */
export const MAX_POND_M2 = 12000;
/** The seed of the fill is the lowest ground upstream of the dam line within this many metres of the spot: the real channel lies a few metres off the drawn stream line. */
const SEED_RADIUS = 8;
const SEED_MIN_UP = 1;
/** A pond shows only from this crest height up, metres: a few centimetres is a wet patch. */
export const MIN_CREST = 0.15;

/** The crest is worked out in steps of this many metres, so the pond is flooded again only when the level moves a step. */
export const CREST_STEP = 0.05;

export interface Pond {
  /** The `DamSpot.id` of the dam holding it. */
  spot: string;
  /** Crest height above the bed it was flooded for, metres. */
  crest: number;
  /** Height of the water surface, metres. */
  level: number;
  /** Grid points on a side, and the position of point (0, 0), metres. */
  n: number;
  x0: number;
  z0: number;
  /** Ground height at each grid point, row j (z) then column i (x). */
  heights: Float32Array;
  /** 1 where the point is flooded. */
  flooded: Uint8Array;
  /** Square metres flooded. */
  area: number;
}

/**
 * Height of the water above the stream bed for a dam, in steps of `CREST_STEP`: it rises as the dam is built to the full
 * level 1 crest. A whole dam holds it while good, and lets it sag as it wears (15_build_and_repair.md): the level falls with
 * the condition below worn, so a worn dam sags a little each day and a broken one drains to the stream within days.
 */
export function crestOf(dam: Dam | undefined, clock = 0): number {
  const full = LEVEL_CREST[0]! * damProgress(dam, LEVEL1_COST);
  const crest = full * Math.min(1, damCondition(dam, clock) / WORN_BELOW);
  return Math.round(crest / CREST_STEP) * CREST_STEP;
}

/** The pond a crest of this height holds at a spot, or null when the ground does not hold it (too low, too wide, spills). */
export function floodPond(terrain: Terrain, spot: DamSpot, crest: number): Pond | null {
  if (crest < MIN_CREST) return null;
  const k = Math.floor(POND_HALF / POND_CELL);
  const n = 2 * k + 1;
  const x0 = spot.bed.x - k * POND_CELL;
  const z0 = spot.bed.z - k * POND_CELL;
  const heights = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) heights[j * n + i] = terrain.heightAt(x0 + i * POND_CELL, z0 + j * POND_CELL);
  const level = spot.bedY + crest;
  const { x: fx, z: fz } = spot.flow;
  // Upstream of the dam line, which runs across the stream through the bed point.
  const up = (i: number, j: number): number => -((x0 + i * POND_CELL - spot.bed.x) * fx + (z0 + j * POND_CELL - spot.bed.z) * fz);
  const low = (i: number, j: number): boolean => heights[j * n + i]! < level && up(i, j) > 0;
  let seed: [number, number] | null = null;
  for (let j = k - SEED_RADIUS / POND_CELL; j <= k + SEED_RADIUS / POND_CELL; j++) {
    for (let i = k - SEED_RADIUS / POND_CELL; i <= k + SEED_RADIUS / POND_CELL; i++) {
      if (Math.hypot((i - k) * POND_CELL, (j - k) * POND_CELL) > SEED_RADIUS || up(i, j) < SEED_MIN_UP || !low(i, j)) continue;
      if (!seed || heights[j * n + i]! < heights[seed[1] * n + seed[0]]!) seed = [i, j];
    }
  }
  if (!seed) return null;
  const flooded = new Uint8Array(n * n);
  flooded[seed[1] * n + seed[0]] = 1;
  const queue: [number, number][] = [seed];
  const limit = Math.floor(MAX_POND_M2 / POND_CELL ** 2);
  let cells = 0;
  for (let head = 0; head < queue.length; head++) {
    const [i, j] = queue[head]!;
    cells++;
    if (cells > limit || i === 0 || j === 0 || i === n - 1 || j === n - 1) return null;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const a = i + di;
      const b = j + dj;
      if (flooded[b * n + a] || !low(a, b)) continue;
      flooded[b * n + a] = 1;
      queue.push([a, b]);
    }
  }
  return { spot: spot.id, crest, level, n, x0, z0, heights, flooded, area: cells * POND_CELL ** 2 };
}

/** What the ponds were last flooded for: the ponds, and the crest of each dam they were worked out at. */
export interface PondSet {
  ponds: Pond[];
  crests: Record<string, number>;
}

export const noPonds: PondSet = { ponds: [], crests: {} };

/** The ponds of a list of dams: one per dam that holds water, at the crest the dam has been built and worn to at `clock`. */
export function pondsOf(dams: readonly Dam[], spots: readonly DamSpot[], terrain: Terrain, clock = 0): PondSet {
  const ponds: Pond[] = [];
  const crests: Record<string, number> = {};
  for (const dam of dams) {
    const spot = spots.find((s) => s.id === dam.spot);
    if (!spot) continue;
    const crest = crestOf(dam, clock);
    crests[dam.spot] = crest;
    const pond = floodPond(terrain, spot, crest);
    if (pond) ponds.push(pond);
  }
  return { ponds, crests };
}

/** `prev` itself while no dam's crest has moved a step, else the ponds worked out again. Cheap enough to ask every frame. */
export function pondsAt(prev: PondSet, dams: readonly Dam[], spots: readonly DamSpot[], terrain: Terrain, clock: number): PondSet {
  const same = dams.every((d) => !spots.some((s) => s.id === d.spot) || prev.crests[d.spot] === crestOf(d, clock));
  return same && Object.keys(prev.crests).length === dams.filter((d) => spots.some((s) => s.id === d.spot)).length ? prev : pondsOf(dams, spots, terrain, clock);
}

/** Metres of pond water above the ground at a point, 0 outside every pond. */
export function pondDepthAt(ponds: readonly Pond[], ground: (x: number, z: number) => number, x: number, z: number): number {
  let depth = 0;
  for (const p of ponds) {
    const u = (x - p.x0) / POND_CELL;
    const v = (z - p.z0) / POND_CELL;
    const i = Math.floor(u);
    const j = Math.floor(v);
    if (i < 0 || j < 0 || i >= p.n - 1 || j >= p.n - 1) continue;
    if (!(p.flooded[j * p.n + i] || p.flooded[j * p.n + i + 1] || p.flooded[(j + 1) * p.n + i] || p.flooded[(j + 1) * p.n + i + 1])) continue;
    depth = Math.max(depth, p.level - ground(x, z));
  }
  return depth;
}

/** The ground with the ponds' water added to its lake water. With no ponds it is the ground itself. */
export function withPonds(terrain: Terrain, ponds: readonly Pond[]): Terrain {
  if (ponds.length === 0) return terrain;
  const waterDepth = (x: number, z: number): number => Math.max(terrain.waterDepth(x, z), pondDepthAt(ponds, (px, pz) => terrain.heightAt(px, pz), x, z));
  return {
    heightAt: (x, z) => terrain.heightAt(x, z),
    waterDepth,
    isWater: (x, z) => waterDepth(x, z) > 0,
    streamDistance: terrain.streamDistance ? (x, z) => terrain.streamDistance!(x, z) : undefined,
  };
}
