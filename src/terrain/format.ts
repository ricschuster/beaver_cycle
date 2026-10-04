// Tile files and the index, as written by tools/tiles/build_tiles.py. The file
// layout is documented at the top of that script.

export const CLASS_LAKE = 9;

export interface IndexTile {
  tx: number;
  tz: number;
  water: boolean;
  min_m: number;
  max_m: number;
  /** Flat lake level in metres, when the tile has lake. */
  lakeLevel_m?: number | null;
}

export interface TileIndex {
  version: number;
  tileSize_m: number;
  levels: { level: number; cell_m: number; cells: number }[];
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
