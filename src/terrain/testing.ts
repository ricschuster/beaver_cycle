// Helpers for tests: small synthetic tiles and indexes.
import type { DecodedTile, TileIndex } from './format';

export function makeIndex(tx: [number, number], tz: [number, number], lakeLevel?: number): TileIndex {
  const tiles = [];
  for (let z = tz[0]; z <= tz[1]; z++) {
    for (let x = tx[0]; x <= tx[1]; x++) {
      tiles.push({ tx: x, tz: z, water: lakeLevel !== undefined, min_m: 0, max_m: 0, lakeLevel_m: lakeLevel ?? null });
    }
  }
  return {
    version: 1,
    tileSize_m: 320,
    levels: [
      { level: 0, cell_m: 5, cells: 64 },
      { level: 1, cell_m: 10, cells: 32 },
      { level: 2, cell_m: 20, cells: 16 },
    ],
    heightScale_m: 0.05,
    classes: {},
    tileRange: { tx, tz },
    lakes: [],
    anchors: [],
    tiles,
  };
}

/** A tile whose height at a world position comes from f, and whose cells are all class `cls`. */
export function makeTile(
  tx: number,
  tz: number,
  level: number,
  f: (x: number, z: number) => number,
  cls = 0,
): DecodedTile {
  const n = 64 >> level;
  const cell = 320 / n;
  const heights = new Float32Array((n + 1) * (n + 1));
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) heights[j * (n + 1) + i] = f(tx * 320 + i * cell, tz * 320 + j * cell);
  }
  return { tx, tz, level, n, heights, classes: new Uint8Array(n * n).fill(cls) };
}
