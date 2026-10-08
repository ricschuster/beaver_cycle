// What the simulation needs to know about the ground. A loader fills it in
// (src/terrain/), a flat stand-in serves unit tests and the no-tiles fallback.
// The simulation never imports the loader or three.js (ADR 0007).

export interface Terrain {
  /** Ground height in metres at a point (the lake bed under water). */
  heightAt(x: number, z: number): number;
  /** True where the ground is lake. */
  isWater(x: number, z: number): boolean;
  /** Metres of water above the ground, 0 on dry land. */
  waterDepth(x: number, z: number): number;
  /** Metres from a point to the nearest stream centre line, or Infinity with no stream near. Missing where the ground has no streams (a test stand-in). */
  streamDistance?(x: number, z: number): number;
}

export function flatTerrain(height = 0): Terrain {
  return {
    heightAt: () => height,
    isWater: () => false,
    waterDepth: () => 0,
  };
}
