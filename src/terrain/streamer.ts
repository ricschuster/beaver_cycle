import { timed } from './buildTimes';
import { decodeTile, LEVEL_FINE, type DecodedTile, type TileWater } from './format';
import { tileKey, type TileStore } from './store';

export type FetchTile = (level: number, tx: number, tz: number) => Promise<DecodedTile>;

export type FetchWater = (tx: number, tz: number) => Promise<TileWater>;

export interface StreamerOptions {
  /** Outer radius in metres of level 0 and level 1. Level 2 is everything beyond. */
  rings: [number, number];
  /** A tile keeps its finer level this far past a ring, so it does not flicker. */
  hysteresis: number;
  maxConcurrent: number;
  /** Tiles that have a fine level show it within this many metres. 0 turns it off. */
  fineRing: number;
}

export const defaultStreamerOptions: StreamerOptions = {
  rings: [640, 1300],
  hysteresis: 40,
  maxConcurrent: 4,
  fineRing: 200,
};

export const COARSEST = 2;

/** Detail level for a tile at a distance, keeping the previous level near a ring. */
export function levelFor(dist: number, prev: number | undefined, o: StreamerOptions): number {
  const base = dist < o.rings[0] ? 0 : dist < o.rings[1] ? 1 : COARSEST;
  if (prev !== undefined && prev < COARSEST && base > prev && dist < o.rings[prev]! + o.hysteresis) {
    return prev;
  }
  return base;
}

/** Distance from a point to the nearest point of a square tile. */
export function distToTile(x: number, z: number, tx: number, tz: number, size: number): number {
  const dx = Math.max(tx * size - x, 0, x - (tx + 1) * size);
  const dz = Math.max(tz * size - z, 0, z - (tz + 1) * size);
  return Math.hypot(dx, dz);
}

/**
 * Which level to show for a tile given what is loaded: the wanted level if it
 * is there, else the nearest finer one, else the nearest coarser one.
 */
export function shownLevel(desired: number, loaded: (level: number) => boolean): number | undefined {
  if (loaded(desired)) return desired;
  for (let l = desired - 1; l >= 0; l--) if (loaded(l)) return l;
  for (let l = desired + 1; l <= COARSEST; l++) if (loaded(l)) return l;
  return undefined;
}

/**
 * Decides which tiles at which level the player needs around a position,
 * fetches what is missing (nearest first), and drops finer levels that are no
 * longer wanted. The whole core stays loaded at the coarsest level as a horizon,
 * so there is always ground under a fast beaver.
 */
export class Streamer {
  private readonly desired = new Map<string, number>();
  private readonly fine = new Set<string>();
  private readonly inFlight = new Set<string>();
  private readonly failed = new Set<string>();

  constructor(
    private readonly store: TileStore,
    private readonly fetchTile: FetchTile,
    private readonly options: StreamerOptions = defaultStreamerOptions,
    private readonly fetchWater?: FetchWater,
  ) {}

  desiredLevel(tx: number, tz: number): number {
    return this.desired.get(tileKey(tx, tz)) ?? COARSEST;
  }

  /** True when the tile has a fine level and the beaver is close enough to want it. */
  wantsFine(tx: number, tz: number): boolean {
    return this.fine.has(tileKey(tx, tz));
  }

  get pending(): number {
    return this.inFlight.size;
  }

  update(x: number, z: number): void {
    const size = this.store.size;
    const wanted: { tx: number; tz: number; level: number; dist: number }[] = [];
    for (const t of this.store.index.tiles) {
      const key = tileKey(t.tx, t.tz);
      const dist = distToTile(x, z, t.tx, t.tz, size);
      const level = t.far ? COARSEST : levelFor(dist, this.desired.get(key), this.options);
      this.desired.set(key, level);
      for (const l of level === COARSEST ? [COARSEST] : [COARSEST, level]) {
        if (!this.store.has(t.tx, t.tz, l)) wanted.push({ tx: t.tx, tz: t.tz, level: l, dist });
      }
      this.evict(t.tx, t.tz, level);
      const fine = !!t.fine && dist < this.options.fineRing + (this.fine.has(key) ? this.options.hysteresis : 0);
      if (fine) {
        this.fine.add(key);
        if (!this.store.has(t.tx, t.tz, LEVEL_FINE)) wanted.push({ tx: t.tx, tz: t.tz, level: LEVEL_FINE, dist });
      } else {
        this.fine.delete(key);
        this.store.drop(t.tx, t.tz, LEVEL_FINE);
      }
      if (t.water && level < COARSEST && !this.store.waterOf(t.tx, t.tz)) this.startWater(t.tx, t.tz);
    }
    // nearest first, and the coarse ground of a tile before its fine level
    wanted.sort((a, b) => a.dist - b.dist || b.level - a.level);
    for (const w of wanted) {
      if (this.inFlight.size >= this.options.maxConcurrent) break;
      this.start(w.tx, w.tz, w.level);
    }
  }

  private evict(tx: number, tz: number, desired: number): void {
    for (let l = 0; l < COARSEST; l++) {
      if (l === desired || !this.store.has(tx, tz, l)) continue;
      // a finer level is no longer wanted; a coarser one stays until the wanted one arrives
      if (l < desired || this.store.has(tx, tz, desired)) this.store.drop(tx, tz, l);
    }
  }

  private startWater(tx: number, tz: number): void {
    const id = `water:${tileKey(tx, tz)}`;
    if (!this.fetchWater || this.inFlight.has(id) || this.failed.has(id)) return;
    this.inFlight.add(id);
    this.fetchWater(tx, tz)
      .then((water) => this.store.putWater(tx, tz, water))
      .catch((e: unknown) => {
        this.failed.add(id);
        console.warn(`${id} failed`, e);
      })
      .finally(() => this.inFlight.delete(id));
  }

  private start(tx: number, tz: number, level: number): void {
    const id = `${level}:${tileKey(tx, tz)}`;
    if (this.inFlight.has(id) || this.failed.has(id)) return;
    this.inFlight.add(id);
    this.fetchTile(level, tx, tz)
      .then((tile) => this.store.put(tile))
      .catch((e: unknown) => {
        this.failed.add(id);
        console.warn(`tile ${id} failed`, e);
      })
      .finally(() => this.inFlight.delete(id));
  }

  /**
   * True once every tile within the level 0 ring of a point has its wanted level.
   * The far horizon may still be loading. Call update first.
   */
  settled(x: number, z: number): boolean {
    const size = this.store.size;
    for (const t of this.store.index.tiles) {
      if (distToTile(x, z, t.tx, t.tz, size) >= this.options.rings[0]) continue;
      if (!this.store.has(t.tx, t.tz, this.desiredLevel(t.tx, t.tz))) return false;
    }
    return true;
  }

  /** Resolves once the tile under a point and every tile of the inner ring around it are loaded, or after a timeout. */
  async ready(x: number, z: number, timeoutMs: number): Promise<boolean> {
    const size = this.store.size;
    const tx = Math.floor(x / size);
    const tz = Math.floor(z / size);
    const end = performance.now() + timeoutMs;
    for (;;) {
      this.update(x, z);
      const fineOk = !this.wantsFine(tx, tz) || this.store.has(tx, tz, LEVEL_FINE);
      if (fineOk && this.store.has(tx, tz, this.desiredLevel(tx, tz)) && this.settled(x, z)) return true;
      if (performance.now() > end) return false;
      await new Promise((r) => setTimeout(r, 30));
    }
  }
}

/** Fetches tile files from a base url (tiles/ next to the page). */
export function httpFetchTile(base: string): FetchTile {
  return async (level, tx, tz) => {
    const res = await fetch(`${base}L${level}/${tx}_${tz}.bin`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    return timed('decode', level, () => decodeTile(tx, tz, buf));
  };
}

/** Fetches the lake and stream file of a tile from a base url. */
export function httpFetchWater(base: string): FetchWater {
  return async (tx, tz) => {
    const res = await fetch(`${base}water/${tx}_${tz}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as TileWater;
  };
}
