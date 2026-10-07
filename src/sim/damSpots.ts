// Where a dam can be built (docs/design/20_dams_and_ponds.md). A spot is plain data: a bed point, the way the stream
// flows and the tallest crest that still holds a pond there. The first spots come from the dam site scan
// (tools/dam-sites). No three.js and no DOM here.

/** One site as the scan writes it to dam_sites.json, the fields a spot needs. */
export interface ScannedSite {
  x: number;
  z: number;
  bed_m: number;
  /** Unit vector pointing downstream, in x and z. */
  flow: [number, number];
  crest_m: number;
  pond_m2: number;
  max_depth_m: number;
  /** The play location the scan put it in. */
  near: string;
}

export interface DamSpot {
  id: string;
  bed: { x: number; z: number };
  /** Height of the stream bed here, metres. */
  bedY: number;
  /** Unit vector pointing downstream, in x and z. */
  flow: { x: number; z: number };
  /** Tallest crest above the bed that holds water here. Level 1 to 3 are crests of 1.0, 1.5 and 2.0 m. */
  maxCrest: number;
  pondM2: number;
}

/** Crest above the bed for each dam level, metres (design note 20). */
export const LEVEL_CREST: readonly number[] = [1.0, 1.5, 2.0];

/** The biggest level a spot offers: the highest whose crest the scan found holding water. */
export function maxLevel(spot: DamSpot): 1 | 2 | 3 {
  const n = LEVEL_CREST.filter((c) => c <= spot.maxCrest + 1e-6).length;
  return Math.max(1, Math.min(3, n)) as 1 | 2 | 3;
}

export function spotFromSite(s: ScannedSite): DamSpot {
  return {
    id: `${s.near}:${Math.round(s.x)}:${Math.round(s.z)}`,
    bed: { x: s.x, z: s.z },
    bedY: s.bed_m,
    flow: { x: s.flow[0], z: s.flow[1] },
    maxCrest: s.crest_m,
    pondM2: s.pond_m2,
  };
}

/** A pond must be big enough to see and deep enough to swim in (Q67), or it is no first spot. */
export const FIRST_MIN_POND_M2 = 600;
export const FIRST_MIN_DEPTH_M = 1;
/** First spots lie at least this far apart, so they are three different places (Q74). */
export const FIRST_SPACING_M = 150;
export const FIRST_COUNT = 3;

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
