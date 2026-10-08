// The lodge: a dome of logs at the water's edge. The beaver drags a log to the spot and places it; the first
// log marks the site and each one after it adds wood until the lodge is whole. Wood only for now, mud and rock
// come with the dam (15_build_and_repair.md). Plain data and pure functions, no three.js (ADR 0007).
import type { Log } from './logs';
import type { Terrain } from './terrain';
import { LODGE_WORN_DAYS, condition, type Wear } from './wear';
import type { Trunk } from './trees';

export interface Lodge {
  x: number;
  z: number;
  /** Height of the water surface (or the ground, on land) at the site, so the dome sits on it. */
  base: number;
  /** Direction of the underwater entrance, as a heading in radians (x = sin, z = cos): toward the deepest water. */
  door: number;
  /** Wood placed so far, in units: a long log is 2, a short one 1 (Q16: bigger trees give more). */
  wood: number;
  /** The dam spot of the pond the lodge stands in, if it does: its floor then follows the pond's water (docs/design/20_dams_and_ponds.md). */
  pond?: string;
  /** Wear, set when the lodge is whole. Missing means it never wears (a test lodge). */
  wear?: Wear;
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
/**
 * The entrance is under water, so the water at the door must be deep enough to dive in, with some to spare, and stay
 * that deep for `DOOR_RUN` metres further out (the way in, and later the food store beside it).
 */
export const DOOR_MIN_DEPTH = 1.2;
export const DOOR_RUN = 3;

/** The dome is solid out to this radius (a trunk to the beaver), a little inside the drawn dome. */
export const SOLID_RADIUS = LODGE_RADIUS - 0.2;
/**
 * The inside is a round room, its own space around the lodge's centre (the renderer draws it in a scene of its
 * own instead of the outside). The beaver stays within this radius of the centre, in metres. It is big enough
 * for a family of up to 7 beavers, each with a nest.
 */
export const INTERIOR_RADIUS = 6;
/** The water hole in the floor, the way out, as an offset from the lodge's centre and a radius, in metres. */
export const HOLE = { x: 0, z: 0, radius: 1.2 };
/** How many beavers the room has a nest for. */
export const NEST_COUNT = 7;
/** Distance of the nests from the centre, and the radius of each, in metres. */
const NEST_RING = 4.5;
const NEST_RADIUS = 0.9;
/** The sleeping nests of shredded wood round the wall, as offsets from the lodge's centre. The beaver walks on them. */
export const NEST_SPOTS = Array.from({ length: NEST_COUNT }, (_, i) => {
  const a = Math.PI + (i * 2 * Math.PI) / NEST_COUNT;
  return { x: Math.sin(a) * NEST_RING, z: Math.cos(a) * NEST_RING, radius: NEST_RADIUS };
});
/** The first nest, the player's own. */
export const NEST = NEST_SPOTS[0]!;
/** The beaver can use the hole or the nest from this far from the edge of it. */
export const USE_REACH = 0.7;
/** A diving beaver this close (metres) to the entrance, heading in, swims into a whole lodge. */
export const DOOR_REACH = 1.5;
/** How far from the centre, toward the entrance side, the beaver appears when it swims in (clear of the water hole). */
export const ENTER_DISTANCE = 3;
/** How far from the centre the beaver stands at the entrance outside, just clear of the solid dome. */
export const DOOR_DISTANCE = SOLID_RADIUS + 0.6;

/** Wood units a log is worth, by its length (see `logLength`). */
export function logWood(log: Pick<Log, 'length'>): number {
  return log.length >= 6 ? 2 : 1;
}

export function lodgeProgress(lodge: Lodge): number {
  return Math.min(1, lodge.wood / LODGE_WOOD);
}

/** Condition of the lodge at a game clock time, 0 broken to 1 new. */
export const lodgeCondition = (lodge: Lodge, clock: number): number => condition(lodge.wear, clock, LODGE_WORN_DAYS);

export function lodgeComplete(lodge: Lodge | null): lodge is Lodge {
  return lodge !== null && lodge.wood >= LODGE_WOOD;
}

/** True when a point is within `reach` metres of the lodge's centre. */
export function nearLodge(lodge: Lodge, x: number, z: number, reach = LODGE_REACH): boolean {
  return Math.hypot(x - lodge.x, z - lodge.z) <= reach;
}

/** Why a spot cannot start a lodge: dry land or too shallow, water too deep, or no deep water near for the entrance. */
export type SiteProblem = 'dry' | 'deep' | 'far';

export interface SiteCheck {
  /** The spot checked: ahead of the beaver. */
  x: number;
  z: number;
  /** Null when a lodge can start here. */
  problem: SiteProblem | null;
  /** The new lodge when it can start here, else null. */
  lodge: Lodge | null;
}

/**
 * Check the spot where a lodge would start for a beaver at (x, z) facing `heading`: ahead in shallow water, with
 * deep water close by for the underwater entrance (as a real beaver's lodge or bank den has).
 */
export function checkSite(terrain: Terrain, x: number, z: number, heading: number): SiteCheck {
  return checkSpot(terrain, x + Math.sin(heading) * SITE_AHEAD, z + Math.cos(heading) * SITE_AHEAD);
}

/** Check whether a lodge can start at exactly (sx, sz). */
export function checkSpot(terrain: Terrain, sx: number, sz: number): SiteCheck {
  const depth = terrain.waterDepth(sx, sz);
  const fail = (problem: SiteProblem): SiteCheck => ({ x: sx, z: sz, problem, lodge: null });
  if (depth < SITE_MIN_DEPTH) return fail('dry');
  if (depth > SITE_MAX_DEPTH) return fail('deep');
  // The entrance faces the direction where the water is deepest at the door and along the way out.
  let door = 0;
  let best = -1;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const at = (r: number): number => terrain.waterDepth(sx + Math.sin(a) * r, sz + Math.cos(a) * r);
    const d = Math.min(at(DOOR_DISTANCE), at(DOOR_DISTANCE + DOOR_RUN));
    if (d > best) {
      best = d;
      door = a;
    }
  }
  if (best < DOOR_MIN_DEPTH) return fail('far');
  return { x: sx, z: sz, problem: null, lodge: { x: sx, z: sz, base: terrain.heightAt(sx, sz) + depth, door, wood: 0 } };
}

/** The lodge that could start for a beaver at (x, z) facing `heading`, or null. */
export function lodgeSite(terrain: Terrain, x: number, z: number, heading: number): Lodge | null {
  return checkSite(terrain, x, z, heading).lodge;
}

/**
 * The lodge with its floor at the water of the pond it stands in: it rises and falls with the pond, so the room stays dry and the
 * door stays under water. With no pond (a drained one) it rests on the ground. A lodge in the lake is itself.
 */
export function followPond(lodge: Lodge, ponds: readonly { spot: string; level: number }[], ground: Terrain): Lodge {
  if (!lodge.pond) return lodge;
  const pond = ponds.find((p) => p.spot === lodge.pond);
  const base = pond ? pond.level : ground.heightAt(lodge.x, lodge.z);
  return base === lodge.base ? lodge : { ...lodge, base };
}

/** The lodge with one more log's wood added, never past a whole lodge. */
export function addWood(lodge: Lodge, log: Pick<Log, 'length'>): Lodge {
  return { ...lodge, wood: Math.min(LODGE_WOOD, lodge.wood + logWood(log)) };
}

/** The solid dome as a trunk, so the beaver slides round it like a tree. */
export function lodgeSolid(lodge: Lodge): Trunk {
  return { x: lodge.x, z: lodge.z, radius: SOLID_RADIUS };
}

/** The point `r` metres from the lodge's centre toward the entrance. */
export function doorPoint(lodge: Lodge, r: number): { x: number; z: number } {
  return { x: lodge.x + Math.sin(lodge.door) * r, z: lodge.z + Math.cos(lodge.door) * r };
}

/** The point nearest (x, z) inside the room. */
export function clampInterior(lodge: Lodge, x: number, z: number): { x: number; z: number } {
  const dx = x - lodge.x;
  const dz = z - lodge.z;
  const d = Math.hypot(dx, dz);
  return d <= INTERIOR_RADIUS ? { x, z } : { x: lodge.x + (dx / d) * INTERIOR_RADIUS, z: lodge.z + (dz / d) * INTERIOR_RADIUS };
}

/** The water hole as a trunk, so the beaver walks round it and does not fall in. */
export function holeSolid(lodge: Lodge): Trunk {
  return { x: lodge.x + HOLE.x, z: lodge.z + HOLE.z, radius: HOLE.radius };
}

/** True when the beaver is next to the water hole (BEAVER_RADIUS 0.5 is how close it can get). */
export function atHole(lodge: Lodge, x: number, z: number): boolean {
  return Math.hypot(x - lodge.x - HOLE.x, z - lodge.z - HOLE.z) <= HOLE.radius + 0.5 + USE_REACH;
}

/** True when the beaver is on a nest. */
export function atNest(lodge: Lodge, x: number, z: number): boolean {
  return NEST_SPOTS.some((n) => Math.hypot(x - lodge.x - n.x, z - lodge.z - n.z) <= n.radius + USE_REACH);
}

/** How far a move (x, z) points toward the entrance: 1 straight out through it, -1 straight in from it. */
export function towardDoor(lodge: Lodge, x: number, z: number): number {
  return x * Math.sin(lodge.door) + z * Math.cos(lodge.door);
}

/** True when a point is within reach of the entrance outside. */
export function atDoor(lodge: Lodge, x: number, z: number): boolean {
  const d = doorPoint(lodge, DOOR_DISTANCE);
  return Math.hypot(x - d.x, z - d.z) <= DOOR_REACH;
}

/**
 * The nearest spot to (x, z), within `radius` metres, where a lodge can start, found by scanning rings outward in
 * steps of 2 m (4 m past 100 m). Null when there is none (no water near, as on the flat test plane).
 */
export function findSite(terrain: Terrain, x: number, z: number, radius: number): Lodge | null {
  for (let r = 0; r <= radius; r += r < 100 ? 2 : 4) {
    const n = Math.max(1, Math.round((r * Math.PI) / 1.5));
    for (let i = 0; i < n; i++) {
      const a = (i * 2 * Math.PI) / n;
      const lodge = checkSpot(terrain, x + Math.sin(a) * r, z + Math.cos(a) * r).lodge;
      if (lodge) return lodge;
    }
  }
  return null;
}
