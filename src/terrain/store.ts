import type { Terrain } from '../sim/terrain';
import { CLASS_LAKE, LEVEL_FINE, sampleHeight, type DecodedTile, type IndexTile, type TileIndex, type TileWater } from './format';

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

  constructor(readonly index: TileIndex) {
    this.size = index.tileSize_m;
    for (const t of index.tiles) this.info.set(tileKey(t.tx, t.tz), t);
  }

  tileInfo(tx: number, tz: number): IndexTile | undefined {
    return this.info.get(tileKey(tx, tz));
  }

  putWater(tx: number, tz: number, water: TileWater): void {
    this.water.set(tileKey(tx, tz), water);
  }

  waterOf(tx: number, tz: number): TileWater | undefined {
    return this.water.get(tileKey(tx, tz));
  }

  put(tile: DecodedTile): void {
    const key = tileKey(tile.tx, tile.tz);
    const levels = this.data.get(key) ?? [];
    levels[tile.level] = tile;
    this.data.set(key, levels);
  }

  drop(tx: number, tz: number, level: number): void {
    const levels = this.data.get(tileKey(tx, tz));
    if (levels) levels[level] = undefined;
  }

  get(tx: number, tz: number, level: number): DecodedTile | undefined {
    return this.data.get(tileKey(tx, tz))?.[level];
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
    const level = this.info.get(tileKey(tile.tx, tile.tz))?.lakeLevel_m;
    return level == null ? 0 : Math.max(0, level - sampleHeight(tile, u, v));
  }

  /** Metres to the nearest stream centre line in the tile of the point and the tiles round it, or Infinity. */
  streamDistance(x: number, z: number): number {
    const ix = Math.floor(x / this.size);
    const iz = Math.floor(z / this.size);
    let best = Infinity;
    for (let tz = iz - 1; tz <= iz + 1; tz++) {
      for (let tx = ix - 1; tx <= ix + 1; tx++) {
        for (const s of this.water.get(tileKey(tx, tz))?.streams ?? []) {
          for (let i = 1; i < s.pts.length; i++) {
            const [ax, az] = s.pts[i - 1]!;
            const [bx, bz] = s.pts[i]!;
            const dx = bx - ax;
            const dz = bz - az;
            const len2 = dx * dx + dz * dz;
            const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / len2));
            best = Math.min(best, Math.hypot(x - (ax + t * dx), z - (az + t * dz)));
          }
        }
      }
    }
    return best;
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
