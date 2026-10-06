// The lodge: a dome of logs at the water's edge. The beaver drags a log to the spot and places it; the first
// log marks the site and each one after it adds wood until the lodge is whole. Wood only for now, mud and rock
// come with the dam (15_build_and_repair.md). Plain data and pure functions, no three.js (ADR 0007).
import type { Log } from './logs';
import type { Terrain } from './terrain';
import { DIVE_MIN_DEPTH } from './state';
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

/** The dome is solid out to this radius (a trunk to the beaver), a little inside the drawn dome. */
export const SOLID_RADIUS = LODGE_RADIUS - 0.2;
/** The chamber inside, where the beaver can move once it has swum in, in metres from the centre. */
export const CHAMBER_RADIUS = 1.2;
/** A diving beaver this close (metres) to the entrance, heading in, swims into a whole lodge. */
export const DOOR_REACH = 1.5;
/** How far from the centre the beaver stands at the entrance outside, just clear of the solid dome. */
export const DOOR_DISTANCE = SOLID_RADIUS + 0.6;

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
  const sx = x + Math.sin(heading) * SITE_AHEAD;
  const sz = z + Math.cos(heading) * SITE_AHEAD;
  const depth = terrain.waterDepth(sx, sz);
  const fail = (problem: SiteProblem): SiteCheck => ({ x: sx, z: sz, problem, lodge: null });
  if (depth < SITE_MIN_DEPTH) return fail('dry');
  if (depth > SITE_MAX_DEPTH) return fail('deep');
  let deep = false;
  for (let r = 2; r <= SITE_DEEP_REACH && !deep; r += 2) {
    for (let i = 0; i < 8 && !deep; i++) {
      const a = (i * Math.PI) / 4;
      deep = terrain.waterDepth(sx + Math.sin(a) * r, sz + Math.cos(a) * r) >= DIVE_MIN_DEPTH;
    }
  }
  if (!deep) return fail('far');
  // The entrance faces the deepest water around the site.
  let door = 0;
  let deepest = -1;
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8;
    const d = terrain.waterDepth(sx + Math.sin(a) * 4, sz + Math.cos(a) * 4);
    if (d > deepest) {
      deepest = d;
      door = a;
    }
  }
  return { x: sx, z: sz, problem: null, lodge: { x: sx, z: sz, base: terrain.heightAt(sx, sz) + depth, door, wood: 0 } };
}

/** The lodge that could start for a beaver at (x, z) facing `heading`, or null. */
export function lodgeSite(terrain: Terrain, x: number, z: number, heading: number): Lodge | null {
  return checkSite(terrain, x, z, heading).lodge;
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

/** The point nearest (x, z) inside the chamber. */
export function clampChamber(lodge: Lodge, x: number, z: number): { x: number; z: number } {
  const dx = x - lodge.x;
  const dz = z - lodge.z;
  const d = Math.hypot(dx, dz);
  return d <= CHAMBER_RADIUS ? { x, z } : { x: lodge.x + (dx / d) * CHAMBER_RADIUS, z: lodge.z + (dz / d) * CHAMBER_RADIUS };
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
