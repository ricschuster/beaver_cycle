// What the simulation needs to know about the ground. A loader fills it in
// (src/terrain/), a flat stand-in serves unit tests and the no-tiles fallback.
// The simulation never imports the loader or three.js (ADR 0007).

/** A point on a stream line and the unit direction the line runs in (x and z). */
export interface StreamPoint {
  x: number;
  z: number;
  ux: number;
  uz: number;
}

export interface Terrain {
  /** Ground height in metres at a point (the lake bed under water). */
  heightAt(x: number, z: number): number;
  /** True where the ground is lake. */
  isWater(x: number, z: number): boolean;
  /** Metres of water above the ground, 0 on dry land. */
  waterDepth(x: number, z: number): number;
  /** Metres from a point to the nearest stream centre line, or Infinity with no stream near. With `upTo`, a line farther than that may go unseen (Infinity or a larger distance comes back), which is quicker. Missing where the ground has no streams (a test stand-in). */
  streamDistance?(x: number, z: number, upTo?: number): number;
  /** Points every `step` metres along the stream lines within `r` metres of a point, with the unit direction of the line there. Missing where the ground has no streams (a test stand-in). */
  streamPoints?(x: number, z: number, r: number, step: number): StreamPoint[];
  /** The land cover class at a point (the tile classes, `COVER_MEADOW` and so on). Missing where the ground has no land cover (a test stand-in). */
  coverAt?(x: number, z: number): number;
}

/** The land cover class of meadow in the tiles (tools/tiles/build_tiles.py CLASSES). */
export const COVER_MEADOW = 1;
/** The land cover class of forest in the tiles. */
export const COVER_FOREST = 2;

export function flatTerrain(height = 0): Terrain {
  return {
    heightAt: () => height,
    isWater: () => false,
    waterDepth: () => 0,
  };
}
