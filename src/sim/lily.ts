// Lily pads: they float on shallow water where it is calm, from spring to autumn, and die back in winter (Q45). They
// are not stored in the world: each is worked out from a grid cell and the terrain, so the same pads lie in the same
// places every time. A picked pad is noted by id and the year, and grows back the next year. Plain functions, no three.js.
import { dateAt } from './clock';
import type { Terrain } from './terrain';

/** The grid is this many metres a side, with at most one pad in a cell. */
export const LILY_CELL = 5;
/** The share of the cells in suitable water that hold a pad. A tuning number. */
export const LILY_DENSITY = 0.4;
/** Pads grow in water between these depths in metres: shallow enough to root, not so shallow it is a puddle. */
export const LILY_MIN_DEPTH = 0.6;
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
  const pads: LilyPad[] = [];
  const x0 = Math.floor((x - radius) / LILY_CELL);
  const x1 = Math.floor((x + radius) / LILY_CELL);
  const z0 = Math.floor((z - radius) / LILY_CELL);
  const z1 = Math.floor((z + radius) / LILY_CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      if (hash(cx, cz, 0) >= LILY_DENSITY) continue;
      const px = (cx + 0.1 + 0.8 * hash(cx, cz, 1)) * LILY_CELL;
      const pz = (cz + 0.1 + 0.8 * hash(cx, cz, 2)) * LILY_CELL;
      if (Math.hypot(px - x, pz - z) > radius) continue;
      const depth = terrain.waterDepth(px, pz);
      if (depth < LILY_MIN_DEPTH || depth > LILY_MAX_DEPTH) continue;
      const id = `lily:${cx}:${cz}`;
      if (picked[id] === year) continue;
      pads.push({ id, x: px, z: pz });
    }
  }
  return pads;
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
