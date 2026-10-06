// The lodge: a dome of logs at the water's edge. The beaver drags a log to the spot and places it; the first
// log marks the site and each one after it adds wood until the lodge is whole. Wood only for now, mud and rock
// come with the dam (15_build_and_repair.md). Plain data and pure functions, no three.js (ADR 0007).
import type { Log } from './logs';
import type { Terrain } from './terrain';
import { DIVE_MIN_DEPTH } from './state';

export interface Lodge {
  x: number;
  z: number;
  /** Height of the water surface (or the ground, on land) at the site, so the dome sits on it. */
  base: number;
  /** Wood placed so far, in units: a long log is 2, a short one 1 (Q16: bigger trees give more). */
  wood: number;
}

/** Wood units a whole lodge takes. About five big trees; a tuning number, not set by the author. */
export const LODGE_WOOD = 10;
/** Radius of the dome in metres. */
export const LODGE_RADIUS = 2.5;
/** How far from the lodge's centre the beaver can place a log or go in, in metres. */
export const LODGE_REACH = 5;
/** A new lodge is started this far ahead of the beaver, in metres. */
export const SITE_AHEAD = 3;
/** A lodge site is shallow water or the wet shore: deeper than this it is too deep to pile logs on, shallower is dry land. */
export const SITE_MIN_DEPTH = 0.1;
export const SITE_MAX_DEPTH = 1.2;
/** The entrance is under water, so deep water must lie within this many metres of the site. */
export const SITE_DEEP_REACH = 6;

/** Wood units a log is worth, by its length (see `logLength`). */
export function logWood(log: Pick<Log, 'length'>): number {
  return log.length >= 6 ? 2 : 1;
}

export function lodgeProgress(lodge: Lodge): number {
  return Math.min(1, lodge.wood / LODGE_WOOD);
}

export function lodgeComplete(lodge: Lodge | null): lodge is Lodge {
  return lodge !== null && lodge.wood >= LODGE_WOOD;
}

/** True when a point is within `reach` metres of the lodge's centre. */
export function nearLodge(lodge: Lodge, x: number, z: number, reach = LODGE_REACH): boolean {
  return Math.hypot(x - lodge.x, z - lodge.z) <= reach;
}

/**
 * Where a lodge could start for a beaver at (x, z) facing `heading`: a spot ahead in shallow water, with deep
 * water close by for the underwater entrance (as a real beaver's lodge or bank den has). Null if not there.
 */
export function lodgeSite(terrain: Terrain, x: number, z: number, heading: number): Lodge | null {
  const sx = x + Math.sin(heading) * SITE_AHEAD;
  const sz = z + Math.cos(heading) * SITE_AHEAD;
  const depth = terrain.waterDepth(sx, sz);
  if (depth < SITE_MIN_DEPTH || depth > SITE_MAX_DEPTH) return null;
  let deep = false;
  for (let r = 2; r <= SITE_DEEP_REACH && !deep; r += 2) {
    for (let i = 0; i < 8 && !deep; i++) {
      const a = (i * Math.PI) / 4;
      deep = terrain.waterDepth(sx + Math.sin(a) * r, sz + Math.cos(a) * r) >= DIVE_MIN_DEPTH;
    }
  }
  if (!deep) return null;
  return { x: sx, z: sz, base: terrain.heightAt(sx, sz) + depth, wood: 0 };
}

/** The lodge with one more log's wood added, never past a whole lodge. */
export function addWood(lodge: Lodge, log: Pick<Log, 'length'>): Lodge {
  return { ...lodge, wood: Math.min(LODGE_WOOD, lodge.wood + logWood(log)) };
}
