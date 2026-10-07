// Lily pads: they float in clusters on shallow water where it is calm, from spring to autumn, and die back in winter (Q45). They
// are not stored in the world: each is worked out from a grid cell and the terrain, so the same pads lie in the same
// places every time. A picked pad is noted by id and the year, and grows back the next year. Plain functions, no three.js.
import { dateAt } from './clock';
import type { Terrain } from './terrain';

/** Pads lie in patches, like a bay full of them. A patch has its centre in one cell of this many metres a side, or none. */
export const PATCH_CELL = 40;
/** The share of patch cells that hold a patch, if the water at its centre is right. A tuning number. */
export const PATCH_CHANCE = 0.7;
/** A patch is this many metres wide, at least and at most, measured from its centre. */
export const PATCH_MIN_RADIUS = 7;
export const PATCH_MAX_RADIUS = 15;
/** Within a patch, pads sit on a grid of this many metres, thinning out toward the edge. */
export const LILY_CELL = 3;
/** The share of grid cells at a patch centre that hold a pad. A tuning number. */
export const LILY_DENSITY = 0.8;
/** Pads grow in water between these depths in metres: shallow enough to root, not so shallow it is a puddle. */
export const LILY_MIN_DEPTH = 0.25;
export const LILY_MAX_DEPTH = 2.5;
/** The beaver reaches a pad within this many metres of its centre. */
export const LILY_REACH = 1.8;
/** Radius of a pad in metres, for drawing. */
export const LILY_RADIUS = 0.45;

export interface LilyPad {
  id: string;
  x: number;
  z: number;
}

/** Which pads are picked: pad id to the year it was picked. */
export type Picked = Readonly<Record<string, number>>;

/** A number from 0 up to but not including 1, the same for the same cell and salt. */
function hash(cx: number, cz: number, salt: number): number {
  let h = (Math.imul(cx, 374761393) + Math.imul(cz, 668265263) + Math.imul(salt, 2246822519)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** True from spring to autumn, when pads float. */
export function lilyInSeason(clock: number): boolean {
  return dateAt(clock).season !== 'winter';
}

/** The pads within `radius` metres of a point that float now: in season, in suitable water, and not picked this year. */
export function lilyPadsNear(terrain: Terrain, x: number, z: number, radius: number, clock: number, picked: Picked = {}): LilyPad[] {
  if (!lilyInSeason(clock)) return [];
  const year = dateAt(clock).year;
  const pads = new Map<string, LilyPad>();
  const reach = radius + PATCH_MAX_RADIUS;
  const mx0 = Math.floor((x - reach) / PATCH_CELL);
  const mx1 = Math.floor((x + reach) / PATCH_CELL);
  const mz0 = Math.floor((z - reach) / PATCH_CELL);
  const mz1 = Math.floor((z + reach) / PATCH_CELL);
  for (let mx = mx0; mx <= mx1; mx++) {
    for (let mz = mz0; mz <= mz1; mz++) {
      if (hash(mx, mz, 10) >= PATCH_CHANCE) continue;
      const pcx = (mx + 0.15 + 0.7 * hash(mx, mz, 11)) * PATCH_CELL;
      const pcz = (mz + 0.15 + 0.7 * hash(mx, mz, 12)) * PATCH_CELL;
      // A patch grows only where the water at its centre is right, so it lies in a bay and not on a steep bank.
      const centreDepth = terrain.waterDepth(pcx, pcz);
      if (centreDepth < LILY_MIN_DEPTH || centreDepth > LILY_MAX_DEPTH) continue;
      const patchRadius = PATCH_MIN_RADIUS + (PATCH_MAX_RADIUS - PATCH_MIN_RADIUS) * hash(mx, mz, 13);
      const cx0 = Math.floor((pcx - patchRadius) / LILY_CELL);
      const cx1 = Math.floor((pcx + patchRadius) / LILY_CELL);
      const cz0 = Math.floor((pcz - patchRadius) / LILY_CELL);
      const cz1 = Math.floor((pcz + patchRadius) / LILY_CELL);
      for (let cx = cx0; cx <= cx1; cx++) {
        for (let cz = cz0; cz <= cz1; cz++) {
          const px = (cx + 0.1 + 0.8 * hash(cx, cz, 1)) * LILY_CELL;
          const pz = (cz + 0.1 + 0.8 * hash(cx, cz, 2)) * LILY_CELL;
          const fromCentre = Math.hypot(px - pcx, pz - pcz);
          if (fromCentre > patchRadius) continue;
          if (hash(cx, cz, 0) >= LILY_DENSITY * (1 - fromCentre / patchRadius)) continue;
          if (Math.hypot(px - x, pz - z) > radius) continue;
          const id = `lily:${cx}:${cz}`;
          if (pads.has(id) || picked[id] === year) continue;
          const depth = terrain.waterDepth(px, pz);
          if (depth < LILY_MIN_DEPTH || depth > LILY_MAX_DEPTH) continue;
          pads.set(id, { id, x: px, z: pz });
        }
      }
    }
  }
  return [...pads.values()];
}

/** The nearest floating pad within reach of a point, or null. */
export function reachablePad(terrain: Terrain, x: number, z: number, clock: number, picked: Picked): LilyPad | null {
  let best: LilyPad | null = null;
  let bestDist = LILY_REACH;
  for (const pad of lilyPadsNear(terrain, x, z, LILY_REACH, clock, picked)) {
    const d = Math.hypot(pad.x - x, pad.z - z);
    if (d <= bestDist) {
      best = pad;
      bestDist = d;
    }
  }
  return best;
}

/** The picked pads with this one added, noted by the year of the clock. */
export function pickedPad(picked: Picked, pad: LilyPad, clock: number): Picked {
  return { ...picked, [pad.id]: dateAt(clock).year };
}
