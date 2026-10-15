// Tile files and the index, as written by tools/tiles/build_tiles.py. The file
// layout is documented at the top of that script.

export const CLASS_LAKE = 9;

/**
 * The fine level (prototype, ADR 0008): cells of 1 or 2 m cut from the BEV 1 m
 * terrain, only for tiles near a lake. It is finer than level 0, and its tile
 * has fewer or more cells per side than the others, so always use `tile.n`.
 */
export const LEVEL_FINE = 3;

export interface IndexTile {
  tx: number;
  tz: number;
  water: boolean;
  min_m: number;
  max_m: number;
  /** Flat lake level in metres, when the tile has lake. */
  lakeLevel_m?: number | null;
  /** The tile also has a fine level file (level 3). */
  fine?: boolean;
  /** A backdrop tile beyond the play area: a coarse level 2 file only, so it is never loaded finer. */
  far?: boolean;
}

export interface TileIndex {
  version: number;
  tileSize_m: number;
  levels: { level: number; cell_m: number; cells: number; fine?: boolean }[];
  heightScale_m: number;
  classes: Record<string, number>;
  tileRange: { tx: [number, number]; tz: [number, number] };
  lakes: { name: string; level_m: number }[];
  anchors: {
    kind: string;
    id: string;
    name: string;
    x: number;
    z: number;
    elevation_m: number | null;
    inTiles: boolean;
  }[];
  tiles: IndexTile[];
}

export interface DecodedTile {
  tx: number;
  tz: number;
  level: number;
  /** Cells per side. */
  n: number;
  /** (n + 1) squared heights in metres, row major, z rows from north to south. */
  heights: Float32Array;
  /** n squared land cover classes. */
  classes: Uint8Array;
}

const HEADER = 16;

export function decodeTile(tx: number, tz: number, buf: ArrayBuffer): DecodedTile {
  const v = new DataView(buf);
  const magic = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  if (magic !== 'BCT1') throw new Error(`bad tile magic "${magic}"`);
  const level = v.getUint8(4);
  const n = v.getUint16(6, true);
  const qmin = v.getInt32(8, true);
  const scale = v.getFloat32(12, true);
  const nv = (n + 1) * (n + 1);
  if (buf.byteLength !== HEADER + nv * 2 + n * n) throw new Error('tile has the wrong size');
  const heights = new Float32Array(nv);
  for (let i = 0; i < nv; i++) heights[i] = (v.getUint16(HEADER + i * 2, true) + qmin) * scale;
  const classes = new Uint8Array(buf.slice(HEADER + nv * 2));
  return { tx, tz, level, n, heights, classes };
}

/** Water levels sampled on a square grid over a tile, `step` metres apart from its north west corner, null where no water is near. */
export interface WaterLevels {
  step: number;
  n: number;
  v: (number | null)[];
}

/**
 * The water level at a point of a tile, from the grid `levels` (its north west corner at `x0`, `z0`), or `fallback` where the
 * tile has no grid or no sample near the point. It blends the samples round the point that have a level.
 */
export function waterLevelAt(levels: WaterLevels | undefined, fallback: number, x0: number, z0: number, x: number, z: number): number {
  if (!levels) return fallback;
  const { step, n, v } = levels;
  const gx = Math.min(Math.max((x - x0) / step, 0), n - 1);
  const gz = Math.min(Math.max((z - z0) / step, 0), n - 1);
  const i = Math.min(Math.floor(gx), n - 2);
  const j = Math.min(Math.floor(gz), n - 2);
  const fx = gx - i;
  const fz = gz - j;
  let sum = 0;
  let weight = 0;
  for (let dj = 0; dj < 2; dj++) {
    for (let di = 0; di < 2; di++) {
      const sample = v[(j + dj) * n + i + di];
      if (sample == null) continue;
      const wgt = (di ? fx : 1 - fx) * (dj ? fz : 1 - fz);
      sum += sample * wgt;
      weight += wgt;
    }
  }
  return weight > 1e-6 ? sum / weight : fallback;
}

/** Streams of a tile, as cut by the tile tool: polylines in world metres. */
export interface TileWater {
  lakeLevel_m: number | null;
  /** The water level over the tile, where its water bodies differ in level (a sloping river delta). Absent: one level. */
  levels?: WaterLevels;
  /** `w` is the drawn width in metres, absent in older tiles. */
  streams: { name: string; w?: number; pts: [number, number][] }[];
}

/**
 * Height at a position given in cells from the tile's north west corner. It
 * follows the triangles the mesh draws (diagonal from the north east to the
 * south west vertex of each cell).
 */
export function sampleHeight(tile: DecodedTile, u: number, v: number): number {
  const w = tile.n + 1;
  const i = Math.min(Math.max(Math.floor(u), 0), tile.n - 1);
  const j = Math.min(Math.max(Math.floor(v), 0), tile.n - 1);
  const fx = u - i;
  const fz = v - j;
  const h = tile.heights;
  const a = h[j * w + i]!;
  const b = h[j * w + i + 1]!;
  const c = h[(j + 1) * w + i]!;
  const d = h[(j + 1) * w + i + 1]!;
  return fx + fz <= 1 ? a + fx * (b - a) + fz * (c - a) : d + (1 - fx) * (c - d) + (1 - fz) * (b - d);
}
