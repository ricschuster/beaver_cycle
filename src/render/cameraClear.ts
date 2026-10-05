// Keeps the third person camera out of trees and off the water surface
// (ADR 0005). Pure on its inputs: no three.js, no state.

export interface Clearance {
  /** True when the point is inside a tree, grown by the margin in metres. */
  insideTree(x: number, y: number, z: number, margin: number): boolean;
}

/** Metres between the camera and a tree. */
export const TREE_MARGIN = 0.5;
const STEP = 0.5;
/** Nearest the camera may come to the beaver. */
const MIN_REACH = 1.2;

/**
 * Distance along the ray from the look point to the camera that stays clear of
 * trees, at most `dist`. `to` is the camera spot at the full distance.
 */
export function clearDistance(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  dist: number,
  trees: Clearance,
): number {
  for (let d = STEP; d <= dist; d += STEP) {
    const t = d / dist;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const z = from.z + (to.z - from.z) * t;
    if (trees.insideTree(x, y, z, TREE_MARGIN)) return Math.max(MIN_REACH, d - STEP);
  }
  return dist;
}

/** Half height of the band around the water surface the camera keeps out of. */
export const SURFACE_BAND = 0.4;

/** Moves a camera height out of the band around the water surface, to the side nearer to it. */
export function clearSurface(camY: number, level: number | null): number {
  if (level === null || Math.abs(camY - level) >= SURFACE_BAND) return camY;
  return camY >= level ? level + SURFACE_BAND : level - SURFACE_BAND;
}

/** Eases the used distance: it shortens at once and lengthens over about a second. */
export function easeReach(current: number, target: number, dt: number): number {
  return target < current ? target : Math.min(target, current + dt * 8);
}
