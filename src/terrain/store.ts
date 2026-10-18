import type { StreamPoint, Terrain } from '../sim/terrain';
import { CLASS_LAKE, LEVEL_FINE, sampleHeight, type DecodedTile, type IndexTile, type TileIndex, type TileWater, waterLevelAt } from './format';

export const tileKey = (tx: number, tz: number): string => `${tx}_${tz}`;

/**
 * The tiles held in memory, and the ground queries answered from them. Each
 * query uses the finest level loaded for the tile, and the height follows the
 * same triangles the mesh draws (diagonal from the north east to the south west
 * vertex of each cell), so the beaver stands on what the player sees.
 */
export class TileStore implements Terrain {
  readonly size: number;
  private readonly data = new Map<string, (DecodedTile | undefined)[]>();
  private readonly info = new Map<string, IndexTile>();
  private readonly water = new Map<string, TileWater>();
  /** Counts changes to the tiles held, so a caller can tell nothing moved since it last looked. */
  version = 0;

  constructor(readonly index: TileIndex) {
    this.size = index.tileSize_m;
    for (const t of index.tiles) this.info.set(tileKey(t.tx, t.tz), t);
  }

  tileInfo(tx: number, tz: number): IndexTile | undefined {
    return this.info.get(tileKey(tx, tz));
  }

  putWater(tx: number, tz: number, water: TileWater): void {
    this.water.set(tileKey(tx, tz), water);
    this.version++;
  }

  waterOf(tx: number, tz: number): TileWater | undefined {
    return this.water.get(tileKey(tx, tz));
  }

  /**
   * The water level at a point of tile (tx, tz), null when the tile has no lake. A tile whose water bodies differ in level (a
   * river delta) carries a grid of levels; otherwise the level is the same all over the tile.
   */
  waterLevel(tx: number, tz: number, x: number, z: number): number | null {
    const level = this.info.get(tileKey(tx, tz))?.lakeLevel_m;
    if (level == null) return null;
    return waterLevelAt(this.water.get(tileKey(tx, tz))?.levels, level, tx * this.size, tz * this.size, x, z);
  }

  put(tile: DecodedTile): void {
    const key = tileKey(tile.tx, tile.tz);
    const levels = this.data.get(key) ?? [];
    levels[tile.level] = tile;
    this.version++;
    this.data.set(key, levels);
  }

  drop(tx: number, tz: number, level: number): void {
    this.dropKey(tileKey(tx, tz), level);
  }

  get(tx: number, tz: number, level: number): DecodedTile | undefined {
    return this.data.get(tileKey(tx, tz))?.[level];
  }

  /** `has` for a caller that holds the tile key already, which saves building the string every frame. */
  hasKey(key: string, level: number): boolean {
    return this.data.get(key)?.[level] !== undefined;
  }

  /** `drop` for a caller that holds the tile key already. */
  dropKey(key: string, level: number): void {
    const levels = this.data.get(key);
    if (levels?.[level] === undefined) return;
    levels[level] = undefined;
    this.version++;
  }

  /** `waterOf` for a caller that holds the tile key already. */
  hasWaterKey(key: string): boolean {
    return this.water.has(key);
  }

  has(tx: number, tz: number, level: number): boolean {
    return this.get(tx, tz, level) !== undefined;
  }

  /** The finest level loaded for a tile. */
  finest(tx: number, tz: number): DecodedTile | undefined {
    const levels = this.data.get(tileKey(tx, tz));
    return levels?.[LEVEL_FINE] ?? levels?.find((t) => t !== undefined);
  }

  /** Tiles held, per level, for the test menu readout. */
  countByLevel(): number[] {
    const counts: number[] = [];
    for (const levels of this.data.values()) {
      levels.forEach((t, l) => {
        if (t) counts[l] = (counts[l] ?? 0) + 1;
      });
    }
    return counts;
  }

  /** Bytes of height and class arrays held, per level, for the memory readout (docs/design/38_memory.md). */
  bytesByLevel(): number[] {
    const bytes: number[] = [];
    for (const levels of this.data.values()) {
      levels.forEach((t, l) => {
        if (t) bytes[l] = (bytes[l] ?? 0) + t.heights.byteLength + t.classes.byteLength;
      });
    }
    return bytes;
  }

  private locate(x: number, z: number): { tile: DecodedTile; u: number; v: number } | undefined {
    const { tx, tz } = this.index.tileRange;
    const s = this.size;
    const cx = Math.min(Math.max(x, tx[0] * s), (tx[1] + 1) * s);
    const cz = Math.min(Math.max(z, tz[0] * s), (tz[1] + 1) * s);
    const ix = Math.min(Math.floor(cx / s), tx[1]);
    const iz = Math.min(Math.floor(cz / s), tz[1]);
    const tile = this.finest(ix, iz);
    if (!tile) return undefined;
    const cell = s / tile.n;
    return { tile, u: (cx - ix * s) / cell, v: (cz - iz * s) / cell };
  }

  heightAt(x: number, z: number): number {
    const at = this.locate(x, z);
    if (!at) return 0;
    const { tile, u, v } = at;
    return sampleHeight(tile, u, v);
  }

  /**
   * Metres of water above the ground at a point. Water is where the ground is
   * below the lake level, in a lake cell or beside one, which is the same rule
   * the drawn lake surface follows, so the sim edge is the shoreline on screen.
   */
  waterDepth(x: number, z: number): number {
    const at = this.locate(x, z);
    if (!at) return 0;
    const { tile, u, v } = at;
    const n = tile.n;
    const i = Math.min(Math.floor(u), n - 1);
    const j = Math.min(Math.floor(v), n - 1);
    let lake = false;
    for (let cj = Math.max(j - 1, 0); cj <= Math.min(j + 1, n - 1) && !lake; cj++) {
      for (let ci = Math.max(i - 1, 0); ci <= Math.min(i + 1, n - 1); ci++) {
        if (tile.classes[cj * n + ci] === CLASS_LAKE) {
          lake = true;
          break;
        }
      }
    }
    if (!lake) return 0;
    const level = this.waterLevel(tile.tx, tile.tz, tile.tx * this.size + u * (this.size / n), tile.tz * this.size + v * (this.size / n));
    return level == null ? 0 : Math.max(0, level - sampleHeight(tile, u, v));
  }

  /**
   * Metres to the nearest stream centre line in the tile of the point and the tiles round it, or Infinity. With `upTo`, a
   * line farther than that may be skipped, so the answer is exact up to `upTo` and Infinity or any larger distance beyond.
   */
  streamDistance(x: number, z: number, upTo = Infinity): number {
    const ix = Math.floor(x / this.size);
    const iz = Math.floor(z / this.size);
    let best2 = upTo === Infinity ? Infinity : upTo * upTo;
    for (let tz = iz - 1; tz <= iz + 1; tz++) {
      for (let tx = ix - 1; tx <= ix + 1; tx++) {
        for (const s of this.water.get(tileKey(tx, tz))?.streams ?? []) {
          const box = streamBox(s);
          // A stream whose box is farther than the best so far cannot hold a nearer segment.
          const bx = x < box[0] ? box[0] - x : x > box[2] ? x - box[2] : 0;
          const bz = z < box[1] ? box[1] - z : z > box[3] ? z - box[3] : 0;
          if (bx * bx + bz * bz >= best2) continue;
          for (let i = 1; i < s.pts.length; i++) {
            const [ax, az] = s.pts[i - 1]!;
            const [bx2, bz2] = s.pts[i]!;
            const dx = bx2 - ax;
            const dz = bz2 - az;
            const len2 = dx * dx + dz * dz;
            const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
            const ex = x - (ax + t * dx);
            const ez = z - (az + t * dz);
            const d2 = ex * ex + ez * ez;
            if (d2 < best2) best2 = d2;
          }
        }
      }
    }
    return best2 === upTo * upTo && upTo !== Infinity ? Infinity : Math.sqrt(best2);
  }

  /** Points every `step` metres along the stream lines of the tiles round a point, those within `r` metres of it. */
  streamPoints(x: number, z: number, r: number, step: number): StreamPoint[] {
    const ix = Math.floor(x / this.size);
    const iz = Math.floor(z / this.size);
    const m = Math.ceil(r / this.size);
    const out: StreamPoint[] = [];
    for (let tz = iz - m; tz <= iz + m; tz++) {
      for (let tx = ix - m; tx <= ix + m; tx++) {
        for (const s of this.water.get(tileKey(tx, tz))?.streams ?? []) {
          for (const p of alongLine(s.pts, step)) if (Math.hypot(p.x - x, p.z - z) <= r) out.push(p);
        }
      }
    }
    return out;
  }

  /** The land cover class of the cell under a point, from the finest level loaded. 0 (bare ground) with no tile. */
  coverAt(x: number, z: number): number {
    const at = this.locate(x, z);
    if (!at) return 0;
    const n = at.tile.n;
    return at.tile.classes[Math.min(Math.floor(at.v), n - 1) * n + Math.min(Math.floor(at.u), n - 1)] ?? 0;
  }

  isWater(x: number, z: number): boolean {
    return this.waterDepth(x, z) > 0;
  }
}

const boxes = new WeakMap<object, [number, number, number, number]>();

/** The bounding box (minX, minZ, maxX, maxZ) of a stream line, worked out once. */
function streamBox(s: { pts: readonly (readonly [number, number])[] }): [number, number, number, number] {
  let box = boxes.get(s);
  if (!box) {
    box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [px, pz] of s.pts) {
      box[0] = Math.min(box[0], px);
      box[1] = Math.min(box[1], pz);
      box[2] = Math.max(box[2], px);
      box[3] = Math.max(box[3], pz);
    }
    boxes.set(s, box);
  }
  return box;
}

/** Points every `step` metres along a polyline, with the unit direction of the line there. */
export function alongLine(pts: readonly (readonly [number, number])[], step: number): StreamPoint[] {
  const out: StreamPoint[] = [];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const [x0, z0] = pts[i - 1]!;
    const [x1, z1] = pts[i]!;
    const d = Math.hypot(x1 - x0, z1 - z0);
    if (d === 0) continue;
    const ux = (x1 - x0) / d;
    const uz = (z1 - z0) / d;
    let s = carry ? step - carry : 0;
    while (s <= d) {
      out.push({ x: x0 + ux * s, z: z0 + uz * s, ux, uz });
      s += step;
    }
    carry = d - (s - step);
  }
  return out;
}
