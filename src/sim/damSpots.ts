// Where a dam can be built (docs/design/20_dams_and_ponds.md). A spot is plain data: a bed point, the way the stream
// flows and the tallest crest that still holds a pond there. The first spots come from the dam site scan
// (tools/dam-sites). No three.js and no DOM here.

import type { Terrain } from './terrain';

/** One site as the scan writes it to dam_sites.json, the fields a spot needs. */
export interface ScannedSite {
  x: number;
  z: number;
  bed_m: number;
  /** Where the channel bed lies, a few metres off the drawn stream line (x, z). Missing in an older file. */
  channel?: [number, number];
  /** Unit vector pointing downstream, in x and z. */
  flow: [number, number];
  crest_m: number;
  pond_m2: number;
  max_depth_m: number;
  /** The dam length in metres at each level's crest, null where that level holds no pond. Missing in an older file. */
  dam_widths?: (number | null)[];
  /** The play location the scan put it in. */
  near: string;
}

export interface DamSpot {
  id: string;
  bed: { x: number; z: number };
  /** The channel bed the pond is worked out from, a few metres off `bed` (the drawn stream line); `bed` itself when not known. */
  channel?: { x: number; z: number };
  /** Height of the stream bed here, metres. */
  bedY: number;
  /** Unit vector pointing downstream, in x and z. */
  flow: { x: number; z: number };
  /** Tallest crest above the bed that holds water here. Level 1 to 3 are crests of 1.0, 1.5 and 2.0 m. */
  maxCrest: number;
  pondM2: number;
  /** The dam length in metres at each level's crest, null or missing where unknown. It sets what the dam costs (`widthFactor`). */
  widths?: (number | null)[];
  /** A spot found by a pond (`newSpots.ts`) and not yet worked out on the ground near it: its biggest level may be too generous until the beaver comes close. */
  rough?: true;
}

/** Crest above the bed for each dam level, metres (design note 20). */
export const LEVEL_CREST: readonly number[] = [1.0, 1.5, 2.0];

/** The dam length of a typical spot at each level's crest, metres: the median of the scan. A dam of this length costs the table price. */
export const REF_WIDTH: readonly number[] = [16, 20, 22];
/** A dam costs between these shares of the table price, however narrow or wide the valley is there. */
export const MIN_COST_FACTOR = 0.6;
export const MAX_COST_FACTOR = 2;

/** The share of the table price a dam of a level costs at a spot: its length against a typical one, clamped. 1 where the length is not known. */
export function widthFactor(spot: DamSpot, level: 1 | 2 | 3): number {
  const w = spot.widths?.[level - 1];
  return w ? Math.min(MAX_COST_FACTOR, Math.max(MIN_COST_FACTOR, w / REF_WIDTH[level - 1]!)) : 1;
}

/** The biggest level a spot offers: the highest whose crest the scan found holding water. */
export function maxLevel(spot: DamSpot): 1 | 2 | 3 {
  const n = LEVEL_CREST.filter((c) => c <= spot.maxCrest + 1e-6).length;
  return Math.max(1, Math.min(3, n)) as 1 | 2 | 3;
}

export function spotFromSite(s: ScannedSite): DamSpot {
  return {
    id: `${s.near}:${Math.round(s.x)}:${Math.round(s.z)}`,
    bed: { x: s.x, z: s.z },
    ...(s.channel ? { channel: { x: s.channel[0], z: s.channel[1] } } : {}),
    bedY: s.bed_m,
    flow: { x: s.flow[0], z: s.flow[1] },
    maxCrest: s.crest_m,
    pondM2: s.pond_m2,
    ...(s.dam_widths ? { widths: s.dam_widths } : {}),
  };
}

/** A pond must be big enough to see and deep enough to swim in (Q67), or it is no first spot. */
export const FIRST_MIN_POND_M2 = 600;
export const FIRST_MIN_DEPTH_M = 1;
/** First spots lie at least this far apart, so they are different places (Q74, six per area by the author, session 38). */
export const FIRST_SPACING_M = 150;
export const FIRST_COUNT = 6;

/**
 * The first spots of a play location: the ones nearest the anchor that hold a swimmable pond, each at least
 * FIRST_SPACING_M from the ones already taken. A starting guess, to tune on a tablet with the author.
 */
export function firstSpots(sites: readonly ScannedSite[], location: string, anchor: { x: number; z: number }, count = FIRST_COUNT): DamSpot[] {
  const dist = (s: ScannedSite): number => Math.hypot(s.x - anchor.x, s.z - anchor.z);
  const chosen: ScannedSite[] = [];
  const candidates = sites.filter((s) => s.near === location && s.pond_m2 >= FIRST_MIN_POND_M2 && s.max_depth_m >= FIRST_MIN_DEPTH_M).sort((a, b) => dist(a) - dist(b));
  for (const c of candidates) {
    if (chosen.length >= count) break;
    if (chosen.every((o) => Math.hypot(o.x - c.x, o.z - c.z) >= FIRST_SPACING_M)) chosen.push(c);
  }
  return chosen.map(spotFromSite);
}

/** The spots within `range` metres of a point, nearest first. */
export function spotsNear(spots: readonly DamSpot[], x: number, z: number, range: number): DamSpot[] {
  return spots
    .map((s) => ({ s, d: Math.hypot(s.bed.x - x, s.bed.z - z) }))
    .filter((e) => e.d <= range)
    .sort((a, b) => a.d - b.d)
    .map((e) => e.s);
}

/** A start place is this close to a dam spot, metres (the author, session 38). */
export const SPAWN_REACH_M = 200;
/** How far from the bed point the search for dry ground starts, and the steps it widens by. */
const SPAWN_RADII = [50, 80, 110, 140];
const SPAWN_STEEPEST = 0.5;

/** Whether a site would be a first spot, as `firstSpots` judges it. */
export function qualifies(s: ScannedSite): boolean {
  return s.pond_m2 >= FIRST_MIN_POND_M2 && s.max_depth_m >= FIRST_MIN_DEPTH_M;
}

/** The qualifying site closest to a point, or null. */
export function nearestQualifying(p: { x: number; z: number }, sites: readonly ScannedSite[]): ScannedSite | null {
  const d = (s: ScannedSite): number => Math.hypot(s.x - p.x, s.z - p.z);
  return sites.filter(qualifies).reduce<ScannedSite | null>((best, s) => (best === null || d(s) < d(best) ? s : best), null);
}

/**
 * Where to start in a play location: the anchor itself when a qualifying site lies within SPAWN_REACH_M, else dry,
 * gentle ground near the closest qualifying site (on the side facing the anchor), so a dam spot is always close by.
 * Returns the anchor when there are no sites at all.
 */
export function spawnNear(anchor: { x: number; z: number }, sites: readonly ScannedSite[], terrain: Terrain): { x: number; z: number } {
  const nearest = nearestQualifying(anchor, sites);
  if (!nearest || Math.hypot(nearest.x - anchor.x, nearest.z - anchor.z) <= SPAWN_REACH_M) return anchor;
  const face = Math.atan2(anchor.z - nearest.z, anchor.x - nearest.x);
  for (const r of SPAWN_RADII) {
    // Try the angles nearest the anchor's side first.
    for (let i = 0; i < 16; i++) {
      const a = face + (i % 2 === 0 ? 1 : -1) * Math.ceil(i / 2) * ((2 * Math.PI) / 16);
      const p = { x: nearest.x + Math.cos(a) * r, z: nearest.z + Math.sin(a) * r };
      const slope = Math.hypot(terrain.heightAt(p.x + 2, p.z) - terrain.heightAt(p.x - 2, p.z), terrain.heightAt(p.x, p.z + 2) - terrain.heightAt(p.x, p.z - 2)) / 4;
      if (terrain.waterDepth(p.x, p.z) === 0 && slope <= SPAWN_STEEPEST) return p;
    }
  }
  return { x: nearest.x, z: nearest.z };
}
