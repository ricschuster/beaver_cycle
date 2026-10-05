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

  isWater(x: number, z: number): boolean {
    const at = this.locate(x, z);
    if (!at) return false;
    const { tile, u, v } = at;
    const i = Math.min(Math.floor(u), tile.n - 1);
    const j = Math.min(Math.floor(v), tile.n - 1);
    return tile.classes[j * tile.n + i] === CLASS_LAKE;
  }

  waterDepth(x: number, z: number): number {
    if (!this.isWater(x, z)) return 0;
    const s = this.size;
    const level = this.info.get(tileKey(Math.floor(x / s), Math.floor(z / s)))?.lakeLevel_m;
    return level == null ? 0 : Math.max(0, level - this.heightAt(x, z));
  }
}
